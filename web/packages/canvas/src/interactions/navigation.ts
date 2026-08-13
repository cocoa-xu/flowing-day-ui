export type FdGraphCanvasJumpSelectionBehavior = 'preserve' | 'replace' | 'add'

export interface FdGraphCanvasJumpToElementOptions {
  readonly selection?: FdGraphCanvasJumpSelectionBehavior
  readonly zoom?: number
  readonly animated?: boolean
}
