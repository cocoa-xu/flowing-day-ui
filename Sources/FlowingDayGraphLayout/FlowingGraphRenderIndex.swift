import CoreGraphics
import Foundation

public struct FlowingGraphRenderIndexConfiguration: Sendable, Equatable {
  public let nodeIndex: FlowingSpatialIndexConfiguration
  public let edgeLeafCapacity: Int
  public let edgeCullingMargin: CGFloat

  public init(
    nodeIndex: FlowingSpatialIndexConfiguration = .init(),
    edgeLeafCapacity: Int = 8,
    edgeCullingMargin: CGFloat = 12
  ) {
    precondition(edgeLeafCapacity > 0)
    precondition(edgeCullingMargin >= 0 && edgeCullingMargin.isFinite)
    self.nodeIndex = nodeIndex
    self.edgeLeafCapacity = edgeLeafCapacity
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

public struct FlowingGraphRenderElementIDs<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let inputID: FlowingLayoutInputID
  public let nodeIDs: [Schema.NodeID]
  public let edgeIDs: [Schema.EdgeID]

  public init(
    inputID: FlowingLayoutInputID,
    nodeIDs: [Schema.NodeID],
    edgeIDs: [Schema.EdgeID]
  ) {
    self.inputID = inputID
    self.nodeIDs = nodeIDs
    self.edgeIDs = edgeIDs
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
  private let edgeIndex: FlowingBoundsIndex<Schema.EdgeID>

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
    edgeIndex = try FlowingBoundsIndex(
      entries: result.edgeRoutes.map {
        FlowingSpatialIndexEntry(
          id: $0.edgeID,
          frame: $0.route.conservativeBounds.insetBy(
            dx: -configuration.edgeCullingMargin,
            dy: -configuration.edgeCullingMargin
          )
        )
      },
      leafCapacity: configuration.edgeLeafCapacity
    )
  }

  public func slice(intersecting rect: CGRect) -> FlowingGraphRenderSlice<Schema> {
    let elementIDs = elementIDs(intersecting: rect)
    return FlowingGraphRenderSlice(
      inputID: inputID,
      nodeIDs: elementIDs.nodeIDs,
      edgeIDs: elementIDs.edgeIDs,
      nodeFrames: elementIDs.nodeIDs.compactMap { nodeID in
        result.frame(for: nodeID).map {
          FlowingGraphNodeFrame(nodeID: nodeID, frame: $0)
        }
      },
      edgeRoutes: elementIDs.edgeIDs.compactMap { edgeID in
        result.route(for: edgeID).map {
          FlowingGraphLayoutEdgeRoute(edgeID: edgeID, route: $0)
        }
      }
    )
  }

  public func elementIDs(
    intersecting rect: CGRect
  ) -> FlowingGraphRenderElementIDs<Schema> {
    FlowingGraphRenderElementIDs(
      inputID: inputID,
      nodeIDs: nodeIndex.itemIDs(intersecting: rect),
      edgeIDs: edgeIndex.itemIDs(intersecting: rect)
    )
  }

  public func nearestNodeID(
    to point: CGPoint,
    excluding excludedIDs: Set<Schema.NodeID> = []
  ) -> Schema.NodeID? {
    nodeIndex.nearestItemID(to: point, excluding: excludedIDs)
  }
}
