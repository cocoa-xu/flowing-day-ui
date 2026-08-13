import type { FdCanvasRect, FdCanvasSize } from '../geometry.js'
import type { FdGraphCanvasSnappingStrategy } from '../interactions/arrangement.js'
import type {
  FdGraphCanvasConnectionOrigin,
  FdGraphCanvasConnectionValidation,
  FdGraphCanvasConnectionValidationRequest,
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

export interface FdGraphCanvasNodeSizeConstraints {
  readonly minimumSize?: FdCanvasSize
  readonly maximumSize?: FdCanvasSize
}

export interface FdGraphCanvasNodeSizeConstraintMap {
  readonly defaultConstraints?: FdGraphCanvasNodeSizeConstraints
  readonly overrides?: ReadonlyMap<FdGraphElementID, FdGraphCanvasNodeSizeConstraints>
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
  readonly edges: FdGraphCanvasResizeEdges
}

export type FdGraphCanvasNodeDragAdmission =
  | { readonly kind: 'deny' }
  | { readonly kind: 'allowAll' }
  | { readonly kind: 'allowOnly'; readonly nodeIDs: ReadonlySet<FdGraphElementID> }

export type FdGraphCanvasNodeResizeAdmission =
  | { readonly kind: 'deny' }
  | { readonly kind: 'allowAll' }
  | { readonly kind: 'allowOnly'; readonly nodeIDs: ReadonlySet<FdGraphElementID> }

export type FdGraphCanvasResizeEdge = 'leading' | 'trailing' | 'top' | 'bottom'
export type FdGraphCanvasResizeEdges = ReadonlySet<FdGraphCanvasResizeEdge>

export interface FdGraphCanvasConnectionPolicy {
  readonly canBegin?: (origin: FdGraphCanvasConnectionOrigin) => boolean
  readonly validate?: (
    request: FdGraphCanvasConnectionValidationRequest,
  ) => FdGraphCanvasConnectionValidation
}

export interface FdGraphCanvasInteractionPolicy {
  readonly nodeCapabilities?: FdGraphCanvasNodeCapabilityMap
  readonly nodeSizeConstraints?: FdGraphCanvasNodeSizeConstraintMap
  readonly snappingStrategy?: FdGraphCanvasSnappingStrategy
  readonly connectionPolicy?: FdGraphCanvasConnectionPolicy
  readonly admitNodeDrag?: (
    request: FdGraphCanvasNodeDragAdmissionRequest,
  ) => FdGraphCanvasNodeDragAdmission
  readonly admitNodeResize?: (
    request: FdGraphCanvasNodeResizeAdmissionRequest,
  ) => FdGraphCanvasNodeResizeAdmission
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
): FdGraphCanvasNodeSizeConstraints | undefined {
  return (
    policy.nodeSizeConstraints?.overrides?.get(nodeID) ??
    policy.nodeSizeConstraints?.defaultConstraints
  )
}
