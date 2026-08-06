import CoreGraphics
import Foundation

public protocol FlowingGraphNodeSizeResolver<Schema>: Sendable {
  associatedtype Schema: FlowingGraphLayoutSchema

  var identity: FlowingLayoutComponentIdentity { get }

  func size(for nodeID: Schema.NodeID) throws -> CGSize
}

public protocol FlowingGraphPortAnchorResolver<Schema>: Sendable {
  associatedtype Schema: FlowingGraphLayoutSchema

  var identity: FlowingLayoutComponentIdentity { get }

  func anchor(
    for port: FlowingGraphLayoutPort<Schema>,
    nodeSize: CGSize
  ) throws -> FlowingGraphPortAnchor<Schema>
}

public struct FlowingFixedNodeSizeResolver<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let identity: FlowingLayoutComponentIdentity
  public let size: CGSize

  public init(
    size: CGSize,
    identity: FlowingLayoutComponentIdentity = .init()
  ) {
    self.size = size
    self.identity = identity
  }
}

extension FlowingFixedNodeSizeResolver: FlowingGraphNodeSizeResolver {
  public func size(for nodeID: Schema.NodeID) throws -> CGSize {
    size
  }
}

public struct FlowingCenteredPortAnchorResolver<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let identity: FlowingLayoutComponentIdentity

  public init(identity: FlowingLayoutComponentIdentity = .init()) {
    self.identity = identity
  }
}

extension FlowingCenteredPortAnchorResolver: FlowingGraphPortAnchorResolver {
  public func anchor(
    for port: FlowingGraphLayoutPort<Schema>,
    nodeSize: CGSize
  ) throws -> FlowingGraphPortAnchor<Schema> {
    FlowingGraphPortAnchor(
      key: port.key,
      position: CGPoint(x: nodeSize.width / 2, y: nodeSize.height / 2),
      normal: .zero
    )
  }
}

public enum FlowingGraphLayoutResolution {
  public static func input<
    Schema: FlowingGraphLayoutSchema,
    NodeSizeResolver: FlowingGraphNodeSizeResolver<Schema>,
    PortAnchorResolver: FlowingGraphPortAnchorResolver<Schema>
  >(
    topology: FlowingGraphLayoutTopology<Schema>,
    nodeSizeResolver: NodeSizeResolver,
    portAnchorResolver: PortAnchorResolver,
    pipelineIdentity: FlowingLayoutPipelineIdentity,
    layoutStateRevision: FlowingLayoutRevision = .init(),
    placementState: [FlowingGraphNodePlacementState<Schema>] = []
  ) throws -> FlowingGraphLayoutInput<Schema> {
    var sizes: [FlowingGraphLayoutNodeSize<Schema>] = []
    sizes.reserveCapacity(topology.nodeIDs.count)
    var sizeByNodeID: [Schema.NodeID: CGSize] = [:]
    sizeByNodeID.reserveCapacity(topology.nodeIDs.count)
    for nodeID in topology.nodeIDs {
      try Task.checkCancellation()
      let size = try nodeSizeResolver.size(for: nodeID)
      sizes.append(FlowingGraphLayoutNodeSize(nodeID: nodeID, size: size))
      sizeByNodeID[nodeID] = size
    }

    var anchors: [FlowingGraphPortAnchor<Schema>] = []
    anchors.reserveCapacity(topology.ports.count)
    for port in topology.ports {
      try Task.checkCancellation()
      anchors.append(
        try portAnchorResolver.anchor(
          for: port,
          nodeSize: sizeByNodeID[port.nodeID]!
        )
      )
    }

    return try FlowingGraphLayoutInput(
      id: FlowingLayoutInputID(
        presentationSnapshotID: topology.snapshotID,
        pipelineIdentity: pipelineIdentity,
        nodeSizeRevision: nodeSizeResolver.identity,
        portAnchorRevision: portAnchorResolver.identity,
        layoutStateRevision: layoutStateRevision
      ),
      topology: topology,
      nodeSizes: sizes,
      portAnchors: anchors,
      placementState: placementState
    )
  }
}

public enum FlowingGraphLayoutDriverOutcome<Schema: FlowingGraphLayoutSchema>: Sendable {
  case completed(FlowingGraphLayoutResult<Schema>)
  case superseded
}

public enum FlowingGraphLayoutDriverError: Error, Equatable {
  case resultIdentityMismatch
}

public actor FlowingGraphLayoutDriver<Schema: FlowingGraphLayoutSchema> {
  private var requestID: UUID?
  private var task: Task<FlowingGraphLayoutResult<Schema>, any Error>?

  public init() {}

  public func layout<
    NodeSizeResolver: FlowingGraphNodeSizeResolver<Schema>,
    PortAnchorResolver: FlowingGraphPortAnchorResolver<Schema>,
    Strategy: FlowingGraphLayoutStrategy<Schema>
  >(
    topology: FlowingGraphLayoutTopology<Schema>,
    nodeSizeResolver: NodeSizeResolver,
    portAnchorResolver: PortAnchorResolver,
    layoutStateRevision: FlowingLayoutRevision = .init(),
    placementState: [FlowingGraphNodePlacementState<Schema>] = [],
    strategy: Strategy,
    priority: TaskPriority? = nil
  ) async throws -> FlowingGraphLayoutDriverOutcome<Schema> {
    task?.cancel()
    let nextRequestID = UUID()
    requestID = nextRequestID
    let nextTask = Task.detached(priority: priority) {
      let input = try FlowingGraphLayoutResolution.input(
        topology: topology,
        nodeSizeResolver: nodeSizeResolver,
        portAnchorResolver: portAnchorResolver,
        pipelineIdentity: strategy.identity,
        layoutStateRevision: layoutStateRevision,
        placementState: placementState
      )
      let result = try strategy.layout(input)
      guard result.inputID == input.id else {
        throw FlowingGraphLayoutDriverError.resultIdentityMismatch
      }
      return result
    }
    task = nextTask

    do {
      let result = try await withTaskCancellationHandler {
        try await nextTask.value
      } onCancel: {
        nextTask.cancel()
      }
      guard requestID == nextRequestID else { return .superseded }
      task = nil
      return .completed(result)
    } catch is CancellationError where requestID != nextRequestID {
      return .superseded
    } catch {
      if requestID == nextRequestID {
        task = nil
      }
      throw error
    }
  }

  public func cancel() {
    requestID = nil
    task?.cancel()
    task = nil
  }
}
