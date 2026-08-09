import { type CSSResultGroup, css, html, LitElement, type PropertyValues } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import type { FdCanvasPoint, FdCanvasRect } from '../../geometry.js'
import { FdCanvasTransform, FdCanvasViewport } from '../../geometry.js'
import type { FdGraphMiniMapNavigationDetail } from '../../graph/minimap-events.js'
import type { FdAnyGraphSnapshot } from '../../graph/model.js'
import { FdGraphSnapshotIndex } from '../../graph/snapshot-index.js'
import type { FdGraphMiniMapConfiguration } from '../../minimap/configuration.js'
import { resolveGraphMiniMapConfiguration } from '../../minimap/configuration.js'
import type { FdGraphMiniMapRenderPlan } from '../../minimap/planner.js'
import { planGraphMiniMap } from '../../minimap/planner.js'
import {
  FdGraphMiniMapCanvasRenderingBackend,
  type FdGraphMiniMapRenderingBackend,
} from '../../minimap/renderer.js'
import {
  FdGraphMiniMapPlanProjection,
  FdGraphMiniMapTransform,
  graphMiniMapIsVisible,
  graphMiniMapScopeBounds,
} from '../../minimap/transform.js'

const emptySnapshot: FdAnyGraphSnapshot = { id: 'empty', nodes: [], edges: [] }
const emptyViewport = new FdCanvasViewport(
  FdCanvasTransform.identity,
  { width: 1, height: 1 },
  { x: 0, y: 0, width: 1, height: 1 },
)
const wheelEndDelay = 90
const pinchExponentialScale = 0.01
const settledRefreshDelay = 120
const localNavigatorMarginRatio = 0.2

interface PointerState {
  readonly pointerID: number
  readonly transform: FdGraphMiniMapTransform
  readonly centerOffset: FdCanvasPoint
}

@customElement('fd-graph-minimap')
export class FdGraphMiniMap extends LitElement {
  static override styles: CSSResultGroup = css`
    :host {
      position: absolute;
      display: block;
      contain: layout paint style;
      box-sizing: border-box;
      overflow: hidden;
      border: 1px solid var(--fd-graph-minimap-border, rgb(115 120 114 / 0.18));
      border-radius: var(--fd-graph-minimap-corner-radius, 12px);
      background: var(--fd-graph-minimap-background, rgb(255 255 255 / 0.96));
      box-shadow: 0 8px 28px rgb(35 43 38 / 0.1);
      opacity: 1;
      outline: none;
      touch-action: none;
      transition: opacity 140ms ease;
      user-select: none;
    }

    :host([data-visible='false']) {
      opacity: 0;
      pointer-events: none;
    }

    :host([placement='topLeading']) {
      top: var(--fd-graph-minimap-inset, 16px);
      left: var(--fd-graph-minimap-inset, 16px);
    }

    :host([placement='topTrailing']) {
      top: var(--fd-graph-minimap-inset, 16px);
      right: var(--fd-graph-minimap-inset, 16px);
    }

    :host([placement='bottomLeading']) {
      bottom: var(--fd-graph-minimap-inset, 16px);
      left: var(--fd-graph-minimap-inset, 16px);
    }

    :host([placement='bottomTrailing']) {
      right: var(--fd-graph-minimap-inset, 16px);
      bottom: var(--fd-graph-minimap-inset, 16px);
    }

    :host(:focus-visible) {
      box-shadow:
        0 0 0 2px var(--fd-graph-minimap-viewport-stroke, rgb(109 158 165 / 0.88)),
        0 8px 28px rgb(35 43 38 / 0.1);
    }

    canvas,
    .decorations {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }

    canvas {
      pointer-events: none;
    }

    .viewport-indicator {
      position: absolute;
      top: 0;
      left: 0;
      box-sizing: border-box;
      min-width: 1px;
      min-height: 1px;
      border: var(--fd-graph-minimap-viewport-stroke-width, 1.5px) solid
        var(--fd-graph-minimap-viewport-stroke, rgb(109 158 165 / 0.88));
      border-radius: var(--fd-graph-minimap-viewport-corner-radius, 3px);
      background: var(--fd-graph-minimap-viewport-fill, rgb(109 158 165 / 0.1));
      pointer-events: none;
      transform-origin: 0 0;
    }

    .decorations {
      pointer-events: none;
    }

    .decorations ::slotted(*) {
      pointer-events: auto;
    }

    @media (prefers-reduced-motion: reduce) {
      :host {
        transition: none;
      }
    }
  `

  @property({ attribute: false }) snapshot: FdAnyGraphSnapshot = emptySnapshot
  @property({ attribute: false }) snapshotIndex: FdGraphSnapshotIndex | undefined
  @property({ attribute: false }) viewport: FdCanvasViewport = emptyViewport
  @property({ attribute: false }) configuration: FdGraphMiniMapConfiguration = {}
  @property({ attribute: false }) renderingBackend: FdGraphMiniMapRenderingBackend | undefined

  @query('canvas') private canvas!: HTMLCanvasElement
  @query('.viewport-indicator') private viewportIndicator!: HTMLElement

  private index = new FdGraphSnapshotIndex(emptySnapshot)
  private indexedSnapshot: FdAnyGraphSnapshot | undefined
  private resolvedConfiguration = resolveGraphMiniMapConfiguration({})
  private backend: FdGraphMiniMapRenderingBackend | undefined
  private activeBackend: FdGraphMiniMapRenderingBackend | undefined
  private plan: FdGraphMiniMapRenderPlan | undefined
  private displayTransform: FdGraphMiniMapTransform | undefined
  private navigatorWorldBounds: FdCanvasRect | undefined
  private pointerState: PointerState | undefined
  private planningFrame: number | undefined
  private planningTimer: number | undefined
  private planningController: AbortController | undefined
  private wheelEndTimer: number | undefined
  private wheelCenter: FdCanvasPoint | undefined
  private wheelZoom: number | undefined

  override render() {
    return html`
      <canvas aria-hidden="true"></canvas>
      <div class="viewport-indicator" aria-hidden="true"></div>
      <div class="decorations"><slot name="decoration"></slot></div>
    `
  }

  override firstUpdated(): void {
    this.addEventListener('pointerdown', this.handlePointerDown)
    this.addEventListener('pointermove', this.handlePointerMove)
    this.addEventListener('pointerup', this.handlePointerEnd)
    this.addEventListener('pointercancel', this.handlePointerCancel)
    this.addEventListener('wheel', this.handleWheel, { passive: false })
    this.activateBackend()
    this.rebuildIndex()
    this.syncConfiguration()
    this.syncViewport(true)
  }

  override connectedCallback(): void {
    super.connectedCallback()
    if (!this.hasUpdated) return
    queueMicrotask(() => {
      this.activateBackend()
      this.schedulePlan()
    })
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('snapshot') || changed.has('snapshotIndex')) this.rebuildIndex()
    if (changed.has('configuration')) {
      this.syncConfiguration()
      this.navigatorWorldBounds = undefined
      this.syncViewport(true)
    }
    if (changed.has('renderingBackend')) this.activateBackend()
    if (changed.has('viewport')) this.syncViewport(false)
  }

  override disconnectedCallback(): void {
    this.cancelPlanning()
    if (this.wheelEndTimer !== undefined) window.clearTimeout(this.wheelEndTimer)
    this.backend?.unmount()
    this.backend = undefined
    this.activeBackend = undefined
    super.disconnectedCallback()
  }

  private rebuildIndex(): void {
    if (this.snapshotIndex?.snapshot === this.snapshot) this.index = this.snapshotIndex
    else if (this.indexedSnapshot !== this.snapshot)
      this.index = new FdGraphSnapshotIndex(this.snapshot)
    this.indexedSnapshot = this.snapshot
    this.navigatorWorldBounds = undefined
    if (this.viewportIndicator) this.syncViewport(true)
    else this.schedulePlan()
  }

  private syncConfiguration(): void {
    this.resolvedConfiguration = resolveGraphMiniMapConfiguration(this.configuration)
    const { size, placement, overlayInsets, accessibilityLabel, interaction, style } =
      this.resolvedConfiguration
    this.style.width = `${size.width}px`
    this.style.height = `${size.height}px`
    this.style.setProperty('--fd-graph-minimap-inset', `${overlayInsets}px`)
    this.style.setProperty('--fd-graph-minimap-background', style.background)
    this.style.setProperty('--fd-graph-minimap-border', style.border)
    this.style.setProperty('--fd-graph-minimap-corner-radius', `${style.cornerRadius}px`)
    this.style.setProperty('--fd-graph-minimap-viewport-fill', style.viewportFill)
    this.style.setProperty('--fd-graph-minimap-viewport-stroke', style.viewportStroke)
    this.style.setProperty(
      '--fd-graph-minimap-viewport-corner-radius',
      `${style.viewportCornerRadius}px`,
    )
    this.style.setProperty(
      '--fd-graph-minimap-viewport-stroke-width',
      `${style.viewportStrokeWidth}px`,
    )
    this.setAttribute('placement', placement)
    this.setAttribute('role', 'group')
    this.setAttribute('aria-label', accessibilityLabel)
    this.tabIndex = interaction === 'displayOnly' ? -1 : 0
    this.syncAccessibilityValue()
  }

  private activateBackend(): void {
    if (!this.canvas) return
    const source = this.renderingBackend
    if (source === this.activeBackend && this.backend) return
    this.backend?.unmount()
    this.backend = source ?? new FdGraphMiniMapCanvasRenderingBackend()
    this.activeBackend = source
    this.backend.mount(this.canvas)
    this.drawPlan()
  }

  private schedulePlan(): void {
    if (!this.canvas) return
    this.cancelPlanning()
    this.planningController = new AbortController()
    const schedule = (): void => {
      this.planningFrame = requestAnimationFrame(() => {
        this.planningFrame = undefined
        this.buildPlan(this.planningController?.signal)
      })
    }
    if (this.resolvedConfiguration.refreshPolicy === 'afterChangesSettle') {
      this.planningTimer = window.setTimeout(() => {
        this.planningTimer = undefined
        schedule()
      }, settledRefreshDelay)
    } else schedule()
  }

  private cancelPlanning(): void {
    this.planningController?.abort()
    this.planningController = undefined
    if (this.planningFrame !== undefined) cancelAnimationFrame(this.planningFrame)
    if (this.planningTimer !== undefined) window.clearTimeout(this.planningTimer)
    this.planningFrame = undefined
    this.planningTimer = undefined
  }

  private buildPlan(signal: AbortSignal | undefined): void {
    if (signal?.aborted) return
    const transform = this.planningTransform()
    try {
      this.plan = planGraphMiniMap({
        snapshot: this.snapshot,
        index: this.index,
        transform,
        representation: this.resolvedConfiguration.representation,
        performance: this.resolvedConfiguration.performance,
        availableNodeStyleCount: this.resolvedConfiguration.style.nodeStyles.length,
        nodeStyleIndex: this.resolvedConfiguration.nodeStyleIndex,
        ...(signal ? { signal } : {}),
      })
      this.drawPlan()
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) throw error
    }
  }

  private planningTransform(): FdGraphMiniMapTransform {
    if (this.resolvedConfiguration.scope.kind === 'overview') {
      return new FdGraphMiniMapTransform(
        this.index.contentBounds,
        this.resolvedConfiguration.size,
        this.resolvedConfiguration.contentPadding,
      )
    }
    return this.currentDisplayTransform()
  }

  private currentDisplayTransform(): FdGraphMiniMapTransform {
    return new FdGraphMiniMapTransform(
      this.resolvedWorldBounds(),
      this.resolvedConfiguration.size,
      this.resolvedConfiguration.contentPadding,
    )
  }

  private resolvedWorldBounds(): FdCanvasRect {
    const scope = this.resolvedConfiguration.scope
    if (scope.kind !== 'localNavigator') {
      return graphMiniMapScopeBounds(
        scope,
        this.index.contentBounds,
        this.viewport.visibleWorldRect,
      )
    }
    const requested = graphMiniMapScopeBounds(
      scope,
      this.index.contentBounds,
      this.viewport.visibleWorldRect,
    )
    const current = this.navigatorWorldBounds
    if (!current || !this.retainedNavigatorBounds(current, this.viewport.visibleWorldRect)) {
      this.navigatorWorldBounds = requested
    }
    return this.navigatorWorldBounds ?? requested
  }

  private retainedNavigatorBounds(bounds: FdCanvasRect, visible: FdCanvasRect): boolean {
    const marginX = bounds.width * localNavigatorMarginRatio
    const marginY = bounds.height * localNavigatorMarginRatio
    return (
      visible.x >= bounds.x + marginX &&
      visible.y >= bounds.y + marginY &&
      visible.x + visible.width <= bounds.x + bounds.width - marginX &&
      visible.y + visible.height <= bounds.y + bounds.height - marginY
    )
  }

  private syncViewport(forcePlan: boolean): void {
    if (!this.viewportIndicator) return
    const next = this.currentDisplayTransform()
    const transformChanged = !this.transformsEqual(this.displayTransform, next)
    this.displayTransform = next
    const frame = next.applyRect(this.viewport.visibleWorldRect)
    this.viewportIndicator.style.transform = `translate3d(${frame.x}px, ${frame.y}px, 0)`
    this.viewportIndicator.style.width = `${Math.max(frame.width, 1)}px`
    this.viewportIndicator.style.height = `${Math.max(frame.height, 1)}px`
    const visible =
      this.pointerState !== undefined ||
      graphMiniMapIsVisible(
        this.resolvedConfiguration.visibility,
        this.index.contentBounds,
        this.viewport.visibleWorldRect,
      )
    this.setAttribute('data-visible', String(visible))
    this.syncAccessibilityValue()
    if (forcePlan || (transformChanged && this.resolvedConfiguration.scope.kind !== 'overview')) {
      this.schedulePlan()
    } else if (transformChanged) this.drawPlan()
  }

  private drawPlan(): void {
    const plan = this.plan
    const transform = this.displayTransform
    if (!plan || !transform || !this.backend) return
    this.backend.render({
      snapshot: this.snapshot,
      index: this.index,
      plan,
      projection: new FdGraphMiniMapPlanProjection(plan.transform, transform),
      configuration: this.resolvedConfiguration,
      pixelRatio: window.devicePixelRatio,
    })
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (
      this.resolvedConfiguration.interaction === 'displayOnly' ||
      event.button !== 0 ||
      this.pointerState
    ) {
      return
    }
    event.preventDefault()
    this.focus({ preventScroll: true })
    const location = this.localPoint(event)
    const transform = this.displayTransform ?? this.currentDisplayTransform()
    const viewportFrame = transform.applyRect(this.viewport.visibleWorldRect)
    const world = transform.removePoint(location)
    const center = this.viewportCenter()
    this.pointerState = {
      pointerID: event.pointerId,
      transform,
      centerOffset: this.pointInRect(location, viewportFrame)
        ? { x: center.x - world.x, y: center.y - world.y }
        : { x: 0, y: 0 },
    }
    this.setPointerCapture(event.pointerId)
    this.movePointer(location, 'continuous')
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (this.pointerState?.pointerID !== event.pointerId) return
    event.preventDefault()
    this.movePointer(this.localPoint(event), 'continuous')
  }

  private handlePointerEnd = (event: PointerEvent): void => {
    if (this.pointerState?.pointerID !== event.pointerId) return
    this.movePointer(this.localPoint(event), 'ended')
    this.pointerState = undefined
    if (this.hasPointerCapture(event.pointerId)) this.releasePointerCapture(event.pointerId)
  }

  private handlePointerCancel = (event: PointerEvent): void => {
    if (this.pointerState?.pointerID !== event.pointerId) return
    this.pointerState = undefined
    if (this.hasPointerCapture(event.pointerId)) this.releasePointerCapture(event.pointerId)
  }

  private movePointer(location: FdCanvasPoint, phase: 'continuous' | 'ended'): void {
    const state = this.pointerState
    if (!state) return
    const world = state.transform.removePoint(location)
    this.emitNavigation({
      kind: 'center',
      worldPoint: {
        x: world.x + state.centerOffset.x,
        y: world.y + state.centerOffset.y,
      },
      phase,
    })
  }

  private handleWheel = (event: WheelEvent): void => {
    if (this.resolvedConfiguration.interaction === 'displayOnly') return
    if (event.ctrlKey && this.resolvedConfiguration.interaction !== 'panAndZoom') return
    event.preventDefault()
    const multiplier = this.wheelMultiplier(event.deltaMode)
    if (event.ctrlKey && this.resolvedConfiguration.interaction === 'panAndZoom') {
      const zoom =
        (this.wheelZoom ?? this.viewport.transform.zoom) *
        Math.exp(
          -event.deltaY *
            multiplier *
            pinchExponentialScale *
            this.resolvedConfiguration.zoomSensitivity,
        )
      this.wheelZoom = zoom
      this.emitNavigation({ kind: 'zoom', zoom, phase: 'continuous' })
    } else {
      const transform = this.displayTransform ?? this.currentDisplayTransform()
      const current = this.wheelCenter ?? this.viewportCenter()
      const center = {
        x: current.x - (event.deltaX * multiplier) / transform.scale,
        y: current.y - (event.deltaY * multiplier) / transform.scale,
      }
      this.wheelCenter = center
      this.emitNavigation({ kind: 'center', worldPoint: center, phase: 'continuous' })
    }
    if (this.wheelEndTimer !== undefined) window.clearTimeout(this.wheelEndTimer)
    this.wheelEndTimer = window.setTimeout(() => this.endWheelInteraction(), wheelEndDelay)
  }

  private endWheelInteraction(): void {
    this.wheelEndTimer = undefined
    if (this.wheelZoom !== undefined) {
      this.emitNavigation({ kind: 'zoom', zoom: this.wheelZoom, phase: 'ended' })
    } else if (this.wheelCenter) {
      this.emitNavigation({ kind: 'center', worldPoint: this.wheelCenter, phase: 'ended' })
    }
    this.wheelZoom = undefined
    this.wheelCenter = undefined
  }

  private emitNavigation(detail: FdGraphMiniMapNavigationDetail): void {
    this.dispatchEvent(
      new CustomEvent<FdGraphMiniMapNavigationDetail>('fd-graph-minimap-navigation', {
        detail,
        bubbles: true,
        composed: true,
      }),
    )
  }

  private syncAccessibilityValue(): void {
    this.setAttribute(
      'aria-valuetext',
      `Zoom ${Math.round(this.viewport.transform.zoom * 100)} percent`,
    )
  }

  private viewportCenter(): FdCanvasPoint {
    const visible = this.viewport.visibleWorldRect
    return { x: visible.x + visible.width / 2, y: visible.y + visible.height / 2 }
  }

  private localPoint(event: MouseEvent): FdCanvasPoint {
    const bounds = this.getBoundingClientRect()
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  }

  private pointInRect(point: FdCanvasPoint, rect: FdCanvasRect): boolean {
    return (
      point.x >= rect.x &&
      point.y >= rect.y &&
      point.x <= rect.x + rect.width &&
      point.y <= rect.y + rect.height
    )
  }

  private transformsEqual(
    first: FdGraphMiniMapTransform | undefined,
    second: FdGraphMiniMapTransform,
  ): boolean {
    return (
      first?.scale === second.scale &&
      first.offset.x === second.offset.x &&
      first.offset.y === second.offset.y
    )
  }

  private wheelMultiplier(deltaMode: number): number {
    if (deltaMode === WheelEvent.DOM_DELTA_LINE) {
      return this.resolvedConfiguration.discreteScrollMultiplier
    }
    if (deltaMode === WheelEvent.DOM_DELTA_PAGE) return this.resolvedConfiguration.size.height
    return 1
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-graph-minimap': FdGraphMiniMap
  }
}
