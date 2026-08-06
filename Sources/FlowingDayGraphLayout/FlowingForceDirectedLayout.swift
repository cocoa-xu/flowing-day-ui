import CoreGraphics
import Foundation

public struct FlowingForceSimulationConfiguration: Sendable, Equatable {
  public let iterationLimit: Int
  public let idealEdgeLength: CGFloat
  public let repulsionStrength: CGFloat
  public let attractionStrength: CGFloat
  public let centeringStrength: CGFloat
  public let collisionStrength: CGFloat
  public let collisionPadding: CGFloat
  public let timeStep: CGFloat
  public let damping: CGFloat
  public let maximumDisplacement: CGFloat
  public let convergenceTolerance: CGFloat
  public let barnesHutTheta: CGFloat
  public let maximumTreeDepth: Int

  public init(
    iterationLimit: Int,
    idealEdgeLength: CGFloat,
    repulsionStrength: CGFloat,
    attractionStrength: CGFloat,
    centeringStrength: CGFloat,
    collisionStrength: CGFloat,
    collisionPadding: CGFloat,
    timeStep: CGFloat,
    damping: CGFloat,
    maximumDisplacement: CGFloat,
    convergenceTolerance: CGFloat,
    barnesHutTheta: CGFloat,
    maximumTreeDepth: Int
  ) {
    precondition(iterationLimit >= 0)
    precondition(idealEdgeLength.isFinite && idealEdgeLength > 0)
    precondition(repulsionStrength.isFinite && repulsionStrength >= 0)
    precondition(attractionStrength.isFinite && attractionStrength >= 0)
    precondition(centeringStrength.isFinite && centeringStrength >= 0)
    precondition(collisionStrength.isFinite && collisionStrength >= 0)
    precondition(collisionPadding.isFinite && collisionPadding >= 0)
    precondition(timeStep.isFinite && timeStep > 0)
    precondition(damping.isFinite && damping >= 0 && damping <= 1)
    precondition(maximumDisplacement.isFinite && maximumDisplacement > 0)
    precondition(convergenceTolerance.isFinite && convergenceTolerance >= 0)
    precondition(barnesHutTheta.isFinite && barnesHutTheta > 0)
    precondition(maximumTreeDepth > 0)
    self.iterationLimit = iterationLimit
    self.idealEdgeLength = idealEdgeLength
    self.repulsionStrength = repulsionStrength
    self.attractionStrength = attractionStrength
    self.centeringStrength = centeringStrength
    self.collisionStrength = collisionStrength
    self.collisionPadding = collisionPadding
    self.timeStep = timeStep
    self.damping = damping
    self.maximumDisplacement = maximumDisplacement
    self.convergenceTolerance = convergenceTolerance
    self.barnesHutTheta = barnesHutTheta
    self.maximumTreeDepth = maximumTreeDepth
  }
}

public struct FlowingForceComponentPackingConfiguration: Sendable, Equatable {
  public let componentSpacing: CGFloat
  public let componentPadding: CGFloat
  public let targetAspectRatio: CGFloat
  public let canvasInsets: FlowingLayoutInsets
  public let minimumCanvasSize: CGSize

  public init(
    componentSpacing: CGFloat,
    componentPadding: CGFloat,
    targetAspectRatio: CGFloat,
    canvasInsets: FlowingLayoutInsets,
    minimumCanvasSize: CGSize
  ) {
    precondition(componentSpacing.isFinite && componentSpacing >= 0)
    precondition(componentPadding.isFinite && componentPadding >= 0)
    precondition(targetAspectRatio.isFinite && targetAspectRatio > 0)
    precondition(
      minimumCanvasSize.width.isFinite && minimumCanvasSize.width >= 0
        && minimumCanvasSize.height.isFinite && minimumCanvasSize.height >= 0
    )
    self.componentSpacing = componentSpacing
    self.componentPadding = componentPadding
    self.targetAspectRatio = targetAspectRatio
    self.canvasInsets = canvasInsets
    self.minimumCanvasSize = minimumCanvasSize
  }
}

public struct FlowingForceDirectedLayoutConfiguration: Sendable, Equatable {
  public let simulation: FlowingForceSimulationConfiguration
  public let packing: FlowingForceComponentPackingConfiguration

  public init(
    simulation: FlowingForceSimulationConfiguration,
    packing: FlowingForceComponentPackingConfiguration
  ) {
    self.simulation = simulation
    self.packing = packing
  }
}

public struct FlowingForceDirectedPlacement<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let identity: FlowingLayoutPipelineIdentity
  public let configuration: FlowingForceDirectedLayoutConfiguration

  public init(
    configuration: FlowingForceDirectedLayoutConfiguration,
    identity: FlowingLayoutComponentIdentity = .init()
  ) {
    self.configuration = configuration
    self.identity = FlowingLayoutPipelineIdentity(component: identity)
  }
}

extension FlowingForceDirectedPlacement: FlowingGraphNodePlacementStrategy {
  public func place(
    _ input: FlowingGraphLayoutInput<Schema>
  ) throws -> FlowingGraphNodePlacement<Schema> {
    guard !input.topology.nodeIDs.isEmpty else {
      return try FlowingGraphNodePlacement(
        input: input,
        nodeFrames: [],
        contentBounds: CGRect(origin: .zero, size: configuration.packing.minimumCanvasSize)
      )
    }

    let nodeOrder = Dictionary(
      uniqueKeysWithValues: input.topology.nodeIDs.enumerated().map { ($1, $0) }
    )
    let components = input.topology.weaklyConnectedComponents()
    try Task.checkCancellation()
    var componentRootByNodeID: [Schema.NodeID: Schema.NodeID] = [:]
    componentRootByNodeID.reserveCapacity(input.topology.nodeIDs.count)
    for component in components {
      let root = component[0]
      for (index, nodeID) in component.enumerated() {
        if index.isMultiple(of: FlowingForceCancellation.stride) {
          try Task.checkCancellation()
        }
        componentRootByNodeID[nodeID] = root
      }
    }
    let edgePairs = try uniqueEdgePairs(input: input, nodeOrder: nodeOrder)
    let edgePairsByRoot = Dictionary(grouping: edgePairs) { pair in
      componentRootByNodeID[pair.first]!
    }
    var geometries: [FlowingForceComponentGeometry<Schema>] = []
    geometries.reserveCapacity(components.count)

    for nodeIDs in components {
      try Task.checkCancellation()
      let root = nodeIDs[0]
      geometries.append(
        try componentGeometry(
          nodeIDs: nodeIDs,
          edgePairs: edgePairsByRoot[root, default: []],
          input: input
        )
      )
    }

    let packedFrames = try pack(geometries: geometries, input: input)
    let packing = configuration.packing
    let measuredWidth =
      (packedFrames.values.map(\.maxX).max() ?? 0) + packing.componentPadding
      + packing.canvasInsets.trailing
    let measuredHeight =
      (packedFrames.values.map(\.maxY).max() ?? 0) + packing.componentPadding
      + packing.canvasInsets.bottom
    let measuredBounds = CGRect(
      origin: .zero,
      size: CGSize(
        width: max(measuredWidth, packing.minimumCanvasSize.width),
        height: max(measuredHeight, packing.minimumCanvasSize.height)
      )
    )
    let contentBounds = packedFrames.values.reduce(measuredBounds) { $0.union($1) }
    return try FlowingGraphNodePlacement(
      input: input,
      nodeFrames: input.topology.nodeIDs.map {
        FlowingGraphNodeFrame(nodeID: $0, frame: packedFrames[$0]!)
      },
      contentBounds: contentBounds
    )
  }

  private func uniqueEdgePairs(
    input: FlowingGraphLayoutInput<Schema>,
    nodeOrder: [Schema.NodeID: Int]
  ) throws -> [FlowingForceNodePair<Schema>] {
    var knownPairs: Set<FlowingForceNodePair<Schema>> = []
    var pairs: [FlowingForceNodePair<Schema>] = []
    pairs.reserveCapacity(input.topology.edges.count)
    for (index, edge) in input.topology.edges.enumerated() {
      if index.isMultiple(of: FlowingForceCancellation.stride) {
        try Task.checkCancellation()
      }
      let endpoints = edge.endpoints.elements
      let first = input.topology.nodeID(for: endpoints[0])
      let second = input.topology.nodeID(for: endpoints[1])
      guard first != second else { continue }
      let pair =
        nodeOrder[first]! < nodeOrder[second]!
        ? FlowingForceNodePair<Schema>(first: first, second: second)
        : FlowingForceNodePair<Schema>(first: second, second: first)
      if knownPairs.insert(pair).inserted {
        pairs.append(pair)
      }
    }
    return pairs
  }

  private func componentGeometry(
    nodeIDs: [Schema.NodeID],
    edgePairs: [FlowingForceNodePair<Schema>],
    input: FlowingGraphLayoutInput<Schema>
  ) throws -> FlowingForceComponentGeometry<Schema> {
    try Task.checkCancellation()
    let indexByNodeID = Dictionary(
      uniqueKeysWithValues: nodeIDs.enumerated().map { ($1, $0) }
    )
    let indexedEdges = edgePairs.map {
      FlowingForceIndexedPair(first: indexByNodeID[$0.first]!, second: indexByNodeID[$0.second]!)
    }
    let sizes = nodeIDs.map { input.resolvedSize(for: $0) }
    let radii = sizes.map { hypot($0.width, $0.height) / 2 }
    var positions = initialPositions(count: nodeIDs.count)
    try FlowingForceSimulation(
      configuration: configuration.simulation,
      radii: radii,
      edges: indexedEdges
    ).run(positions: &positions)

    var frames: [FlowingGraphNodeFrame<Schema>] = []
    frames.reserveCapacity(nodeIDs.count)
    var bounds = CGRect.null
    for (index, nodeID) in nodeIDs.enumerated() {
      let size = sizes[index]
      let frame = CGRect(
        x: positions[index].x - size.width / 2,
        y: positions[index].y - size.height / 2,
        width: size.width,
        height: size.height
      )
      frames.append(FlowingGraphNodeFrame(nodeID: nodeID, frame: frame))
      bounds = bounds.union(frame)
    }
    let padding = configuration.packing.componentPadding
    return FlowingForceComponentGeometry(
      frames: frames.map {
        FlowingGraphNodeFrame(
          nodeID: $0.nodeID,
          frame: $0.frame.offsetBy(dx: padding - bounds.minX, dy: padding - bounds.minY)
        )
      },
      size: CGSize(width: bounds.width + 2 * padding, height: bounds.height + 2 * padding)
    )
  }

  private func initialPositions(count: Int) -> [CGPoint] {
    guard count > 0 else { return [] }
    let columns = Int(ceil(sqrt(CGFloat(count))))
    let rows = Int(ceil(CGFloat(count) / CGFloat(columns)))
    let spacing = configuration.simulation.idealEdgeLength
    let origin = CGPoint(
      x: -CGFloat(columns - 1) * spacing / 2,
      y: -CGFloat(rows - 1) * spacing / 2
    )
    return (0..<count).map { index in
      CGPoint(
        x: origin.x + CGFloat(index % columns) * spacing,
        y: origin.y + CGFloat(index / columns) * spacing
      )
    }
  }

  private func pack(
    geometries: [FlowingForceComponentGeometry<Schema>],
    input: FlowingGraphLayoutInput<Schema>
  ) throws -> [Schema.NodeID: CGRect] {
    let packing = configuration.packing
    let totalArea = geometries.reduce(0) { $0 + $1.size.width * $1.size.height }
    let maximumWidth = geometries.map(\.size.width).max() ?? 0
    let targetWidth = max(maximumWidth, sqrt(totalArea * packing.targetAspectRatio))
    var cursor = CGPoint(x: packing.canvasInsets.leading, y: packing.canvasInsets.top)
    var rowHeight: CGFloat = 0
    var frames: [Schema.NodeID: CGRect] = [:]
    frames.reserveCapacity(input.topology.nodeIDs.count)

    for (geometryIndex, geometry) in geometries.enumerated() {
      if geometryIndex.isMultiple(of: FlowingForceCancellation.stride) {
        try Task.checkCancellation()
      }
      if cursor.x > packing.canvasInsets.leading
        && cursor.x + geometry.size.width > packing.canvasInsets.leading + targetWidth
      {
        cursor.x = packing.canvasInsets.leading
        cursor.y += rowHeight + packing.componentSpacing
        rowHeight = 0
      }
      for (frameIndex, entry) in geometry.frames.enumerated() {
        if frameIndex.isMultiple(of: FlowingForceCancellation.stride) {
          try Task.checkCancellation()
        }
        let offset = input.resolvedPlacementOffset(for: entry.nodeID)
        frames[entry.nodeID] = entry.frame.offsetBy(
          dx: cursor.x + offset.width,
          dy: cursor.y + offset.height
        )
      }
      cursor.x += geometry.size.width + packing.componentSpacing
      rowHeight = max(rowHeight, geometry.size.height)
    }
    return frames
  }
}

public struct FlowingForceDirectedLayout<Schema: FlowingGraphLayoutSchema>: Sendable {
  private let pipeline: FlowingGraphLayoutPipeline<Schema>

  public init(configuration: FlowingForceDirectedLayoutConfiguration) {
    pipeline = FlowingGraphLayoutPipeline(
      placement: FlowingForceDirectedPlacement(configuration: configuration),
      edgeRouter: FlowingCubicEdgeRouter<Schema>()
    )
  }

  public init(
    placement: FlowingForceDirectedPlacement<Schema>,
    postprocessors: [any FlowingGraphLayoutPostprocessor<Schema>] = [],
    edgeRouter: some FlowingGraphEdgeRoutingStrategy<Schema>
  ) {
    pipeline = FlowingGraphLayoutPipeline(
      placement: placement,
      postprocessors: postprocessors,
      edgeRouter: edgeRouter
    )
  }
}

extension FlowingForceDirectedLayout: FlowingGraphLayoutStrategy {
  public var identity: FlowingLayoutPipelineIdentity {
    pipeline.identity
  }

  public func layout(
    _ input: FlowingGraphLayoutInput<Schema>
  ) throws -> FlowingGraphLayoutResult<Schema> {
    try pipeline.layout(input)
  }
}

private struct FlowingForceComponentGeometry<Schema: FlowingGraphLayoutSchema> {
  let frames: [FlowingGraphNodeFrame<Schema>]
  let size: CGSize
}

private struct FlowingForceNodePair<Schema: FlowingGraphLayoutSchema>: Hashable {
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
