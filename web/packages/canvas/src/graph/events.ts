import type { FdCanvasRect } from '../geometry.js'
import type {
  FdGraphConnectionCancellationReason,
  FdGraphConnectionOperation,
  FdGraphConnectionOrigin,
  FdGraphTransientConnection,
} from '../interactions/connection.js'
import type { FdGraphElementID } from './model.js'

export type FdGraphInteractionPhase = 'continuous' | 'ended'
export type FdGraphSelectionSource = 'pointer' | 'keyboard' | 'accessibility' | 'programmatic'
export type FdGraphNodeFrameChangeKind = 'drag' | 'resize' | 'keyboard' | 'history'
export type FdGraphFocusSource = 'pointer' | 'keyboard' | 'accessibility' | 'programmatic'

export interface FdGraphSelectionChangeDetail {
  readonly selectedNodeIDs: ReadonlySet<FdGraphElementID>
  readonly phase: FdGraphInteractionPhase
  readonly source: FdGraphSelectionSource
}

export interface FdGraphNodeFrameChange {
  readonly nodeID: FdGraphElementID
  readonly before: FdCanvasRect
  readonly after: FdCanvasRect
}

export interface FdGraphNodeFramesChangeDetail {
  readonly transactionID: string
  readonly snapshotID: string | number
  readonly kind: FdGraphNodeFrameChangeKind
  readonly phase: FdGraphInteractionPhase
  readonly changes: readonly FdGraphNodeFrameChange[]
}

export interface FdGraphFocusChangeDetail {
  readonly focusedNodeID?: FdGraphElementID
  readonly source: FdGraphFocusSource
}

export interface FdGraphNodeActivateDetail {
  readonly nodeID: FdGraphElementID
  readonly source: 'keyboard' | 'accessibility'
}

export interface FdGraphConnectionPreviewChangeDetail {
  readonly connection?: FdGraphTransientConnection
}

export interface FdGraphConnectionCompleteDetail {
  readonly snapshotID: string | number
  readonly origin: FdGraphConnectionOrigin
  readonly operation: FdGraphConnectionOperation
}

export interface FdGraphConnectionCancelDetail {
  readonly snapshotID: string | number
  readonly origin: FdGraphConnectionOrigin
  readonly reason: FdGraphConnectionCancellationReason
}

declare global {
  interface HTMLElementEventMap {
    'fd-graph-selection-change': CustomEvent<FdGraphSelectionChangeDetail>
    'fd-graph-node-frames-change': CustomEvent<FdGraphNodeFramesChangeDetail>
    'fd-graph-focus-change': CustomEvent<FdGraphFocusChangeDetail>
    'fd-graph-node-activate': CustomEvent<FdGraphNodeActivateDetail>
    'fd-graph-connection-preview-change': CustomEvent<FdGraphConnectionPreviewChangeDetail>
    'fd-graph-connection-complete': CustomEvent<FdGraphConnectionCompleteDetail>
    'fd-graph-connection-cancel': CustomEvent<FdGraphConnectionCancelDetail>
  }
}
