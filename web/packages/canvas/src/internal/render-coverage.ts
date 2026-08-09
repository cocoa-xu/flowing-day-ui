import {
  canvasRectContains,
  type FdCanvasRect,
  type FdCanvasViewport,
  insetCanvasRect,
} from '../geometry.js'

export class FdCanvasRenderCoverage {
  worldRect: FdCanvasRect = { x: 0, y: 0, width: 0, height: 0 }

  update(
    viewport: FdCanvasViewport,
    overscan: number,
    retentionRatio: number,
    force: boolean,
  ): FdCanvasRect | undefined {
    const visibleRect = viewport.visibleWorldRect
    if (visibleRect.width <= 0 || visibleRect.height <= 0) return undefined
    const worldOverscan = overscan / viewport.transform.zoom
    const retainedRect = insetCanvasRect(this.worldRect, worldOverscan * retentionRatio)
    if (!force && canvasRectContains(retainedRect, visibleRect)) return undefined
    this.worldRect = insetCanvasRect(visibleRect, -worldOverscan)
    return this.worldRect
  }
}
