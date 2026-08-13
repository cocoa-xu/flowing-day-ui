export interface FdGraphHistoryCapabilities {
  readonly localUndoRedo?: boolean
  readonly collaborativeUndoRedo?: boolean
  readonly conflictFeedback?: boolean
}

export interface FdGraphHistoryConfiguration {
  readonly capabilities?: FdGraphHistoryCapabilities
}

export interface FdResolvedGraphHistoryConfiguration {
  readonly enabled: boolean
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
  const capabilities = {
    localUndoRedo: configuration.capabilities?.localUndoRedo ?? true,
    collaborativeUndoRedo: configuration.capabilities?.collaborativeUndoRedo ?? true,
    conflictFeedback: configuration.capabilities?.conflictFeedback ?? true,
  }
  return {
    enabled: Object.values(capabilities).some(Boolean),
    capabilities,
  }
}
