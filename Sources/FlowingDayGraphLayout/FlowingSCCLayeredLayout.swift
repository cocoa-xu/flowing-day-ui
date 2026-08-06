import CoreGraphics
import FlowingDayGraphCore
import Foundation

public struct FlowingSCCLayeredLayoutConfiguration: Sendable, Equatable {
  public let horizontalComponentSpacing: CGFloat
  public let verticalLayerSpacing: CGFloat
  public let weakComponentSpacing: CGFloat
  public let cyclicNodeSpacing: CGFloat
  public let cyclicComponentPadding: CGFloat
  public let canvasInsets: FlowingLayoutInsets
  public let minimumCanvasSize: CGSize

  public init(
    horizontalComponentSpacing: CGFloat,
    verticalLayerSpacing: CGFloat,
    weakComponentSpacing: CGFloat,
    cyclicNodeSpacing: CGFloat,
    cyclicComponentPadding: CGFloat,
    canvasInsets: FlowingLayoutInsets,
    minimumCanvasSize: CGSize
  ) {
    precondition(horizontalComponentSpacing.isFinite && horizontalComponentSpacing >= 0)
    precondition(verticalLayerSpacing.isFinite && verticalLayerSpacing >= 0)
    precondition(weakComponentSpacing.isFinite && weakComponentSpacing >= 0)
    precondition(cyclicNodeSpacing.isFinite && cyclicNodeSpacing >= 0)
    precondition(cyclicComponentPadding.isFinite && cyclicComponentPadding >= 0)
    precondition(
      minimumCanvasSize.width.isFinite && minimumCanvasSize.width >= 0
        && minimumCanvasSize.height.isFinite && minimumCanvasSize.height >= 0
    )
    self.horizontalComponentSpacing = horizontalComponentSpacing
    self.verticalLayerSpacing = verticalLayerSpacing
    self.weakComponentSpacing = weakComponentSpacing
    self.cyclicNodeSpacing = cyclicNodeSpacing
    self.cyclicComponentPadding = cyclicComponentPadding
    self.canvasInsets = canvasInsets
    self.minimumCanvasSize = minimumCanvasSize
  }
}

public struct FlowingSCCLayeredPlacement<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let identity: FlowingLayoutPipelineIdentity
  public let configuration: FlowingSCCLayeredLayoutConfiguration

  public init(
    configuration: FlowingSCCLayeredLayoutConfiguration,
    identity: FlowingLayoutComponentIdentity = .init()
  ) {
    self.configuration = configuration
    self.identity = FlowingLayoutPipelineIdentity(component: identity)
  }
}

extension FlowingSCCLayeredPlacement: FlowingGraphNodePlacementStrategy {
  public func place(
    _ input: FlowingGraphLayoutInput<Schema>
  ) throws -> FlowingGraphNodePlacement<Schema> {
    guard !input.topology.nodeIDs.isEmpty else {
      return try FlowingGraphNodePlacement(
        input: input,
        nodeFrames: [],
        contentBounds: CGRect(origin: .zero, size: configuration.minimumCanvasSize)
      )
    }

    try Task.checkCancellation()
    let analysis = try FlowingSCCAnalysis(input: input)
    let geometries = try analysis.components.map {
      try componentGeometry(nodeIDs: $0, input: input)
    }
    try Task.checkCancellation()

    let rankOrigins = layerOrigins(analysis: analysis, geometries: geometries)
    var frames: [Schema.NodeID: CGRect] = [:]
    frames.reserveCapacity(input.topology.nodeIDs.count)
    var weakComponentX = configuration.canvasInsets.leading

    for weakComponent in analysis.weakComponents {
      try Task.checkCancellation()
      let componentIDsByRank = Dictionary(grouping: weakComponent) {
        analysis.ranks[$0]
      }
      let layerWidths = componentIDsByRank.mapValues {
        layerWidth(componentIDs: $0, geometries: geometries)
      }
      let weakComponentWidth = layerWidths.values.max() ?? 0

      for rank in componentIDsByRank.keys.sorted() {
        let componentIDs = componentIDsByRank[rank, default: []]
        let width = layerWidths[rank, default: 0]
        var componentX = weakComponentX + (weakComponentWidth - width) / 2
        for componentID in componentIDs {
          let geometry = geometries[componentID]
          let componentY = rankOrigins[rank]
          for entry in geometry.frames {
            let offset = input.resolvedPlacementOffset(for: entry.nodeID)
            frames[entry.nodeID] = entry.frame.offsetBy(
              dx: componentX + offset.width,
              dy: componentY + offset.height
            )
          }
          componentX += geometry.size.width + configuration.horizontalComponentSpacing
        }
      }
      weakComponentX += weakComponentWidth + configuration.weakComponentSpacing
    }

    let measuredWidth =
      weakComponentX - configuration.weakComponentSpacing + configuration.canvasInsets.trailing
    let lastRank = analysis.ranks.max() ?? 0
    let measuredHeight =
      rankOrigins[lastRank] + geometries.enumerated()
      .filter { analysis.ranks[$0.offset] == lastRank }
      .map(\.element.size.height).max()! + configuration.canvasInsets.bottom
    let minimumBounds = CGRect(
      origin: .zero,
      size: CGSize(
        width: max(measuredWidth, configuration.minimumCanvasSize.width),
        height: max(measuredHeight, configuration.minimumCanvasSize.height)
      )
    )
    let contentBounds = frames.values.reduce(minimumBounds) { $0.union($1) }
    return try FlowingGraphNodePlacement(
      input: input,
      nodeFrames: input.topology.nodeIDs.map {
        FlowingGraphNodeFrame(nodeID: $0, frame: frames[$0]!)
      },
      contentBounds: contentBounds
    )
  }

  private func layerOrigins(
    analysis: FlowingSCCAnalysis<Schema>,
    geometries: [FlowingSCCGeometry<Schema>]
  ) -> [CGFloat] {
    var heights: [Int: CGFloat] = [:]
    for componentID in analysis.components.indices {
      let rank = analysis.ranks[componentID]
      heights[rank] = max(heights[rank, default: 0], geometries[componentID].size.height)
    }
    var origins: [CGFloat] = []
    origins.reserveCapacity(heights.count)
    var y = configuration.canvasInsets.top
    for rank in heights.keys.sorted() {
      precondition(rank == origins.count)
      origins.append(y)
      y += heights[rank, default: 0] + configuration.verticalLayerSpacing
    }
    return origins
  }

  private func layerWidth(
    componentIDs: [Int],
    geometries: [FlowingSCCGeometry<Schema>]
  ) -> CGFloat {
    componentIDs.reduce(0) { $0 + geometries[$1].size.width } + CGFloat(
      max(componentIDs.count - 1, 0)) * configuration.horizontalComponentSpacing
  }

  private func componentGeometry(
    nodeIDs: [Schema.NodeID],
    input: FlowingGraphLayoutInput<Schema>
  ) throws -> FlowingSCCGeometry<Schema> {
    precondition(!nodeIDs.isEmpty)
    guard nodeIDs.count > 1 else {
      let nodeID = nodeIDs[0]
      let size = input.resolvedSize(for: nodeID)
      return FlowingSCCGeometry(
        frames: [FlowingGraphNodeFrame(nodeID: nodeID, frame: CGRect(origin: .zero, size: size))],
        size: size
      )
    }

    let maximumDiameter = nodeIDs.map {
      let size = input.resolvedSize(for: $0)
      return hypot(size.width, size.height)
    }.max()!
    let radius: CGFloat
    if nodeIDs.count == 2 {
      radius = (maximumDiameter + configuration.cyclicNodeSpacing) / 2
    } else {
      radius =
        (maximumDiameter + configuration.cyclicNodeSpacing)
        / (2 * sin(.pi / CGFloat(nodeIDs.count)))
    }
    var nextFrames: [FlowingGraphNodeFrame<Schema>] = []
    nextFrames.reserveCapacity(nodeIDs.count)
    var bounds = CGRect.null
    for (index, nodeID) in nodeIDs.enumerated() {
      try Task.checkCancellation()
      let angle =
        nodeIDs.count == 2
        ? CGFloat(index) * .pi
        : -.pi / 2 + CGFloat(index) * 2 * .pi / CGFloat(nodeIDs.count)
      let size = input.resolvedSize(for: nodeID)
      let center = CGPoint(x: cos(angle) * radius, y: sin(angle) * radius)
      let frame = CGRect(
        x: center.x - size.width / 2,
        y: center.y - size.height / 2,
        width: size.width,
        height: size.height
      )
      nextFrames.append(FlowingGraphNodeFrame(nodeID: nodeID, frame: frame))
      bounds = bounds.union(frame)
    }
    let translation = CGPoint(
      x: configuration.cyclicComponentPadding - bounds.minX,
      y: configuration.cyclicComponentPadding - bounds.minY
    )
    return FlowingSCCGeometry(
      frames: nextFrames.map {
        FlowingGraphNodeFrame(
          nodeID: $0.nodeID,
          frame: $0.frame.offsetBy(dx: translation.x, dy: translation.y)
        )
      },
      size: CGSize(
        width: bounds.width + 2 * configuration.cyclicComponentPadding,
        height: bounds.height + 2 * configuration.cyclicComponentPadding
      )
    )
  }
}

public struct FlowingSCCLayeredLayout<Schema: FlowingGraphLayoutSchema>: Sendable {
  private let pipeline: FlowingGraphLayoutPipeline<Schema>

  public init(configuration: FlowingSCCLayeredLayoutConfiguration) {
    pipeline = FlowingGraphLayoutPipeline(
      placement: FlowingSCCLayeredPlacement(configuration: configuration),
      edgeRouter: FlowingCubicEdgeRouter<Schema>()
    )
  }

  public init(
    placement: FlowingSCCLayeredPlacement<Schema>,
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

extension FlowingSCCLayeredLayout: FlowingGraphLayoutStrategy {
  public var identity: FlowingLayoutPipelineIdentity {
    pipeline.identity
  }

  public func layout(
    _ input: FlowingGraphLayoutInput<Schema>
  ) throws -> FlowingGraphLayoutResult<Schema> {
    try pipeline.layout(input)
  }
}

private struct FlowingSCCAnalysis<Schema: FlowingGraphLayoutSchema> {
  let components: [[Schema.NodeID]]
  let ranks: [Int]
  let weakComponents: [[Int]]

  init(input: FlowingGraphLayoutInput<Schema>) throws {
    let graph = input.topology.materializedGraph()
    components = graph.stronglyConnectedComponents()
    var componentByNodeID: [Schema.NodeID: Int] = [:]
    componentByNodeID.reserveCapacity(input.topology.nodeIDs.count)
    for (componentID, nodeIDs) in components.enumerated() {
      try Task.checkCancellation()
      for nodeID in nodeIDs {
        componentByNodeID[nodeID] = componentID
      }
    }

    var successors = Array(repeating: [Int](), count: components.count)
    var indegrees = Array(repeating: 0, count: components.count)
    var knownArcs: Set<FlowingSCCArc> = []
    for edge in input.topology.edges {
      guard case .directed(let source, let target) = edge.endpoints else { continue }
      let sourceID = componentByNodeID[input.topology.nodeID(for: source)]!
      let targetID = componentByNodeID[input.topology.nodeID(for: target)]!
      guard sourceID != targetID else { continue }
      let arc = FlowingSCCArc(source: sourceID, target: targetID)
      guard knownArcs.insert(arc).inserted else { continue }
      successors[sourceID].append(targetID)
      indegrees[targetID] += 1
    }

    var nextRanks = Array(repeating: 0, count: components.count)
    var queue = components.indices.filter { indegrees[$0] == 0 }
    var queueIndex = 0
    while queueIndex < queue.count {
      try Task.checkCancellation()
      let sourceID = queue[queueIndex]
      queueIndex += 1
      for targetID in successors[sourceID] {
        nextRanks[targetID] = max(nextRanks[targetID], nextRanks[sourceID] + 1)
        indegrees[targetID] -= 1
        if indegrees[targetID] == 0 {
          queue.append(targetID)
        }
      }
    }
    precondition(queue.count == components.count)
    ranks = nextRanks
    weakComponents = input.topology.weaklyConnectedComponents().map { nodeIDs in
      var seen: Set<Int> = []
      return nodeIDs.compactMap { nodeID in
        let componentID = componentByNodeID[nodeID]!
        return seen.insert(componentID).inserted ? componentID : nil
      }.sorted {
        if nextRanks[$0] != nextRanks[$1] { return nextRanks[$0] < nextRanks[$1] }
        return $0 < $1
      }
    }
  }
}

private struct FlowingSCCGeometry<Schema: FlowingGraphLayoutSchema> {
  let frames: [FlowingGraphNodeFrame<Schema>]
  let size: CGSize
}

private struct FlowingSCCArc: Hashable {
  let source: Int
  let target: Int
}
