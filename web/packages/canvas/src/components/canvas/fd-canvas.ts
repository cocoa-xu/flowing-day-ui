import { type CSSResultGroup, css, html, LitElement, type PropertyValues } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import {
  type FdCanvasConfiguration,
  type FdCanvasContentChangeBehavior,
  type FdCanvasInteractionMode,
  type FdCanvasRequest,
  type FdCanvasViewportAction,
  type FdCanvasViewportChangePhase,
  resolveCanvasConfiguration,
} from '../../configuration.js'
import type {
  FdCanvasDragContext,
  FdCanvasSmartMagnifyContext,
  FdCanvasViewportChangeDetail,
} from '../../events.js'
import {
  type FdCanvasInsets,
  type FdCanvasPoint,
  type FdCanvasRect,
  FdCanvasTransform,
  FdCanvasViewport,
  zeroCanvasInsets,
} from '../../geometry.js'
import { FdCanvasRenderCoverage } from '../../internal/render-coverage.js'

const WHEEL_END_DELAY = 90
const PINCH_EXPONENTIAL_SCALE = 0.01
const INTERACTIVE_SELECTOR =
  'button, input, select, textarea, a[href], [contenteditable="true"], [data-fd-canvas-interactive]'

export interface FdCanvasTransformOptions {
  readonly animated?: boolean
  readonly animationDuration?: number
  readonly phase?: FdCanvasViewportChangePhase
}

interface FdCanvasPinchInteraction {
  readonly pointerIDs: readonly [number, number]
  readonly startDistance: number
  readonly startZoom: number
  readonly worldAnchor: FdCanvasPoint
}

/**
 * A platform-neutral infinite viewport matching the Swift `FlowingCanvas` contract.
 *
 * @slot - World content transformed with the viewport.
 * @slot world - Named world content transformed with the viewport.
 * @slot background - Viewport-fixed background content.
 * @slot overlay - Viewport-fixed interactive controls.
 * @fires fd-viewport-change - Viewport changes during and after navigation.
 * @fires fd-render-world-rect-change - The virtualized world coverage should be refreshed.
 * @fires fd-content-drag-change - A content-mode pointer drag changed.
 * @fires fd-content-drag-end - A content-mode pointer drag ended.
 * @fires fd-smart-magnify - A cancelable smart-magnify request.
 */
@customElement('fd-canvas')
export class FdCanvas extends LitElement {
  static override styles: CSSResultGroup = css`
    :host {
      display: block;
      position: relative;
      overflow: hidden;
      box-sizing: border-box;
      min-width: 0;
      min-height: 0;
      contain: layout paint style;
      color: inherit;
      font: inherit;
      touch-action: none;
      user-select: none;
    }

    :host([hidden]) {
      display: none !important;
    }

    *,
    *::before,
    *::after {
      box-sizing: inherit;
    }

    .viewport,
    .background,
    .overlay {
      position: absolute;
      inset: 0;
    }

    .viewport {
      overflow: hidden;
      outline: none;
    }

    .viewport:focus-visible {
      outline: 2px solid var(--fd-canvas-focus-color, Highlight);
      outline-offset: -2px;
    }

    :host([interaction-mode='pan']) .viewport {
      cursor: grab;
    }

    .background {
      z-index: 0;
      pointer-events: none;
    }

    .world {
      position: absolute;
      z-index: 1;
      top: 0;
      left: 0;
      width: 1px;
      height: 1px;
      transform: translate(0, 0) scale(1);
      transform-origin: 0 0;
    }

    .overlay {
      z-index: 2;
      pointer-events: none;
    }

    ::slotted([slot='overlay']) {
      pointer-events: auto;
    }
  `

  @property({ attribute: false }) configuration: Partial<FdCanvasConfiguration> = {}
  @property({ attribute: false }) contentRect: FdCanvasRect = {
    x: 0,
    y: 0,
    width: 1000,
    height: 800,
  }
  @property({ attribute: false }) contentID: unknown = undefined
  @property({ attribute: false }) contentInsets: FdCanvasInsets = zeroCanvasInsets
  @property({ attribute: false }) contentChangeBehavior: FdCanvasContentChangeBehavior = {
    kind: 'preserveViewport',
  }
  @property({ attribute: false }) request: FdCanvasRequest | undefined
  @property({ reflect: true, attribute: 'interaction-mode' })
  interactionMode: FdCanvasInteractionMode = 'pan'
  @property({ type: Boolean, attribute: 'allows-page-scroll' }) allowsPageScroll = false
  @property({ type: Number, attribute: 'viewport-tab-index' }) viewportTabIndex = 0

  @query('.viewport') private viewportElement!: HTMLDivElement
  @query('.world') private worldElement!: HTMLDivElement

  private resolvedConfiguration = resolveCanvasConfiguration({})
  private transformValue = FdCanvasTransform.identity
  private viewportSize = { width: 0, height: 0 }
  private contentBoundsValue: FdCanvasRect = { x: 0, y: 0, width: 0, height: 0 }
  private renderCoverage = new FdCanvasRenderCoverage()
  private restoreTransform: FdCanvasTransform | undefined
  private resizeObserver: ResizeObserver | undefined
  private handledRequestID: string | number | undefined
  private handledRequestContentID: unknown
  private initialized = false
  private activePointer: number | undefined
  private dragStart: FdCanvasPoint | undefined
  private dragOrigin: FdCanvasPoint | undefined
  private didDrag = false
  private readonly touchLocations = new Map<number, FdCanvasPoint>()
  private pinchInteraction: FdCanvasPinchInteraction | undefined
  private animationFrame: number | undefined
  private wheelEndTimer: number | undefined

  get viewport(): FdCanvasViewport {
    return new FdCanvasViewport(this.transformValue, this.viewportSize, this.contentBoundsValue)
  }

  get renderWorldRect(): FdCanvasRect {
    return this.renderCoverage.worldRect
  }

  override render() {
    return html`
      <div
        class="viewport"
        part="viewport"
        tabindex=${this.viewportTabIndex}
        @pointerdown=${this.handlePointerDown}
        @pointermove=${this.handlePointerMove}
        @pointerup=${this.handlePointerEnd}
        @pointercancel=${this.handlePointerEnd}
        @dblclick=${this.handleSmartMagnify}
      >
        <div class="background" part="background"><slot name="background"></slot></div>
        <div class="world" part="world"><slot></slot><slot name="world"></slot></div>
        <div class="overlay" part="overlay"><slot name="overlay"></slot></div>
      </div>
    `
  }

  override firstUpdated(): void {
    this.viewportElement.addEventListener('wheel', this.handleWheel, { passive: false })
    this.resizeObserver = new ResizeObserver(() => this.updateGeometry())
    this.resizeObserver.observe(this)
    this.updateGeometry()
  }

  override disconnectedCallback(): void {
    this.viewportElement?.removeEventListener('wheel', this.handleWheel)
    this.resizeObserver?.disconnect()
    this.cancelAnimation()
    if (this.wheelEndTimer !== undefined) window.clearTimeout(this.wheelEndTimer)
    super.disconnectedCallback()
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('configuration')) {
      this.resolvedConfiguration = resolveCanvasConfiguration(this.configuration)
      if (this.initialized) {
        this.commitTransform(this.clampedTransform(this.transformValue), 'ended', true)
      }
    }
    if (changed.has('contentInsets') && this.initialized) this.updateGeometry()
    if ((changed.has('contentRect') || changed.has('contentID')) && this.initialized) {
      this.handleContentChange()
    }
    if (changed.has('request')) this.handleRequest(this.request)
    if (changed.has('interactionMode')) this.cancelPointerInteraction()
  }

  setZoom(zoom: number, options: FdCanvasTransformOptions = {}): void {
    const center = {
      x: this.contentBoundsValue.x + this.contentBoundsValue.width / 2,
      y: this.contentBoundsValue.y + this.contentBoundsValue.height / 2,
    }
    const worldCenter = this.transformValue.removePoint(center)
    this.restoreTransform = undefined
    this.updateTransform(
      FdCanvasTransform.anchoring(worldCenter, center, this.clampZoom(zoom)),
      options,
    )
  }

  anchor(
    worldPoint: FdCanvasPoint,
    viewportPoint: FdCanvasPoint,
    zoom = this.transformValue.zoom,
    options: FdCanvasTransformOptions = {},
  ): void {
    this.restoreTransform = undefined
    this.updateTransform(
      FdCanvasTransform.anchoring(worldPoint, viewportPoint, this.clampZoom(zoom)),
      options,
    )
  }

  center(
    worldPoint: FdCanvasPoint,
    zoom = this.transformValue.zoom,
    options: FdCanvasTransformOptions = {},
  ): void {
    this.anchor(
      worldPoint,
      {
        x: this.contentBoundsValue.x + this.contentBoundsValue.width / 2,
        y: this.contentBoundsValue.y + this.contentBoundsValue.height / 2,
      },
      zoom,
      options,
    )
  }

  focusRect(rect: FdCanvasRect, zoom?: number, options: FdCanvasTransformOptions = {}): void {
    this.restoreTransform = undefined
    this.updateTransform(
      FdCanvasTransform.focusing(
        rect,
        this.contentBoundsValue,
        this.clampZoom(zoom ?? this.resolvedConfiguration.focusedZoom),
      ),
      { animated: true, ...options },
    )
  }

  fitRect(
    rect: FdCanvasRect,
    padding: number,
    maximumZoom?: number,
    options: FdCanvasTransformOptions = {},
  ): void {
    this.restoreTransform = undefined
    this.updateTransform(
      FdCanvasTransform.fitting(rect, this.contentBoundsValue, padding, [
        this.resolvedConfiguration.zoomRange[0],
        Math.max(
          Math.min(
            maximumZoom ?? this.resolvedConfiguration.zoomRange[1],
            this.resolvedConfiguration.zoomRange[1],
          ),
          this.resolvedConfiguration.zoomRange[0],
        ),
      ]),
      { animated: true, ...options },
    )
  }

  restore(options: FdCanvasTransformOptions = {}): void {
    if (!this.restoreTransform) return
    const transform = this.restoreTransform
    this.restoreTransform = undefined
    this.updateTransform(transform, { animated: true, ...options })
  }

  private updateGeometry(): void {
    const nextSize = { width: this.clientWidth, height: this.clientHeight }
    if (nextSize.width <= 0 || nextSize.height <= 0) return
    const nextBounds = this.contentBounds(nextSize)
    if (!this.initialized) {
      this.initialized = true
      this.viewportSize = nextSize
      this.contentBoundsValue = nextBounds
      this.resolvedConfiguration = resolveCanvasConfiguration(this.configuration)
      const initialTransform = FdCanvasTransform.focusing(
        this.contentRect,
        nextBounds,
        this.clampZoom(this.resolvedConfiguration.initialZoom),
      )
      this.commitTransform(initialTransform, 'ended', true)
      this.handleRequest(this.request)
      return
    }

    const oldCenter = {
      x: this.contentBoundsValue.x + this.contentBoundsValue.width / 2,
      y: this.contentBoundsValue.y + this.contentBoundsValue.height / 2,
    }
    const worldCenter = this.transformValue.removePoint(oldCenter)
    const nextCenter = {
      x: nextBounds.x + nextBounds.width / 2,
      y: nextBounds.y + nextBounds.height / 2,
    }
    this.viewportSize = nextSize
    this.contentBoundsValue = nextBounds
    this.commitTransform(
      FdCanvasTransform.anchoring(worldCenter, nextCenter, this.transformValue.zoom),
      'ended',
      true,
    )
  }

  private handleContentChange(): void {
    this.restoreTransform = undefined
    switch (this.contentChangeBehavior.kind) {
      case 'preserveViewport':
        this.refreshRenderWorldRect(true)
        break
      case 'center':
        this.focusRect(this.contentRect, this.resolvedConfiguration.initialZoom, {
          animated: false,
        })
        break
      case 'fit':
        this.fitRect(
          this.contentRect,
          this.contentChangeBehavior.padding,
          this.contentChangeBehavior.maximumZoom,
          { animated: false },
        )
        break
    }
  }

  private handleRequest(request: FdCanvasRequest | undefined): void {
    if (!request) {
      this.handledRequestID = undefined
      this.handledRequestContentID = undefined
      return
    }
    if (
      !this.initialized ||
      (this.handledRequestID === request.id && this.handledRequestContentID === this.contentID)
    ) {
      return
    }
    this.handledRequestID = request.id
    this.handledRequestContentID = this.contentID
    this.restoreTransform = undefined
    this.performAction(request.action, {
      animated: request.animated ?? true,
      ...(request.animationDuration === undefined
        ? {}
        : { animationDuration: request.animationDuration }),
    })
  }

  private performAction(action: FdCanvasViewportAction, options: FdCanvasTransformOptions): void {
    switch (action.kind) {
      case 'none':
        break
      case 'restore':
        this.restore(options)
        break
      case 'anchor':
        this.anchor(action.worldPoint, action.viewportPoint, action.zoom, options)
        break
      case 'focus':
        this.focusRect(action.rect, action.zoom, options)
        break
      case 'fit':
        this.fitRect(action.rect, action.padding, action.maximumZoom, options)
        break
    }
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.isClaimedByOverlayOrControl(event)) return
    this.cancelAnimation()
    this.viewportElement.focus({ preventScroll: true })
    const location = this.localPoint(event)
    if (event.pointerType === 'touch') {
      this.touchLocations.set(event.pointerId, location)
      this.viewportElement.setPointerCapture(event.pointerId)
      if (this.touchLocations.size === 1 && !event.defaultPrevented) {
        this.beginDrag(event.pointerId, location)
      } else if (this.touchLocations.size === 2) {
        this.resetDragState()
        this.beginPinch()
      }
      return
    }
    if (event.defaultPrevented) return
    this.beginDrag(event.pointerId, location)
    this.viewportElement.setPointerCapture(event.pointerId)
  }

  private beginDrag(pointerID: number, location: FdCanvasPoint): void {
    this.activePointer = pointerID
    this.dragStart = location
    this.dragOrigin = this.transformValue.offset
    this.didDrag = false
  }

  private beginPinch(): void {
    const pointers = [...this.touchLocations.entries()].slice(0, 2)
    const first = pointers[0]
    const second = pointers[1]
    if (!first || !second) return
    const center = this.midpoint(first[1], second[1])
    const distance = this.distance(first[1], second[1])
    if (distance <= 0) return
    this.pinchInteraction = {
      pointerIDs: [first[0], second[0]],
      startDistance: distance,
      startZoom: this.transformValue.zoom,
      worldAnchor: this.transformValue.removePoint(center),
    }
  }

  private updatePinch(): void {
    const interaction = this.pinchInteraction
    if (!interaction) return
    const first = this.touchLocations.get(interaction.pointerIDs[0])
    const second = this.touchLocations.get(interaction.pointerIDs[1])
    if (!first || !second) return
    const center = this.midpoint(first, second)
    const scale = this.distance(first, second) / interaction.startDistance
    const adjustedScale = Math.max(
      0.01,
      1 + (scale - 1) * this.resolvedConfiguration.pinchSensitivity,
    )
    this.restoreTransform = undefined
    this.commitTransform(
      FdCanvasTransform.anchoring(
        interaction.worldAnchor,
        center,
        this.clampZoom(interaction.startZoom * adjustedScale),
      ),
      'continuous',
      false,
    )
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (this.touchLocations.has(event.pointerId)) {
      this.touchLocations.set(event.pointerId, this.localPoint(event))
      if (this.pinchInteraction) {
        this.updatePinch()
        return
      }
    }
    if (event.pointerId !== this.activePointer || !this.dragStart || !this.dragOrigin) return
    const location = this.localPoint(event)
    const translation = {
      width: location.x - this.dragStart.x,
      height: location.y - this.dragStart.y,
    }
    if (
      !this.didDrag &&
      Math.hypot(translation.width, translation.height) <
        this.resolvedConfiguration.dragMinimumDistance
    ) {
      return
    }
    this.didDrag = true
    if (this.interactionMode === 'pan') {
      this.restoreTransform = undefined
      this.commitTransform(
        new FdCanvasTransform(this.transformValue.zoom, {
          x: this.dragOrigin.x + translation.width,
          y: this.dragOrigin.y + translation.height,
        }),
        'continuous',
        false,
      )
    } else {
      this.dispatchDrag('fd-content-drag-change', location, translation)
    }
  }

  private handlePointerEnd = (event: PointerEvent): void => {
    if (this.touchLocations.has(event.pointerId)) {
      const wasPinching = this.pinchInteraction !== undefined
      if (!wasPinching) this.finishDrag(event)
      this.touchLocations.delete(event.pointerId)
      this.releaseCapturedPointer(event.pointerId)
      if (wasPinching) {
        this.pinchInteraction = undefined
        this.emitViewportChange('ended')
        this.refreshRenderWorldRect(true)
        if (this.touchLocations.size >= 2) {
          this.beginPinch()
        } else {
          const remaining = this.touchLocations.entries().next().value as
            | [number, FdCanvasPoint]
            | undefined
          if (remaining) this.beginDrag(remaining[0], remaining[1])
        }
      } else {
        this.resetDragState()
      }
      return
    }
    if (event.pointerId !== this.activePointer) return
    this.finishDrag(event)
    this.cancelPointerInteraction()
  }

  private finishDrag(event: PointerEvent): void {
    const location = this.localPoint(event)
    if (this.didDrag && this.dragStart) {
      const translation = {
        width: location.x - this.dragStart.x,
        height: location.y - this.dragStart.y,
      }
      if (this.interactionMode === 'pan') {
        this.emitViewportChange('ended')
        this.refreshRenderWorldRect(true)
      } else {
        this.dispatchDrag('fd-content-drag-end', location, translation)
      }
    }
  }

  private cancelPointerInteraction(): void {
    for (const pointerID of this.touchLocations.keys()) this.releaseCapturedPointer(pointerID)
    if (this.activePointer !== undefined) this.releaseCapturedPointer(this.activePointer)
    this.touchLocations.clear()
    this.pinchInteraction = undefined
    this.resetDragState()
  }

  private resetDragState(): void {
    this.activePointer = undefined
    this.dragStart = undefined
    this.dragOrigin = undefined
    this.didDrag = false
  }

  private releaseCapturedPointer(pointerID: number): void {
    if (this.viewportElement?.hasPointerCapture(pointerID)) {
      this.viewportElement.releasePointerCapture(pointerID)
    }
  }

  private midpoint(first: FdCanvasPoint, second: FdCanvasPoint): FdCanvasPoint {
    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
  }

  private distance(first: FdCanvasPoint, second: FdCanvasPoint): number {
    return Math.hypot(second.x - first.x, second.y - first.y)
  }

  private dispatchDrag(
    type: 'fd-content-drag-change' | 'fd-content-drag-end',
    location: FdCanvasPoint,
    translation: { readonly width: number; readonly height: number },
  ): void {
    if (!this.dragStart) return
    const detail: FdCanvasDragContext = {
      startLocation: this.dragStart,
      location,
      translation,
      worldStartLocation: this.transformValue.removePoint(this.dragStart),
      worldLocation: this.transformValue.removePoint(location),
    }
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }))
  }

  private handleWheel = (event: WheelEvent): void => {
    if (event.metaKey || this.isClaimedByOverlayOrControl(event)) return
    const location = this.localPoint(event)
    if (!this.pointInContentBounds(location)) return
    if (!event.ctrlKey && this.allowsPageScroll) return
    event.preventDefault()
    this.cancelAnimation()
    this.restoreTransform = undefined
    if (event.ctrlKey) {
      const zoom = this.clampZoom(
        this.transformValue.zoom *
          Math.exp(
            -event.deltaY * PINCH_EXPONENTIAL_SCALE * this.resolvedConfiguration.pinchSensitivity,
          ),
      )
      const worldAnchor = this.transformValue.removePoint(location)
      this.commitTransform(
        FdCanvasTransform.anchoring(worldAnchor, location, zoom),
        'continuous',
        false,
      )
    } else {
      const multiplier = this.wheelMultiplier(event.deltaMode)
      this.commitTransform(
        new FdCanvasTransform(this.transformValue.zoom, {
          x: this.transformValue.offset.x - event.deltaX * multiplier,
          y: this.transformValue.offset.y - event.deltaY * multiplier,
        }),
        'continuous',
        false,
      )
    }
    if (this.wheelEndTimer !== undefined) window.clearTimeout(this.wheelEndTimer)
    this.wheelEndTimer = window.setTimeout(() => {
      this.wheelEndTimer = undefined
      this.emitViewportChange('ended')
      this.refreshRenderWorldRect(true)
    }, WHEEL_END_DELAY)
  }

  private handleSmartMagnify = (event: MouseEvent): void => {
    if (this.isClaimedByOverlayOrControl(event)) return
    const location = this.localPoint(event)
    if (!this.pointInContentBounds(location)) return
    const initialZoom = this.clampZoom(this.resolvedConfiguration.initialZoom)
    const detail: FdCanvasSmartMagnifyContext = {
      location,
      worldLocation: this.transformValue.removePoint(location),
      viewport: this.viewport,
      initialZoom,
      zoomTolerance: this.resolvedConfiguration.smartMagnifyZoomTolerance,
      canRestoreViewport: this.restoreTransform !== undefined,
      isZoomedIn:
        this.transformValue.zoom >
        initialZoom + this.resolvedConfiguration.smartMagnifyZoomTolerance,
    }
    const smartEvent = new CustomEvent('fd-smart-magnify', {
      detail,
      bubbles: true,
      composed: true,
      cancelable: true,
    })
    if (!this.dispatchEvent(smartEvent)) return
    if (detail.isZoomedIn && this.restoreTransform) {
      this.restore()
      return
    }
    this.restoreTransform = this.transformValue
    this.updateTransform(
      FdCanvasTransform.anchoring(
        detail.worldLocation,
        location,
        this.clampZoom(this.resolvedConfiguration.focusedZoom),
      ),
      { animated: true },
    )
  }

  private updateTransform(transform: FdCanvasTransform, options: FdCanvasTransformOptions): void {
    const phase = options.phase ?? 'ended'
    if (options.animated) {
      this.animateTo(
        transform,
        options.animationDuration ?? this.resolvedConfiguration.viewportAnimationDuration,
      )
    } else {
      this.cancelAnimation()
      this.commitTransform(transform, phase, phase === 'ended')
    }
  }

  private animateTo(transform: FdCanvasTransform, duration: number): void {
    this.cancelAnimation()
    if (duration <= 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.commitTransform(transform, 'ended', true)
      return
    }
    const from = this.transformValue
    const startedAt = performance.now()
    const durationMilliseconds = duration * 1000
    const step = (now: number): void => {
      const progress = Math.min((now - startedAt) / durationMilliseconds, 1)
      const eased = progress * progress * (3 - 2 * progress)
      this.commitTransform(
        new FdCanvasTransform(from.zoom + (transform.zoom - from.zoom) * eased, {
          x: from.offset.x + (transform.offset.x - from.offset.x) * eased,
          y: from.offset.y + (transform.offset.y - from.offset.y) * eased,
        }),
        progress < 1 ? 'continuous' : 'ended',
        progress === 1,
      )
      if (progress < 1) this.animationFrame = requestAnimationFrame(step)
      else this.animationFrame = undefined
    }
    this.animationFrame = requestAnimationFrame(step)
  }

  private cancelAnimation(): void {
    if (this.animationFrame === undefined) return
    cancelAnimationFrame(this.animationFrame)
    this.animationFrame = undefined
  }

  private commitTransform(
    transform: FdCanvasTransform,
    phase: FdCanvasViewportChangePhase,
    forceRenderRefresh: boolean,
  ): void {
    this.transformValue = this.clampedTransform(transform)
    this.worldElement.style.transform = `translate(${this.transformValue.offset.x}px, ${this.transformValue.offset.y}px) scale(${this.transformValue.zoom})`
    this.refreshRenderWorldRect(forceRenderRefresh)
    this.emitViewportChange(phase)
  }

  private emitViewportChange(phase: FdCanvasViewportChangePhase): void {
    const detail: FdCanvasViewportChangeDetail = { viewport: this.viewport, phase }
    this.dispatchEvent(
      new CustomEvent('fd-viewport-change', { detail, bubbles: true, composed: true }),
    )
  }

  private refreshRenderWorldRect(force: boolean): void {
    const rect = this.renderCoverage.update(
      this.viewport,
      this.resolvedConfiguration.renderOverscan,
      this.resolvedConfiguration.renderRetentionRatio,
      force,
    )
    if (!rect) return
    this.dispatchEvent(
      new CustomEvent('fd-render-world-rect-change', {
        detail: { rect },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private contentBounds(size: { readonly width: number; readonly height: number }): FdCanvasRect {
    return {
      x: this.contentInsets.left,
      y: this.contentInsets.top,
      width: Math.max(size.width - this.contentInsets.left - this.contentInsets.right, 0),
      height: Math.max(size.height - this.contentInsets.top - this.contentInsets.bottom, 0),
    }
  }

  private clampZoom(zoom: number): number {
    return Math.min(
      Math.max(zoom, this.resolvedConfiguration.zoomRange[0]),
      this.resolvedConfiguration.zoomRange[1],
    )
  }

  private clampedTransform(transform: FdCanvasTransform): FdCanvasTransform {
    if (transform.zoom === this.clampZoom(transform.zoom)) return transform
    const center = {
      x: this.contentBoundsValue.x + this.contentBoundsValue.width / 2,
      y: this.contentBoundsValue.y + this.contentBoundsValue.height / 2,
    }
    return FdCanvasTransform.anchoring(
      transform.removePoint(center),
      center,
      this.clampZoom(transform.zoom),
    )
  }

  private wheelMultiplier(deltaMode: number): number {
    if (deltaMode === WheelEvent.DOM_DELTA_LINE) {
      return this.resolvedConfiguration.discreteScrollMultiplier
    }
    if (deltaMode === WheelEvent.DOM_DELTA_PAGE) return Math.max(this.clientHeight, 1)
    return 1
  }

  private localPoint(event: MouseEvent): FdCanvasPoint {
    const bounds = this.viewportElement.getBoundingClientRect()
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  }

  private pointInContentBounds(point: FdCanvasPoint): boolean {
    return (
      point.x >= this.contentBoundsValue.x &&
      point.y >= this.contentBoundsValue.y &&
      point.x <= this.contentBoundsValue.x + this.contentBoundsValue.width &&
      point.y <= this.contentBoundsValue.y + this.contentBoundsValue.height
    )
  }

  private isClaimedByOverlayOrControl(event: Event): boolean {
    return event.composedPath().some((candidate) => {
      if (!(candidate instanceof HTMLElement)) return false
      return candidate.slot === 'overlay' || candidate.matches(INTERACTIVE_SELECTOR)
    })
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-canvas': FdCanvas
  }
}
