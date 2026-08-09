import type { FdCanvasViewportChangePhase } from './configuration.js'
import type { FdCanvasPoint, FdCanvasRect, FdCanvasSize, FdCanvasViewport } from './geometry.js'

export interface FdCanvasViewportChangeDetail {
  readonly viewport: FdCanvasViewport
  readonly phase: FdCanvasViewportChangePhase
}

export interface FdCanvasRenderWorldRectChangeDetail {
  readonly rect: FdCanvasRect
}

export interface FdCanvasDragDetail {
  readonly startLocation: FdCanvasPoint
  readonly location: FdCanvasPoint
  readonly translation: FdCanvasSize
  readonly worldStartLocation: FdCanvasPoint
  readonly worldLocation: FdCanvasPoint
}

export interface FdCanvasSmartMagnifyDetail {
  readonly location: FdCanvasPoint
  readonly worldLocation: FdCanvasPoint
  readonly viewport: FdCanvasViewport
  readonly initialZoom: number
  readonly zoomTolerance: number
  readonly canRestoreViewport: boolean
  readonly isZoomedIn: boolean
}

declare global {
  interface HTMLElementEventMap {
    'fd-viewport-change': CustomEvent<FdCanvasViewportChangeDetail>
    'fd-render-world-rect-change': CustomEvent<FdCanvasRenderWorldRectChangeDetail>
    'fd-content-drag-change': CustomEvent<FdCanvasDragDetail>
    'fd-content-drag-end': CustomEvent<FdCanvasDragDetail>
    'fd-smart-magnify': CustomEvent<FdCanvasSmartMagnifyDetail>
  }
}
