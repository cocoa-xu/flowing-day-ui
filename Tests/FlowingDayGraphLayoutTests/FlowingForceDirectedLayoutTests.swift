import CoreGraphics
import FlowingDayGraphLayout
import XCTest

final class FlowingForceDirectedLayoutTests: XCTestCase {
  func testAcceptsDirectedUndirectedAndMixedEdges() throws {
    let strategy = FlowingForceDirectedLayout<ForceLayoutSchema>(configuration: configuration)
    let input = try makeInput(
      nodeIDs: ["a", "b", "c", "d"],
      edges: [
        directedEdge("a", "b"),
        undirectedEdge("b", "c"),
        directedEdge("c", "a"),
        undirectedEdge("c", "d"),
      ],
      strategy: strategy
    )

    let result = try strategy.layout(input)

    XCTAssertEqual(result.nodeFrames.count, 4)
    XCTAssertEqual(result.edgeRoutes.count, 4)
    XCTAssertFalse(
      try XCTUnwrap(result.frame(for: "a")).intersects(
        try XCTUnwrap(result.frame(for: "b"))
      ))
  }

  func testEdgeOrientationDoesNotChangeSpatialPlacement() throws {
    let strategy = FlowingForceDirectedLayout<ForceLayoutSchema>(configuration: configuration)
    let directed = try makeInput(
      nodeIDs: ["a", "b", "c"],
      edges: [directedEdge("a", "b"), directedEdge("b", "c")],
      strategy: strategy
    )
    let undirected = try makeInput(
      nodeIDs: ["a", "b", "c"],
      edges: [undirectedEdge("a", "b"), undirectedEdge("b", "c")],
      strategy: strategy
    )

    let directedResult = try strategy.layout(directed)
    let undirectedResult = try strategy.layout(undirected)

    XCTAssertEqual(directedResult.nodeFrames.map(\.frame), undirectedResult.nodeFrames.map(\.frame))
  }

  func testLayoutIsDeterministicForTheSameInput() throws {
    let strategy = FlowingForceDirectedLayout<ForceLayoutSchema>(configuration: configuration)
    let input = try makeInput(
      nodeIDs: ["a", "b", "c", "d", "e"],
      edges: [
        directedEdge("a", "b"),
        directedEdge("b", "c"),
        directedEdge("c", "a"),
        directedEdge("c", "d"),
        directedEdge("d", "e"),
      ],
      strategy: strategy
    )

    let first = try strategy.layout(input)
    let second = try strategy.layout(input)

    XCTAssertEqual(first.nodeFrames, second.nodeFrames)
    XCTAssertEqual(first.edgeRoutes, second.edgeRoutes)
    XCTAssertEqual(first.contentBounds, second.contentBounds)
  }

  func testPacksDisconnectedComponentsWithoutOverlap() throws {
    let strategy = FlowingForceDirectedLayout<ForceLayoutSchema>(configuration: configuration)
    let input = try makeInput(
      nodeIDs: ["a", "b", "c", "d", "e", "f"],
      edges: [
        undirectedEdge("a", "b"),
        undirectedEdge("b", "c"),
        undirectedEdge("d", "e"),
        undirectedEdge("e", "f"),
      ],
      strategy: strategy
    )

    let result = try strategy.layout(input)
    let first = try bounds(nodeIDs: ["a", "b", "c"], result: result)
    let second = try bounds(nodeIDs: ["d", "e", "f"], result: result)

    XCTAssertFalse(first.intersects(second))
  }

  func testRespectsVariableNodeSizesAndPlacementState() throws {
    let strategy = FlowingForceDirectedLayout<ForceLayoutSchema>(configuration: configuration)
    let topology = try FlowingGraphLayoutTopology<ForceLayoutSchema>(
      nodeIDs: ["small", "large"],
      ports: [],
      edges: [undirectedEdge("small", "large")]
    )
    let sizes = [
      "small": CGSize(width: 60, height: 40),
      "large": CGSize(width: 180, height: 120),
    ]
    let baselineInput = try resolve(topology: topology, sizes: sizes, strategy: strategy)
    let baseline = try strategy.layout(baselineInput)
    let offset = CGSize(width: 31, height: 17)
    let movedInput = try resolve(
      topology: topology,
      sizes: sizes,
      strategy: strategy,
      placementState: [FlowingGraphNodePlacementState(nodeID: "small", offset: offset)]
    )
    let moved = try strategy.layout(movedInput)

    XCTAssertEqual(moved.frame(for: "large"), baseline.frame(for: "large"))
    XCTAssertEqual(moved.frame(for: "large")?.size, sizes["large"])
    let baselineOrigin = try XCTUnwrap(baseline.frame(for: "small")?.origin)
    let movedOrigin = try XCTUnwrap(moved.frame(for: "small")?.origin)
    XCTAssertEqual(movedOrigin.x, baselineOrigin.x + offset.width, accuracy: 0.000_001)
    XCTAssertEqual(movedOrigin.y, baselineOrigin.y + offset.height, accuracy: 0.000_001)
  }

  func testDuplicateAndSelfEdgesDoNotDistortTheSimulation() throws {
    let strategy = FlowingForceDirectedLayout<ForceLayoutSchema>(configuration: configuration)
    let simple = try makeInput(
      nodeIDs: ["a", "b"],
      edges: [directedEdge("a", "b")],
      strategy: strategy
    )
    let repeated = try makeInput(
      nodeIDs: ["a", "b"],
      edges: [
        directedEdge("a", "b"),
        directedEdge("b", "a", id: "return"),
        directedEdge("a", "a", id: "loop"),
      ],
      strategy: strategy
    )

    let simpleResult = try strategy.layout(simple)
    let repeatedResult = try strategy.layout(repeated)

    XCTAssertEqual(simpleResult.nodeFrames.map(\.frame), repeatedResult.nodeFrames.map(\.frame))
    XCTAssertEqual(repeatedResult.edgeRoutes.count, 3)
  }

  func testCancelledLayoutStopsCooperatively() async throws {
    let strategy = FlowingForceDirectedLayout<ForceLayoutSchema>(configuration: configuration)
    let nodeIDs = (0..<2_000).map(String.init)
    let input = try makeInput(
      nodeIDs: nodeIDs,
      edges: (1..<nodeIDs.count).map {
        directedEdge(String($0 - 1), String($0), id: "edge-\($0)")
      },
      strategy: strategy
    )
    let task = Task {
      try strategy.layout(input)
    }
    task.cancel()

    do {
      _ = try await task.value
      XCTFail("Expected cancellation")
    } catch is CancellationError {
    }
  }

  func testBarnesHutPlacementHandlesTenThousandNodes() throws {
    let nodeCount = 10_000
    let nodeIDs = (0..<nodeCount).map(String.init)
    let edges = (1..<nodeCount).map {
      undirectedEdge(String($0 - 1), String($0), id: "edge-\($0)")
    }
    let strategy = FlowingForceDirectedLayout<ForceLayoutSchema>(
      configuration: largeGraphConfiguration
    )
    let input = try makeInput(nodeIDs: nodeIDs, edges: edges, strategy: strategy)

    let result = try strategy.layout(input)

    XCTAssertEqual(result.nodeFrames.count, nodeCount)
    XCTAssertEqual(result.edgeRoutes.count, nodeCount - 1)
  }

  func testEmptyGraphUsesTheMinimumCanvasSize() throws {
    let strategy = FlowingForceDirectedLayout<ForceLayoutSchema>(configuration: configuration)
    let input = try makeInput(nodeIDs: [], edges: [], strategy: strategy)

    let result = try strategy.layout(input)

    XCTAssertEqual(
      result.contentBounds,
      CGRect(origin: .zero, size: configuration.packing.minimumCanvasSize)
    )
  }

  private let configuration = FlowingForceDirectedLayoutConfiguration(
    simulation: FlowingForceSimulationConfiguration(
      iterationLimit: 80,
      idealEdgeLength: 120,
      repulsionStrength: 250_000,
      attractionStrength: 0.02,
      centeringStrength: 0.001,
      collisionStrength: 0.5,
      collisionPadding: 12,
      timeStep: 0.25,
      damping: 0.85,
      maximumDisplacement: 24,
      convergenceTolerance: 0.01,
      barnesHutTheta: 0.7,
      maximumTreeDepth: 24
    ),
    packing: FlowingForceComponentPackingConfiguration(
      componentSpacing: 72,
      componentPadding: 24,
      targetAspectRatio: 1.5,
      canvasInsets: FlowingLayoutInsets(horizontal: 24, vertical: 20),
      minimumCanvasSize: CGSize(width: 320, height: 240)
    )
  )

  private var largeGraphConfiguration: FlowingForceDirectedLayoutConfiguration {
    FlowingForceDirectedLayoutConfiguration(
      simulation: FlowingForceSimulationConfiguration(
        iterationLimit: 4,
        idealEdgeLength: 80,
        repulsionStrength: 100_000,
        attractionStrength: 0.02,
        centeringStrength: 0.001,
        collisionStrength: 0.25,
        collisionPadding: 8,
        timeStep: 0.2,
        damping: 0.8,
        maximumDisplacement: 20,
        convergenceTolerance: 0,
        barnesHutTheta: 0.8,
        maximumTreeDepth: 24
      ),
      packing: configuration.packing
    )
  }

  private func directedEdge(
    _ source: String,
    _ target: String,
    id: String? = nil
  ) -> FlowingGraphLayoutEdge<ForceLayoutSchema> {
    FlowingGraphLayoutEdge(
      id: id ?? "\(source)-\(target)",
      endpoints: .directed(source: .node(source), target: .node(target))
    )
  }

  private func undirectedEdge(
    _ first: String,
    _ second: String,
    id: String? = nil
  ) -> FlowingGraphLayoutEdge<ForceLayoutSchema> {
    FlowingGraphLayoutEdge(
      id: id ?? "\(first)-\(second)",
      endpoints: .undirected(.node(first), .node(second))
    )
  }

  private func makeInput<Strategy: FlowingGraphLayoutStrategy<ForceLayoutSchema>>(
    nodeIDs: [String],
    edges: [FlowingGraphLayoutEdge<ForceLayoutSchema>],
    strategy: Strategy
  ) throws -> FlowingGraphLayoutInput<ForceLayoutSchema> {
    let topology = try FlowingGraphLayoutTopology<ForceLayoutSchema>(
      nodeIDs: nodeIDs,
      ports: [],
      edges: edges
    )
    return try resolve(topology: topology, sizes: [:], strategy: strategy)
  }

  private func resolve<Strategy: FlowingGraphLayoutStrategy<ForceLayoutSchema>>(
    topology: FlowingGraphLayoutTopology<ForceLayoutSchema>,
    sizes: [String: CGSize],
    strategy: Strategy,
    placementState: [FlowingGraphNodePlacementState<ForceLayoutSchema>] = []
  ) throws -> FlowingGraphLayoutInput<ForceLayoutSchema> {
    try FlowingGraphLayoutResolution.input(
      topology: topology,
      nodeSizeResolver: ForceSizeResolver(sizes: sizes),
      portAnchorResolver: FlowingCenteredPortAnchorResolver(),
      pipelineIdentity: strategy.identity,
      placementState: placementState
    )
  }

  private func bounds(
    nodeIDs: [String],
    result: FlowingGraphLayoutResult<ForceLayoutSchema>
  ) throws -> CGRect {
    try nodeIDs.map { try XCTUnwrap(result.frame(for: $0)) }
      .reduce(.null) { $0.union($1) }
  }
}

private enum ForceLayoutSchema: FlowingGraphLayoutSchema {
  typealias NodeID = String
  typealias PortID = String
  typealias EdgeID = String
}

private struct ForceSizeResolver: FlowingGraphNodeSizeResolver {
  typealias Schema = ForceLayoutSchema

  let identity = FlowingLayoutComponentIdentity()
  let sizes: [String: CGSize]

  func size(for nodeID: String) throws -> CGSize {
    sizes[nodeID] ?? CGSize(width: 100, height: 60)
  }
}
