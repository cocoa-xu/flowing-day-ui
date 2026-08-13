import type { FdCanvasPoint } from '../geometry.js'

export class FdGraphCanvasAnchor {
  readonly position: FdCanvasPoint
  readonly normal: { readonly dx: number; readonly dy: number }

  constructor(
    position: FdCanvasPoint,
    normal: { readonly dx: number; readonly dy: number } = { dx: 0, dy: 0 },
  ) {
    this.position = position
    this.normal = normal
  }
}

export class FdGraphCanvasEdgeAnchors {
  readonly first: FdGraphCanvasAnchor
  readonly second: FdGraphCanvasAnchor
  readonly isDirected: boolean

  constructor(first: FdGraphCanvasAnchor, second: FdGraphCanvasAnchor, isDirected: boolean) {
    this.first = first
    this.second = second
    this.isDirected = isDirected
  }
}
