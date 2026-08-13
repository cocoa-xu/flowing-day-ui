import type {
  FdGraphHistoryApplyResult,
  FdGraphHistoryConfiguration,
  FdGraphHistoryConflict,
  FdGraphHistoryDirection,
  FdGraphHistoryState,
  FdGraphHistoryTransaction,
  FdResolvedGraphHistoryConfiguration,
} from './model.js'
import { resolveGraphHistoryConfiguration } from './model.js'

export type FdGraphHistoryApply<Change, Failure> = (
  change: Change,
  direction: FdGraphHistoryDirection,
) =>
  | FdGraphHistoryApplyResult<Change, Failure>
  | Promise<FdGraphHistoryApplyResult<Change, Failure>>

export interface FdGraphHistoryDriverOptions<Change, Failure> {
  readonly configuration?: FdGraphHistoryConfiguration
  readonly apply: FdGraphHistoryApply<Change, Failure>
  readonly onConflict?: (conflict: FdGraphHistoryConflict<Change, Failure>) => void
  readonly onStateChange?: (state: FdGraphHistoryState) => void
}

interface FdGraphHistoryEntry<Change> {
  readonly transactionID: string
  readonly actionName: string
  readonly change: Change
  readonly reciprocal: Change
}

export class FdGraphHistoryDriver<Change, Failure> {
  readonly configuration: FdResolvedGraphHistoryConfiguration
  private readonly undoStack: FdGraphHistoryEntry<Change>[] = []
  private readonly redoStack: FdGraphHistoryEntry<Change>[] = []
  private readonly apply: FdGraphHistoryApply<Change, Failure>
  private readonly onConflict: (conflict: FdGraphHistoryConflict<Change, Failure>) => void
  private readonly onStateChange: (state: FdGraphHistoryState) => void
  private applying = false
  private registrationRevision = 0

  constructor(options: FdGraphHistoryDriverOptions<Change, Failure>) {
    this.configuration = resolveGraphHistoryConfiguration(options.configuration)
    this.apply = options.apply
    this.onConflict = options.onConflict ?? (() => undefined)
    this.onStateChange = options.onStateChange ?? (() => undefined)
  }

  get canUndo(): boolean {
    return !this.applying && this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return !this.applying && this.redoStack.length > 0
  }

  get undoActionName(): string | undefined {
    return this.undoStack.at(-1)?.actionName
  }

  get redoActionName(): string | undefined {
    return this.redoStack.at(-1)?.actionName
  }

  get isApplying(): boolean {
    return this.applying
  }

  get state(): FdGraphHistoryState {
    return {
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      ...(this.undoActionName ? { undoActionName: this.undoActionName } : {}),
      ...(this.redoActionName ? { redoActionName: this.redoActionName } : {}),
      isApplying: this.applying,
    }
  }

  register(transaction: FdGraphHistoryTransaction<Change>): void {
    if (!this.allows(transaction.mode)) return
    if (!transaction.id.trim()) throw new RangeError('history transaction ID must not be empty')
    this.registrationRevision += 1
    this.undoStack.push({
      transactionID: transaction.id,
      actionName: transaction.actionName,
      change: transaction.undoChange,
      reciprocal: transaction.redoChange,
    })
    this.redoStack.length = 0
    this.notifyStateChange()
  }

  async undo(): Promise<boolean> {
    return this.perform(this.undoStack, this.redoStack, 'undo')
  }

  async redo(): Promise<boolean> {
    return this.perform(this.redoStack, this.undoStack, 'redo')
  }

  removeAllActions(): void {
    this.registrationRevision += 1
    this.undoStack.length = 0
    this.redoStack.length = 0
    this.notifyStateChange()
  }

  private async perform(
    source: FdGraphHistoryEntry<Change>[],
    destination: FdGraphHistoryEntry<Change>[],
    direction: FdGraphHistoryDirection,
  ): Promise<boolean> {
    if (this.applying) return false
    const entry = source.pop()
    if (!entry) return false
    const revision = this.registrationRevision
    this.applying = true
    this.notifyStateChange()
    let result: FdGraphHistoryApplyResult<Change, Failure>
    try {
      result = await this.apply(entry.change, direction)
    } catch (error) {
      this.applying = false
      this.notifyStateChange()
      throw error
    }
    this.applying = false
    if (result.kind === 'rejected') {
      if (this.configuration.capabilities.conflictFeedback) {
        this.onConflict({
          transactionID: entry.transactionID,
          actionName: entry.actionName,
          direction,
          change: entry.change,
          failure: result.failure,
        })
      }
      this.notifyStateChange()
      return false
    }
    if (revision === this.registrationRevision) {
      destination.push({
        transactionID: entry.transactionID,
        actionName: entry.actionName,
        change: result.kind === 'appliedWithReciprocal' ? result.reciprocal : entry.reciprocal,
        reciprocal: entry.change,
      })
    }
    this.notifyStateChange()
    return true
  }

  private allows(mode: FdGraphHistoryTransaction<Change>['mode']): boolean {
    if (!this.configuration.enabled) return false
    return mode === 'local'
      ? this.configuration.capabilities.localUndoRedo
      : this.configuration.capabilities.collaborativeUndoRedo
  }

  private notifyStateChange(): void {
    this.onStateChange(this.state)
  }
}
