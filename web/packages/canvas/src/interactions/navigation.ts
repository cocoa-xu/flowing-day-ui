import type { FdGraphCanvasJumpSelectionBehavior } from './session.js'

export interface FdGraphCanvasJumpToElementOptions {
  readonly selection?: FdGraphCanvasJumpSelectionBehavior
  readonly zoom?: number
  readonly animated?: boolean
}
