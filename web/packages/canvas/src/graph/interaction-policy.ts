import type { FdCanvasRect } from '../geometry.js'
import type { FdGraphResizeHandle, FdGraphSnappingStrategy } from '../interactions/arrangement.js'
import type {
  FdGraphNodeInteractionAdmission,
  FdGraphNodeSizeConstraints,
} from '../interactions/configuration.js'
import type {
  FdGraphConnectionOrigin,
  FdGraphConnectionValidation,
  FdGraphConnectionValidationRequest,
} from '../interactions/connection.js'
import type { FdGraphElementID } from './model.js'

export type FdGraphCanvasInteractionModifier =
  | 'constrainDragAxis'
  | 'preserveResizeAspectRatio'
  | 'resizeFromCenter'
  | 'disableSnapping'
  | 'largeKeyboardNudge'

export interface FdGraphCanvasNodeCapabilities {
  readonly draggable?: boolean
  readonly arrangementParticipant?: boolean
  readonly keyboardNavigable?: boolean
  readonly resizable?: boolean
}

export interface FdGraphCanvasNodeCapabilityMap {
  readonly defaultCapabilities?: FdGraphCanvasNodeCapabilities
  readonly overrides?: ReadonlyMap<FdGraphElementID, FdGraphCanvasNodeCapabilities>
}

export interface FdGraphCanvasNodeSizeConstraintMap {
  readonly defaultConstraints?: FdGraphNodeSizeConstraints
  readonly overrides?: ReadonlyMap<FdGraphElementID, FdGraphNodeSizeConstraints>
}

export interface FdGraphCanvasNodeDragAdmissionRequest {
  readonly anchorNodeID: FdGraphElementID
  readonly selectedNodeIDs: readonly FdGraphElementID[]
  readonly candidateNodeIDs: readonly FdGraphElementID[]
  readonly basePresentationSnapshotID: string | number
}

export interface FdGraphCanvasNodeResizeAdmissionRequest
  extends FdGraphCanvasNodeDragAdmissionRequest {
  readonly baseFrames: ReadonlyMap<FdGraphElementID, FdCanvasRect>
  readonly edges: FdGraphResizeHandle
}

export interface FdGraphCanvasConnectionPolicy {
  readonly canBegin?: (origin: FdGraphConnectionOrigin) => boolean
  readonly validate?: (request: FdGraphConnectionValidationRequest) => FdGraphConnectionValidation
}

export interface FdGraphCanvasInteractionPolicy {
  readonly nodeCapabilities?: FdGraphCanvasNodeCapabilityMap
  readonly nodeSizeConstraints?: FdGraphCanvasNodeSizeConstraintMap
  readonly snappingStrategy?: FdGraphSnappingStrategy
  readonly connectionPolicy?: FdGraphCanvasConnectionPolicy
  readonly admitNodeDrag?: (
    request: FdGraphCanvasNodeDragAdmissionRequest,
  ) => FdGraphNodeInteractionAdmission
  readonly admitNodeResize?: (
    request: FdGraphCanvasNodeResizeAdmissionRequest,
  ) => FdGraphNodeInteractionAdmission
  readonly isAdditiveSelectionActive?: () => boolean
  readonly interactionModifiers?: () => ReadonlySet<FdGraphCanvasInteractionModifier>
}

export function graphCanvasNodeCapabilities(
  policy: FdGraphCanvasInteractionPolicy,
  nodeID: FdGraphElementID,
): Required<FdGraphCanvasNodeCapabilities> {
  const capabilities =
    policy.nodeCapabilities?.overrides?.get(nodeID) ??
    policy.nodeCapabilities?.defaultCapabilities ??
    {}
  return {
    draggable: capabilities.draggable ?? true,
    arrangementParticipant: capabilities.arrangementParticipant ?? true,
    keyboardNavigable: capabilities.keyboardNavigable ?? true,
    resizable: capabilities.resizable ?? true,
  }
}

export function graphCanvasNodeSizeConstraints(
  policy: FdGraphCanvasInteractionPolicy,
  nodeID: FdGraphElementID,
): FdGraphNodeSizeConstraints | undefined {
  return (
    policy.nodeSizeConstraints?.overrides?.get(nodeID) ??
    policy.nodeSizeConstraints?.defaultConstraints
  )
}
