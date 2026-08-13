import type { FdCanvasPoint, FdCanvasRect } from '../geometry.js'
import type { FdGraphElementID } from '../graph/model.js'

export type FdGraphMiniMapSnapshotID = string | number

export interface FdGraphMiniMapNode<
  NodeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly id: NodeID
  readonly frame: FdCanvasRect
}

export interface FdGraphMiniMapEdge<
  EdgeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly id: EdgeID
  readonly start: FdCanvasPoint
  readonly end: FdCanvasPoint
}

export interface FdGraphMiniMapChangeSet<
  NodeID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly baseSnapshotID: FdGraphMiniMapSnapshotID
  readonly insertedNodes?: readonly FdGraphMiniMapNode<NodeID>[]
  readonly updatedNodes?: readonly FdGraphMiniMapNode<NodeID>[]
  readonly removedNodeIDs?: ReadonlySet<NodeID>
  readonly insertedEdges?: readonly FdGraphMiniMapEdge<EdgeID>[]
  readonly updatedEdges?: readonly FdGraphMiniMapEdge<EdgeID>[]
  readonly removedEdgeIDs?: ReadonlySet<EdgeID>
  readonly orderingChanged?: boolean
  readonly contentBoundsChanged?: boolean
}

export interface FdGraphMiniMapSnapshot<
  NodeID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly id: FdGraphMiniMapSnapshotID
  readonly contentBounds: FdCanvasRect
  readonly nodes: readonly FdGraphMiniMapNode<NodeID>[]
  readonly edges: readonly FdGraphMiniMapEdge<EdgeID>[]
  readonly changeSet?: FdGraphMiniMapChangeSet<NodeID, EdgeID>
}

export type FdAnyGraphMiniMapNode = FdGraphMiniMapNode<FdGraphElementID>
export type FdAnyGraphMiniMapSnapshot = FdGraphMiniMapSnapshot<
  FdGraphElementID,
  FdGraphElementID
>
