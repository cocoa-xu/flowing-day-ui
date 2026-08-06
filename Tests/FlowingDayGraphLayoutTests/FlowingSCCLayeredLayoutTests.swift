import CoreGraphics
import FlowingDayGraphLayout
import XCTest

final class FlowingSCCLayeredLayoutTests: XCTestCase {
  func testPlacesCycleMembersTogetherAndDescendantsInTheNextLayer() throws {
    let strategy = FlowingSCCLayeredLayout<SCCLayoutSchema>(configuration: configuration)
    let input = try makeInput(
      nodeIDs: ["a", "b", "c", "descendant"],
      edges: [
        edge("a", "b"),
        edge("b", "c"),
        edge("c", "a"),
        edge("c", "descendant"),
      ],
      strategy: strategy,
      sizes: [
        "a": CGSize(width: 100, height: 50),
        "b": CGSize(width: 140, height: 60),
        "c": CGSize(width: 80, height: 70),
        "descendant": CGSize(width: 120, height: 50),
      ]
    )

    let result = try strategy.layout(input)
    let cycleFrames = try ["a", "b", "c"].map {
      try XCTUnwrap(result.frame(for: $0))
    }
    let descendant = try XCTUnwrap(result.frame(for: "descendant"))

    XCTAssertFalse(cycleFrames[0].intersects(cycleFrames[1]))
    XCTAssertFalse(cycleFrames[0].intersects(cycleFrames[2]))
    XCTAssertFalse(cycleFrames[1].intersects(cycleFrames[2]))
    XCTAssertLessThan(cycleFrames.map(\.maxY).max()!, descendant.minY)
    XCTAssertEqual(result.edgeRoutes.count, 4)
  }

  func testAcceptsMixedDirectedAndUndirectedTopology() throws {
    let strategy = FlowingSCCLayeredLayout<SCCLayoutSchema>(configuration: configuration)
    let input = try makeInput(
      nodeIDs: ["peer-a", "peer-b", "target"],
      edges: [
        undirectedEdge("peer-a", "peer-b"),
        edge("peer-b", "target"),
      ],
      strategy: strategy
    )

    let result = try strategy.layout(input)
    let peerA = try XCTUnwrap(result.frame(for: "peer-a"))
    let peerB = try XCTUnwrap(result.frame(for: "peer-b"))
    let target = try XCTUnwrap(result.frame(for: "target"))

    XCTAssertFalse(peerA.intersects(peerB))
    XCTAssertLessThan(max(peerA.maxY, peerB.maxY), target.minY)
  }

  func testLayoutIsDeterministicForTheSameInput() throws {
    let strategy = FlowingSCCLayeredLayout<SCCLayoutSchema>(configuration: configuration)
    let input = try makeInput(
      nodeIDs: ["a", "b", "c", "d"],
      edges: [
        edge("a", "b"),
        edge("b", "a"),
        edge("b", "c"),
        edge("a", "d"),
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
    let strategy = FlowingSCCLayeredLayout<SCCLayoutSchema>(configuration: configuration)
    let input = try makeInput(
      nodeIDs: ["first-root", "first-child", "second-root", "second-child"],
      edges: [
        edge("first-root", "first-child"),
        edge("second-root", "second-child"),
      ],
      strategy: strategy
    )

    let result = try strategy.layout(input)
    let firstBounds = try componentBounds(
      nodeIDs: ["first-root", "first-child"],
      result: result
    )
    let secondBounds = try componentBounds(
      nodeIDs: ["second-root", "second-child"],
      result: result
    )

    XCTAssertFalse(firstBounds.intersects(secondBounds))
    XCTAssertLessThan(firstBounds.maxX, secondBounds.minX)
  }

  func testPlacementStateOffsetsOnlyTheAddressedNode() throws {
    let strategy = FlowingSCCLayeredLayout<SCCLayoutSchema>(configuration: configuration)
    let topology = try FlowingGraphLayoutTopology<SCCLayoutSchema>(
      nodeIDs: ["a", "b"],
      ports: [],
      edges: [edge("a", "b"), edge("b", "a")]
    )
    let baselineInput = try resolve(topology: topology, strategy: strategy)
    let baseline = try strategy.layout(baselineInput)
    let offset = CGSize(width: 37, height: -19)
    let movedInput = try resolve(
      topology: topology,
      strategy: strategy,
      placementState: [FlowingGraphNodePlacementState(nodeID: "b", offset: offset)]
    )
    let moved = try strategy.layout(movedInput)

    XCTAssertEqual(moved.frame(for: "a"), baseline.frame(for: "a"))
    let movedOrigin = try XCTUnwrap(moved.frame(for: "b")?.origin)
    let expectedOrigin = try XCTUnwrap(baseline.frame(for: "b")?.origin).applying(offset)
    XCTAssertEqual(movedOrigin.x, expectedOrigin.x, accuracy: 0.000_001)
    XCTAssertEqual(movedOrigin.y, expectedOrigin.y, accuracy: 0.000_001)
  }

  func testLayoutIsStackSafeForTenThousandNodeCycle() throws {
    let nodeCount = 10_000
    let nodeIDs = (0..<nodeCount).map(String.init)
    let edges = (0..<nodeCount).map { index in
      edge(
        String(index),
        String((index + 1) % nodeCount),
        id: "edge-\(index)"
      )
    }
    let strategy = FlowingSCCLayeredLayout<SCCLayoutSchema>(configuration: configuration)
    let input = try makeInput(nodeIDs: nodeIDs, edges: edges, strategy: strategy)

    let result = try strategy.layout(input)

    XCTAssertEqual(result.nodeFrames.count, nodeCount)
    XCTAssertEqual(result.edgeRoutes.count, nodeCount)
  }

  func testEmptyGraphUsesTheMinimumCanvasSize() throws {
    let strategy = FlowingSCCLayeredLayout<SCCLayoutSchema>(configuration: configuration)
    let input = try makeInput(nodeIDs: [], edges: [], strategy: strategy)

    let result = try strategy.layout(input)

    XCTAssertTrue(result.nodeFrames.isEmpty)
    XCTAssertEqual(
      result.contentBounds, CGRect(origin: .zero, size: configuration.minimumCanvasSize))
  }

  private let configuration = FlowingSCCLayeredLayoutConfiguration(
    horizontalComponentSpacing: 56,
    verticalLayerSpacing: 72,
    weakComponentSpacing: 96,
    cyclicNodeSpacing: 36,
    cyclicComponentPadding: 20,
    canvasInsets: FlowingLayoutInsets(horizontal: 24, vertical: 20),
    minimumCanvasSize: CGSize(width: 320, height: 240)
  )

  private func edge(
    _ source: String,
    _ target: String,
    id: String? = nil
  ) -> FlowingGraphLayoutEdge<SCCLayoutSchema> {
    FlowingGraphLayoutEdge(
      id: id ?? "\(source)-\(target)",
      endpoints: .directed(source: .node(source), target: .node(target))
    )
  }

  private func undirectedEdge(
    _ first: String,
    _ second: String
  ) -> FlowingGraphLayoutEdge<SCCLayoutSchema> {
    FlowingGraphLayoutEdge(
      id: "\(first)-\(second)",
      endpoints: .undirected(.node(first), .node(second))
    )
  }

  private func makeInput<Strategy: FlowingGraphLayoutStrategy<SCCLayoutSchema>>(
    nodeIDs: [String],
    edges: [FlowingGraphLayoutEdge<SCCLayoutSchema>],
    strategy: Strategy,
    sizes: [String: CGSize] = [:]
  ) throws -> FlowingGraphLayoutInput<SCCLayoutSchema> {
    let topology = try FlowingGraphLayoutTopology<SCCLayoutSchema>(
      nodeIDs: nodeIDs,
      ports: [],
      edges: edges
    )
    return try FlowingGraphLayoutResolution.input(
      topology: topology,
      nodeSizeResolver: SCCSizeResolver(sizes: sizes),
      portAnchorResolver: FlowingCenteredPortAnchorResolver(),
      pipelineIdentity: strategy.identity
    )
  }

  private func resolve<Strategy: FlowingGraphLayoutStrategy<SCCLayoutSchema>>(
    topology: FlowingGraphLayoutTopology<SCCLayoutSchema>,
    strategy: Strategy,
    placementState: [FlowingGraphNodePlacementState<SCCLayoutSchema>] = []
  ) throws -> FlowingGraphLayoutInput<SCCLayoutSchema> {
    try FlowingGraphLayoutResolution.input(
      topology: topology,
      nodeSizeResolver: SCCSizeResolver(sizes: [:]),
      portAnchorResolver: FlowingCenteredPortAnchorResolver(),
      pipelineIdentity: strategy.identity,
      placementState: placementState
    )
  }

  private func componentBounds(
    nodeIDs: [String],
    result: FlowingGraphLayoutResult<SCCLayoutSchema>
  ) throws -> CGRect {
    try nodeIDs.map { try XCTUnwrap(result.frame(for: $0)) }
      .reduce(.null) { $0.union($1) }
  }
}

private enum SCCLayoutSchema: FlowingGraphLayoutSchema {
  typealias NodeID = String
  typealias PortID = String
  typealias EdgeID = String
}

private struct SCCSizeResolver: FlowingGraphNodeSizeResolver {
  typealias Schema = SCCLayoutSchema

  let identity = FlowingLayoutComponentIdentity()
  let sizes: [String: CGSize]

  func size(for nodeID: String) throws -> CGSize {
    sizes[nodeID] ?? CGSize(width: 100, height: 60)
  }
}

extension CGPoint {
  fileprivate func applying(_ offset: CGSize) -> CGPoint {
    CGPoint(x: x + offset.width, y: y + offset.height)
  }
}
