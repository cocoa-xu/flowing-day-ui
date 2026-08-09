export interface FdGraphHistoryCapabilities {
  readonly localUndoRedo?: boolean
  readonly collaborativeUndoRedo?: boolean
  readonly conflictFeedback?: boolean
}

export interface FdGraphHistoryConfiguration {
  readonly enabled?: boolean
  readonly maximumDepth?: number
  readonly capabilities?: FdGraphHistoryCapabilities
}

export interface FdResolvedGraphHistoryConfiguration {
  readonly enabled: boolean
  readonly maximumDepth: number
  readonly capabilities: Required<FdGraphHistoryCapabilities>
}

export type FdGraphHistoryExecutionMode = 'local' | 'collaborative'
export type FdGraphHistoryDirection = 'undo' | 'redo'

export interface FdGraphHistoryTransaction<Change> {
  readonly id: string
  readonly actionName: string
  readonly mode: FdGraphHistoryExecutionMode
  readonly undoChange: Change
  readonly redoChange: Change
}

export type FdGraphHistoryApplyResult<Change, Failure> =
  | { readonly kind: 'applied' }
  | { readonly kind: 'appliedWithReciprocal'; readonly reciprocal: Change }
  | { readonly kind: 'rejected'; readonly failure: Failure }

export interface FdGraphHistoryConflict<Change, Failure> {
  readonly transactionID: string
  readonly actionName: string
  readonly direction: FdGraphHistoryDirection
  readonly change: Change
  readonly failure: Failure
}

export interface FdGraphHistoryState {
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly undoActionName?: string
  readonly redoActionName?: string
  readonly isApplying: boolean
}

export function resolveGraphHistoryConfiguration(
  configuration: FdGraphHistoryConfiguration = {},
): FdResolvedGraphHistoryConfiguration {
  const maximumDepth = configuration.maximumDepth ?? 100
  if (!Number.isInteger(maximumDepth) || maximumDepth <= 0) {
    throw new RangeError('history maximum depth must be a positive integer')
  }
  return {
    enabled: configuration.enabled ?? true,
    maximumDepth,
    capabilities: {
      localUndoRedo: configuration.capabilities?.localUndoRedo ?? true,
      collaborativeUndoRedo: configuration.capabilities?.collaborativeUndoRedo ?? true,
      conflictFeedback: configuration.capabilities?.conflictFeedback ?? true,
    },
  }
}
