import type { FdGraphNodeFrameChange } from '../graph/events.js'
import type { FdGraphHistoryConflict, FdGraphHistoryState } from './model.js'

export type FdGraphCanvasHistoryFailure =
  | { readonly kind: 'staleNodeFrame'; readonly nodeID: string | number }
  | { readonly kind: 'consumerFailure'; readonly error: unknown }
  | { readonly kind: 'consumerRejected'; readonly failure: unknown }

export type FdGraphCanvasHistoryConflictDetail = FdGraphHistoryConflict<
  readonly FdGraphNodeFrameChange[],
  FdGraphCanvasHistoryFailure
>

export type FdGraphCanvasHistoryStateDetail = FdGraphHistoryState

declare global {
  interface HTMLElementEventMap {
    'fd-graph-history-conflict': CustomEvent<FdGraphCanvasHistoryConflictDetail>
    'fd-graph-history-state-change': CustomEvent<FdGraphCanvasHistoryStateDetail>
  }
}
