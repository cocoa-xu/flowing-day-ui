import type { FdCanvasViewportChangePhase } from './configuration.js'
import type { FdCanvasPoint, FdCanvasRect, FdCanvasViewport } from './geometry.js'
import { FdCanvasRenderSurface } from './geometry.js'

export class FdCanvasRenderContext {
  readonly viewport: FdCanvasViewport
  readonly renderWorldRect: FdCanvasRect

  constructor(viewport: FdCanvasViewport, renderWorldRect: FdCanvasRect) {
    this.viewport = viewport
    this.renderWorldRect = renderWorldRect
  }

  get transform(): FdCanvasViewport['transform'] {
    return this.viewport.transform
  }

  get zoom(): number {
    return this.transform.zoom
  }

  get visibleWorldRect(): FdCanvasRect {
    return this.viewport.visibleWorldRect
  }

  worldPoint(viewportPoint: FdCanvasPoint): FdCanvasPoint {
    return this.transform.removePoint(viewportPoint)
  }

  viewportPoint(worldPoint: FdCanvasPoint): FdCanvasPoint {
    return this.transform.applyPoint(worldPoint)
  }

  renderSurface(): FdCanvasRenderSurface {
    return new FdCanvasRenderSurface(this.renderWorldRect, this.transform)
  }
}

export class FdCanvasProxy {
  readonly context: FdCanvasRenderContext
  readonly #setZoomAction: (
    zoom: number,
    phase: FdCanvasViewportChangePhase,
    animated: boolean,
  ) => void
  readonly #anchorAction: (
    worldPoint: FdCanvasPoint,
    viewportPoint: FdCanvasPoint,
    zoom: number,
    phase: FdCanvasViewportChangePhase,
    animated: boolean,
  ) => void
  readonly #focusAction: (rect: FdCanvasRect, zoom: number | undefined, animated: boolean) => void
  readonly #fitAction: (
    rect: FdCanvasRect,
    padding: number,
    maximumZoom: number | undefined,
    animated: boolean,
  ) => void

  constructor(options: {
    readonly context: FdCanvasRenderContext
    readonly setZoom: (zoom: number, phase: FdCanvasViewportChangePhase, animated: boolean) => void
    readonly anchor: (
      worldPoint: FdCanvasPoint,
      viewportPoint: FdCanvasPoint,
      zoom: number,
      phase: FdCanvasViewportChangePhase,
      animated: boolean,
    ) => void
    readonly focus: (rect: FdCanvasRect, zoom: number | undefined, animated: boolean) => void
    readonly fit: (
      rect: FdCanvasRect,
      padding: number,
      maximumZoom: number | undefined,
      animated: boolean,
    ) => void
  }) {
    this.context = options.context
    this.#setZoomAction = options.setZoom
    this.#anchorAction = options.anchor
    this.#focusAction = options.focus
    this.#fitAction = options.fit
  }

  get viewport(): FdCanvasViewport {
    return this.context.viewport
  }

  get zoom(): number {
    return this.context.zoom
  }

  setZoom(zoom: number, phase: FdCanvasViewportChangePhase = 'ended', animated = false): void {
    this.#setZoomAction(zoom, phase, animated)
  }

  anchor(options: {
    readonly worldPoint: FdCanvasPoint
    readonly viewportPoint: FdCanvasPoint
    readonly zoom?: number
    readonly phase?: FdCanvasViewportChangePhase
    readonly animated?: boolean
  }): void {
    this.#anchorAction(
      options.worldPoint,
      options.viewportPoint,
      options.zoom ?? this.zoom,
      options.phase ?? 'ended',
      options.animated ?? false,
    )
  }

  focus(rect: FdCanvasRect, zoom?: number, animated = false): void {
    this.#focusAction(rect, zoom, animated)
  }

  fit(rect: FdCanvasRect, padding: number, maximumZoom?: number, animated = false): void {
    this.#fitAction(rect, padding, maximumZoom, animated)
  }
}
