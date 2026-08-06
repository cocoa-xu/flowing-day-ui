import CoreGraphics
import Foundation

public struct FlowingGraphRenderIndexConfiguration: Sendable, Equatable {
  public let nodeIndex: FlowingSpatialIndexConfiguration
  public let edgeIndex: FlowingSpatialIndexConfiguration
  public let edgeCullingMargin: CGFloat

  public init(
    nodeIndex: FlowingSpatialIndexConfiguration = .init(),
    edgeIndex: FlowingSpatialIndexConfiguration = .init(
      maximumCellsPerItem: 65_536
    ),
    edgeCullingMargin: CGFloat = 12
  ) {
    precondition(edgeCullingMargin >= 0 && edgeCullingMargin.isFinite)
    self.nodeIndex = nodeIndex
    self.edgeIndex = edgeIndex
    self.edgeCullingMargin = edgeCullingMargin
  }
}

public struct FlowingGraphRenderSlice<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let inputID: FlowingLayoutInputID
  public let nodeIDs: [Schema.NodeID]
  public let edgeIDs: [Schema.EdgeID]
  public let nodeFrames: [FlowingGraphNodeFrame<Schema>]
  public let edgeRoutes: [FlowingGraphLayoutEdgeRoute<Schema>]

  public init(
    inputID: FlowingLayoutInputID,
    nodeIDs: [Schema.NodeID],
    edgeIDs: [Schema.EdgeID],
    nodeFrames: [FlowingGraphNodeFrame<Schema>],
    edgeRoutes: [FlowingGraphLayoutEdgeRoute<Schema>]
  ) {
    self.inputID = inputID
    self.nodeIDs = nodeIDs
    self.edgeIDs = edgeIDs
    self.nodeFrames = nodeFrames
    self.edgeRoutes = edgeRoutes
  }
}

public enum FlowingGraphRenderIndexIssue: Error, Equatable {
  case inputIdentityMismatch
}

public struct FlowingGraphRenderIndex<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let inputID: FlowingLayoutInputID
  public let configuration: FlowingGraphRenderIndexConfiguration

  private let result: FlowingGraphLayoutResult<Schema>
  private let nodeIndex: FlowingSpatialIndex<Schema.NodeID>
  private let edgeIndex: FlowingSpatialIndex<Schema.EdgeID>

  public init(
    input: FlowingGraphLayoutInput<Schema>,
    result: FlowingGraphLayoutResult<Schema>,
    configuration: FlowingGraphRenderIndexConfiguration = .init()
  ) throws {
    guard input.id == result.inputID else {
      throw FlowingGraphRenderIndexIssue.inputIdentityMismatch
    }
    self.result = result
    self.configuration = configuration
    inputID = input.id
    nodeIndex = try FlowingSpatialIndex(
      entries: result.nodeFrames.map {
        FlowingSpatialIndexEntry(id: $0.nodeID, frame: $0.frame)
      },
      configuration: configuration.nodeIndex
    )
    edgeIndex = try FlowingSpatialIndex(
      entries: result.edgeRoutes.map {
        FlowingSpatialIndexEntry(
          id: $0.edgeID,
          frame: $0.route.conservativeBounds.insetBy(
            dx: -configuration.edgeCullingMargin,
            dy: -configuration.edgeCullingMargin
          )
        )
      },
      configuration: configuration.edgeIndex
    )
  }

  public func slice(intersecting rect: CGRect) -> FlowingGraphRenderSlice<Schema> {
    let nodeIDs = nodeIndex.itemIDs(intersecting: rect)
    let edgeIDs = edgeIndex.itemIDs(intersecting: rect)
    return FlowingGraphRenderSlice(
      inputID: inputID,
      nodeIDs: nodeIDs,
      edgeIDs: edgeIDs,
      nodeFrames: nodeIDs.compactMap { nodeID in
        result.frame(for: nodeID).map {
          FlowingGraphNodeFrame(nodeID: nodeID, frame: $0)
        }
      },
      edgeRoutes: edgeIDs.compactMap { edgeID in
        result.route(for: edgeID).map {
          FlowingGraphLayoutEdgeRoute(edgeID: edgeID, route: $0)
        }
      }
    )
  }

  public func nearestNodeID(
    to point: CGPoint,
    excluding excludedIDs: Set<Schema.NodeID> = []
  ) -> Schema.NodeID? {
    nodeIndex.nearestItemID(to: point, excluding: excludedIDs)
  }
}
