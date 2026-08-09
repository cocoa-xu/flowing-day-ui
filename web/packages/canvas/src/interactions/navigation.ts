export type FdGraphJumpSelectionBehavior = 'preserve' | 'replace' | 'add'

export interface FdGraphJumpToElementOptions {
  readonly selection?: FdGraphJumpSelectionBehavior
  readonly zoom?: number
  readonly animated?: boolean
}
