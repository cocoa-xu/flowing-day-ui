import CoreGraphics
import Foundation

public struct FlowingGraphNodeFrame<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let nodeID: Schema.NodeID
  public let frame: CGRect

  public init(nodeID: Schema.NodeID, frame: CGRect) {
    self.nodeID = nodeID
    self.frame = frame
  }
}

extension FlowingGraphNodeFrame: Equatable {}

public enum FlowingGraphEdgePathSegment: Sendable, Equatable {
  case line(end: CGPoint)
  case quadratic(control: CGPoint, end: CGPoint)
  case cubic(control1: CGPoint, control2: CGPoint, end: CGPoint)
}

public struct FlowingGraphEdgeRoute: Sendable, Equatable {
  public let start: CGPoint
  public let segments: [FlowingGraphEdgePathSegment]

  public init(start: CGPoint, segments: [FlowingGraphEdgePathSegment]) {
    self.start = start
    self.segments = segments
  }

  public var conservativeBounds: CGRect {
    var points = [start]
    for segment in segments {
      switch segment {
      case let .line(end):
        points.append(end)
      case let .quadratic(control, end):
        points.append(contentsOf: [control, end])
      case let .cubic(control1, control2, end):
        points.append(contentsOf: [control1, control2, end])
      }
    }
    guard let first = points.first else { return .null }
    return points.dropFirst().reduce(CGRect(origin: first, size: .zero)) { bounds, point in
      bounds.union(CGRect(origin: point, size: .zero))
    }
  }
}

public struct FlowingGraphLayoutEdgeRoute<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let edgeID: Schema.EdgeID
  public let route: FlowingGraphEdgeRoute

  public init(edgeID: Schema.EdgeID, route: FlowingGraphEdgeRoute) {
    self.edgeID = edgeID
    self.route = route
  }
}

extension FlowingGraphLayoutEdgeRoute: Equatable {}

public struct FlowingGraphResolvedPortAnchor<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let portID: Schema.PortID
  public let position: CGPoint
  public let normal: CGVector

  public init(portID: Schema.PortID, position: CGPoint, normal: CGVector) {
    self.portID = portID
    self.position = position
    self.normal = normal
  }
}

extension FlowingGraphResolvedPortAnchor: Equatable {}

public enum FlowingGraphNodePlacementIssue<Schema: FlowingGraphLayoutSchema>: Error {
  case duplicateNodeFrame(Schema.NodeID)
  case missingNodeFrame(Schema.NodeID)
  case unknownNodeFrame(Schema.NodeID)
  case invalidNodeFrame(Schema.NodeID)
  case nodeFrameSizeMismatch(Schema.NodeID)
  case invalidContentBounds
  case contentBoundsExcludeNode(Schema.NodeID)
}

extension FlowingGraphNodePlacementIssue: Equatable {}

public struct FlowingGraphNodePlacement<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let nodeFrames: [FlowingGraphNodeFrame<Schema>]
  public let contentBounds: CGRect

  private let frameByNodeID: [Schema.NodeID: CGRect]

  public init(
    input: FlowingGraphLayoutInput<Schema>,
    nodeFrames: [FlowingGraphNodeFrame<Schema>],
    contentBounds: CGRect
  ) throws {
    let knownNodeIDs = Set(input.topology.nodeIDs)
    var nextFrameByNodeID: [Schema.NodeID: CGRect] = [:]
    for entry in nodeFrames {
      guard knownNodeIDs.contains(entry.nodeID) else {
        throw FlowingGraphNodePlacementIssue<Schema>.unknownNodeFrame(entry.nodeID)
      }
      guard entry.frame.isUsable else {
        throw FlowingGraphNodePlacementIssue<Schema>.invalidNodeFrame(entry.nodeID)
      }
      guard entry.frame.size == input.size(for: entry.nodeID) else {
        throw FlowingGraphNodePlacementIssue<Schema>.nodeFrameSizeMismatch(entry.nodeID)
      }
      guard nextFrameByNodeID.updateValue(entry.frame, forKey: entry.nodeID) == nil else {
        throw FlowingGraphNodePlacementIssue<Schema>.duplicateNodeFrame(entry.nodeID)
      }
    }
    for nodeID in input.topology.nodeIDs where nextFrameByNodeID[nodeID] == nil {
      throw FlowingGraphNodePlacementIssue<Schema>.missingNodeFrame(nodeID)
    }
    guard contentBounds.isUsable else {
      throw FlowingGraphNodePlacementIssue<Schema>.invalidContentBounds
    }
    for nodeID in input.topology.nodeIDs {
      guard contentBounds.contains(nextFrameByNodeID[nodeID]!) else {
        throw FlowingGraphNodePlacementIssue<Schema>.contentBoundsExcludeNode(nodeID)
      }
    }

    self.nodeFrames = input.topology.nodeIDs.map {
      FlowingGraphNodeFrame(nodeID: $0, frame: nextFrameByNodeID[$0]!)
    }
    self.contentBounds = contentBounds
    frameByNodeID = nextFrameByNodeID
  }

  public func frame(for nodeID: Schema.NodeID) -> CGRect {
    frameByNodeID[nodeID]!
  }
}

public enum FlowingGraphLayoutResultIssue<Schema: FlowingGraphLayoutSchema>: Error {
  case duplicateEdgeRoute(Schema.EdgeID)
  case missingEdgeRoute(Schema.EdgeID)
  case unknownEdgeRoute(Schema.EdgeID)
  case invalidEdgeRoute(Schema.EdgeID)
}

extension FlowingGraphLayoutResultIssue: Equatable {}

public struct FlowingGraphLayoutResult<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let inputID: FlowingLayoutInputID
  public let nodeFrames: [FlowingGraphNodeFrame<Schema>]
  public let edgeRoutes: [FlowingGraphLayoutEdgeRoute<Schema>]
  public let resolvedPortAnchors: [FlowingGraphResolvedPortAnchor<Schema>]
  public let contentBounds: CGRect

  private let frameByNodeID: [Schema.NodeID: CGRect]
  private let routeByEdgeID: [Schema.EdgeID: FlowingGraphEdgeRoute]

  public init(
    input: FlowingGraphLayoutInput<Schema>,
    placement: FlowingGraphNodePlacement<Schema>,
    edgeRoutes: [FlowingGraphLayoutEdgeRoute<Schema>]
  ) throws {
    let knownEdgeIDs = Set(input.topology.edges.map(\.id))
    var nextRouteByEdgeID: [Schema.EdgeID: FlowingGraphEdgeRoute] = [:]
    for entry in edgeRoutes {
      guard knownEdgeIDs.contains(entry.edgeID) else {
        throw FlowingGraphLayoutResultIssue<Schema>.unknownEdgeRoute(entry.edgeID)
      }
      guard entry.route.isFinite else {
        throw FlowingGraphLayoutResultIssue<Schema>.invalidEdgeRoute(entry.edgeID)
      }
      guard nextRouteByEdgeID.updateValue(entry.route, forKey: entry.edgeID) == nil else {
        throw FlowingGraphLayoutResultIssue<Schema>.duplicateEdgeRoute(entry.edgeID)
      }
    }
    for edge in input.topology.edges where nextRouteByEdgeID[edge.id] == nil {
      throw FlowingGraphLayoutResultIssue<Schema>.missingEdgeRoute(edge.id)
    }

    let frames = Dictionary(
      uniqueKeysWithValues: placement.nodeFrames.map { ($0.nodeID, $0.frame) }
    )
    inputID = input.id
    nodeFrames = placement.nodeFrames
    self.edgeRoutes = input.topology.edges.map {
      FlowingGraphLayoutEdgeRoute(edgeID: $0.id, route: nextRouteByEdgeID[$0.id]!)
    }
    resolvedPortAnchors = input.topology.ports.map { port in
      let anchor = input.anchor(for: port.id)
      let origin = frames[port.nodeID]!.origin
      return FlowingGraphResolvedPortAnchor(
        portID: port.id,
        position: CGPoint(
          x: origin.x + anchor.position.x,
          y: origin.y + anchor.position.y
        ),
        normal: anchor.normal
      )
    }
    contentBounds = nextRouteByEdgeID.values.reduce(placement.contentBounds) {
      $0.union($1.conservativeBounds)
    }
    frameByNodeID = frames
    routeByEdgeID = nextRouteByEdgeID
  }

  public func frame(for nodeID: Schema.NodeID) -> CGRect? {
    frameByNodeID[nodeID]
  }

  public func route(for edgeID: Schema.EdgeID) -> FlowingGraphEdgeRoute? {
    routeByEdgeID[edgeID]
  }
}

public enum FlowingGraphLayoutPipelineError: Error, Equatable {
  case inputIdentityMismatch
}

public protocol FlowingGraphLayoutStrategy<Schema>: Sendable {
  associatedtype Schema: FlowingGraphLayoutSchema

  var identity: FlowingLayoutPipelineIdentity { get }

  func layout(
    _ input: FlowingGraphLayoutInput<Schema>
  ) throws -> FlowingGraphLayoutResult<Schema>
}

public protocol FlowingGraphNodePlacementStrategy<Schema>: Sendable {
  associatedtype Schema: FlowingGraphLayoutSchema

  var identity: FlowingLayoutPipelineIdentity { get }

  func place(
    _ input: FlowingGraphLayoutInput<Schema>
  ) throws -> FlowingGraphNodePlacement<Schema>
}

public protocol FlowingGraphLayoutPostprocessor<Schema>: Sendable {
  associatedtype Schema: FlowingGraphLayoutSchema

  var identity: FlowingLayoutComponentIdentity { get }

  func process(
    _ placement: FlowingGraphNodePlacement<Schema>,
    input: FlowingGraphLayoutInput<Schema>
  ) throws -> FlowingGraphNodePlacement<Schema>
}

public protocol FlowingGraphEdgeRoutingStrategy<Schema>: Sendable {
  associatedtype Schema: FlowingGraphLayoutSchema

  var identity: FlowingLayoutComponentIdentity { get }

  func routes(
    for input: FlowingGraphLayoutInput<Schema>,
    placement: FlowingGraphNodePlacement<Schema>
  ) throws -> [FlowingGraphLayoutEdgeRoute<Schema>]
}

public struct FlowingGraphLayoutPipeline<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let placement: any FlowingGraphNodePlacementStrategy<Schema>
  public let postprocessors: [any FlowingGraphLayoutPostprocessor<Schema>]
  public let edgeRouter: any FlowingGraphEdgeRoutingStrategy<Schema>

  public init(
    placement: some FlowingGraphNodePlacementStrategy<Schema>,
    postprocessors: [any FlowingGraphLayoutPostprocessor<Schema>] = [],
    edgeRouter: some FlowingGraphEdgeRoutingStrategy<Schema>
  ) {
    self.placement = placement
    self.postprocessors = postprocessors
    self.edgeRouter = edgeRouter
  }
}

extension FlowingGraphLayoutPipeline: FlowingGraphLayoutStrategy {
  public var identity: FlowingLayoutPipelineIdentity {
    FlowingLayoutPipelineIdentity(
      components: placement.identity.components +
        postprocessors.map(\.identity) + [edgeRouter.identity]
    )
  }

  public func layout(
    _ input: FlowingGraphLayoutInput<Schema>
  ) throws -> FlowingGraphLayoutResult<Schema> {
    guard input.id.pipelineIdentity == identity else {
      throw FlowingGraphLayoutPipelineError.inputIdentityMismatch
    }
    var nextPlacement = try placement.place(input)
    for postprocessor in postprocessors {
      try Task.checkCancellation()
      nextPlacement = try postprocessor.process(nextPlacement, input: input)
    }
    let routes = try edgeRouter.routes(for: input, placement: nextPlacement)
    return try FlowingGraphLayoutResult(
      input: input,
      placement: nextPlacement,
      edgeRoutes: routes
    )
  }
}

private extension CGRect {
  var isUsable: Bool {
    !isNull && !isInfinite && origin.x.isFinite && origin.y.isFinite &&
      width.isFinite && height.isFinite && width >= 0 && height >= 0
  }
}

private extension FlowingGraphEdgeRoute {
  var isFinite: Bool {
    start.x.isFinite && start.y.isFinite && segments.allSatisfy(\.isFinite)
  }
}

private extension FlowingGraphEdgePathSegment {
  var isFinite: Bool {
    switch self {
    case let .line(end):
      end.x.isFinite && end.y.isFinite
    case let .quadratic(control, end):
      control.x.isFinite && control.y.isFinite && end.x.isFinite && end.y.isFinite
    case let .cubic(control1, control2, end):
      control1.x.isFinite && control1.y.isFinite &&
        control2.x.isFinite && control2.y.isFinite &&
        end.x.isFinite && end.y.isFinite
    }
  }
}
