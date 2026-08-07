import CoreGraphics
import Foundation

public struct FlowingCubicEdgeRouterConfiguration: Sendable, Equatable {
  public let minimumControlDistance: CGFloat
  public let maximumControlDistance: CGFloat
  public let controlDistanceRatio: CGFloat
  public let parallelEdgeSpacing: CGFloat
  public let selfLoopRadius: CGFloat

  public init(
    minimumControlDistance: CGFloat,
    maximumControlDistance: CGFloat,
    controlDistanceRatio: CGFloat,
    parallelEdgeSpacing: CGFloat,
    selfLoopRadius: CGFloat
  ) {
    precondition(minimumControlDistance.isFinite && minimumControlDistance >= 0)
    precondition(
      maximumControlDistance.isFinite && maximumControlDistance >= minimumControlDistance
    )
    precondition(controlDistanceRatio.isFinite && controlDistanceRatio >= 0)
    precondition(parallelEdgeSpacing.isFinite && parallelEdgeSpacing >= 0)
    precondition(selfLoopRadius.isFinite && selfLoopRadius >= 0)
    self.minimumControlDistance = minimumControlDistance
    self.maximumControlDistance = maximumControlDistance
    self.controlDistanceRatio = controlDistanceRatio
    self.parallelEdgeSpacing = parallelEdgeSpacing
    self.selfLoopRadius = selfLoopRadius
  }

  public static let standard = Self(
    minimumControlDistance: 28,
    maximumControlDistance: 54,
    controlDistanceRatio: 0.45,
    parallelEdgeSpacing: 12,
    selfLoopRadius: 34
  )
}

public struct FlowingCubicEdgeRouter<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let identity: FlowingLayoutComponentIdentity
  public let configuration: FlowingCubicEdgeRouterConfiguration

  public init(
    configuration: FlowingCubicEdgeRouterConfiguration = .standard,
    identity: FlowingLayoutComponentIdentity = .init()
  ) {
    self.configuration = configuration
    self.identity = identity
  }
}

extension FlowingCubicEdgeRouter: FlowingGraphEdgeRoutingStrategy {
  public func routes(
    for input: FlowingGraphLayoutInput<Schema>,
    placement: FlowingGraphNodePlacement<Schema>
  ) throws -> [FlowingGraphLayoutEdgeRoute<Schema>] {
    var indexByPair: [FlowingNodePair<Schema>: Int] = [:]
    var countByPair: [FlowingNodePair<Schema>: Int] = [:]
    for edge in input.topology.edges {
      let pair = nodePair(for: edge, topology: input.topology)
      countByPair[pair, default: 0] += 1
    }

    return try input.topology.edges.map { edge in
      try Task.checkCancellation()
      let pair = nodePair(for: edge, topology: input.topology)
      let index = indexByPair[pair, default: 0]
      indexByPair[pair] = index + 1
      let count = countByPair[pair, default: 1]
      let separation = (CGFloat(index) - CGFloat(count - 1) / 2) * configuration.parallelEdgeSpacing
      return FlowingGraphLayoutEdgeRoute(
        edgeID: edge.id,
        route: route(
          for: edge,
          input: input,
          placement: placement,
          separation: separation,
          loopIndex: index
        )
      )
    }
  }

  private func route(
    for edge: FlowingGraphLayoutEdge<Schema>,
    input: FlowingGraphLayoutInput<Schema>,
    placement: FlowingGraphNodePlacement<Schema>,
    separation: CGFloat,
    loopIndex: Int
  ) -> FlowingGraphEdgeRoute {
    let endpoints = edge.endpoints.elements
    let firstNodeID = input.topology.nodeID(for: endpoints[0])
    let secondNodeID = input.topology.nodeID(for: endpoints[1])
    let firstFrame = placement.resolvedFrame(for: firstNodeID)
    let secondFrame = placement.resolvedFrame(for: secondNodeID)
    if firstNodeID == secondNodeID {
      return selfLoop(
        firstEndpoint: endpoints[0],
        secondEndpoint: endpoints[1],
        frame: firstFrame,
        input: input,
        loopIndex: loopIndex
      )
    }

    let first = resolvedEndpoint(
      endpoints[0],
      frame: firstFrame,
      toward: CGPoint(x: secondFrame.midX, y: secondFrame.midY),
      input: input
    )
    let second = resolvedEndpoint(
      endpoints[1],
      frame: secondFrame,
      toward: CGPoint(x: firstFrame.midX, y: firstFrame.midY),
      input: input
    )
    let distance = hypot(second.point.x - first.point.x, second.point.y - first.point.y)
    let controlDistance = min(
      max(distance * configuration.controlDistanceRatio, configuration.minimumControlDistance),
      configuration.maximumControlDistance
    )
    let perpendicular = normalized(
      CGVector(
        dx: -(second.point.y - first.point.y),
        dy: second.point.x - first.point.x
      )
    )
    let offset = CGVector(
      dx: perpendicular.dx * separation,
      dy: perpendicular.dy * separation
    )
    let control1 = CGPoint(
      x: first.point.x + first.normal.dx * controlDistance + offset.dx,
      y: first.point.y + first.normal.dy * controlDistance + offset.dy
    )
    let control2 = CGPoint(
      x: second.point.x + second.normal.dx * controlDistance + offset.dx,
      y: second.point.y + second.normal.dy * controlDistance + offset.dy
    )
    return FlowingGraphEdgeRoute(
      start: first.point,
      segments: [
        .cubic(control1: control1, control2: control2, end: second.point)
      ]
    )
  }

  private func selfLoop(
    firstEndpoint: FlowingGraphLayoutEndpoint<Schema>,
    secondEndpoint: FlowingGraphLayoutEndpoint<Schema>,
    frame: CGRect,
    input: FlowingGraphLayoutInput<Schema>,
    loopIndex: Int
  ) -> FlowingGraphEdgeRoute {
    let radius =
      configuration.selfLoopRadius + CGFloat(loopIndex) * configuration.parallelEdgeSpacing
    let start = resolvedEndpoint(
      firstEndpoint,
      frame: frame,
      toward: CGPoint(x: frame.maxX + radius, y: frame.minY - radius),
      input: input
    )
    let end = resolvedEndpoint(
      secondEndpoint,
      frame: frame,
      toward: CGPoint(x: frame.minX - radius, y: frame.minY - radius),
      input: input
    )
    let apex = CGPoint(x: frame.midX, y: frame.minY - radius)
    return FlowingGraphEdgeRoute(
      start: start.point,
      segments: [
        .cubic(
          control1: CGPoint(x: frame.maxX + radius, y: start.point.y),
          control2: CGPoint(x: frame.maxX + radius, y: frame.minY - radius),
          end: apex
        ),
        .cubic(
          control1: CGPoint(x: frame.minX - radius, y: frame.minY - radius),
          control2: CGPoint(x: frame.minX - radius, y: end.point.y),
          end: end.point
        ),
      ]
    )
  }

  private func resolvedEndpoint(
    _ endpoint: FlowingGraphLayoutEndpoint<Schema>,
    frame: CGRect,
    toward target: CGPoint,
    input: FlowingGraphLayoutInput<Schema>
  ) -> FlowingResolvedEndpoint {
    switch endpoint {
    case .node:
      return frameBoundaryEndpoint(frame: frame, toward: target)
    case .port(let key):
      let anchor = input.resolvedAnchor(for: key)
      let point = CGPoint(
        x: frame.minX + anchor.position.x,
        y: frame.minY + anchor.position.y
      )
      let normal =
        anchor.normal == .zero
        ? normalized(CGVector(dx: target.x - point.x, dy: target.y - point.y))
        : normalized(anchor.normal)
      return FlowingResolvedEndpoint(point: point, normal: normal)
    }
  }

  private func frameBoundaryEndpoint(
    frame: CGRect,
    toward target: CGPoint
  ) -> FlowingResolvedEndpoint {
    let dx = target.x - frame.midX
    let dy = target.y - frame.midY
    if abs(dy) >= abs(dx) {
      let isBelow = dy >= 0
      return FlowingResolvedEndpoint(
        point: CGPoint(x: frame.midX, y: isBelow ? frame.maxY : frame.minY),
        normal: CGVector(dx: 0, dy: isBelow ? 1 : -1)
      )
    }
    let isTrailing = dx >= 0
    return FlowingResolvedEndpoint(
      point: CGPoint(x: isTrailing ? frame.maxX : frame.minX, y: frame.midY),
      normal: CGVector(dx: isTrailing ? 1 : -1, dy: 0)
    )
  }

  private func nodePair(
    for edge: FlowingGraphLayoutEdge<Schema>,
    topology: FlowingGraphLayoutTopology<Schema>
  ) -> FlowingNodePair<Schema> {
    let endpoints = edge.endpoints.elements
    let first = topology.nodeID(for: endpoints[0])
    let second = topology.nodeID(for: endpoints[1])
    return FlowingNodePair(first: first, second: second)
  }

  private func normalized(_ vector: CGVector) -> CGVector {
    let length = hypot(vector.dx, vector.dy)
    guard length > 0 else { return .zero }
    return CGVector(dx: vector.dx / length, dy: vector.dy / length)
  }
}

public struct FlowingLayeredDAGLayout<Schema: FlowingGraphLayoutSchema>: Sendable {
  private let pipeline: FlowingGraphLayoutPipeline<Schema>

  public init(configuration: FlowingLayeredLayoutConfiguration) {
    pipeline = FlowingGraphLayoutPipeline(
      placement: FlowingLayeredDAGPlacement(
        layerAssignment: FlowingLongestPathLayerAssignment<Schema>(),
        layerOrdering: FlowingStableLayerOrdering<Schema>(),
        coordinateAssignment: FlowingCenteredLayerCoordinates<Schema>(
          configuration: configuration
        )
      ),
      edgeRouter: FlowingCubicEdgeRouter<Schema>()
    )
  }

  public init(
    layerAssignment: some FlowingLayerAssignmentStrategy<Schema>,
    layerOrdering: some FlowingLayerOrderingStrategy<Schema>,
    coordinateAssignment: some FlowingLayerCoordinateAssignmentStrategy<Schema>,
    postprocessors: [any FlowingGraphLayoutPostprocessor<Schema>] = [],
    edgeRouter: some FlowingGraphEdgeRoutingStrategy<Schema>
  ) {
    pipeline = FlowingGraphLayoutPipeline(
      placement: FlowingLayeredDAGPlacement(
        layerAssignment: layerAssignment,
        layerOrdering: layerOrdering,
        coordinateAssignment: coordinateAssignment
      ),
      postprocessors: postprocessors,
      edgeRouter: edgeRouter
    )
  }
}

extension FlowingLayeredDAGLayout: FlowingGraphLayoutStrategy {
  public var identity: FlowingLayoutPipelineIdentity {
    pipeline.identity
  }

  public func layout(
    _ input: FlowingGraphLayoutInput<Schema>
  ) throws -> FlowingGraphLayoutResult<Schema> {
    try pipeline.layout(input)
  }
}

private struct FlowingResolvedEndpoint {
  let point: CGPoint
  let normal: CGVector
}

private struct FlowingNodePair<Schema: FlowingGraphLayoutSchema>: Hashable {
  let first: Schema.NodeID
  let second: Schema.NodeID
}

extension FlowingGraphLayoutEdgeEndpoints {
  fileprivate var elements: [FlowingGraphLayoutEndpoint<Schema>] {
    switch self {
    case .directed(let source, let target):
      [source, target]
    case .undirected(let first, let second):
      [first, second]
    }
  }
}
