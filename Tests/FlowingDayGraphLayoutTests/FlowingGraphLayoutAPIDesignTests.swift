import FlowingDayGraphLayout
import XCTest

final class FlowingGraphLayoutAPIDesignTests: XCTestCase {
  func testOfficialDriverAcceptsAConsumerStrategy() async throws {
    let strategy = pipeline()
    let driver = FlowingGraphLayoutDriver<TestLayoutSchema>()
    let outcome = try await driver.layout(
      topology: topology(),
      nodeSizeResolver: FlowingFixedNodeSizeResolver(
        size: CGSize(width: 100, height: 60)
      ),
      portAnchorResolver: FlowingCenteredPortAnchorResolver(),
      strategy: strategy
    )

    guard case let .completed(result) = outcome else {
      return XCTFail("Expected the current layout request to complete")
    }
    XCTAssertEqual(result.nodeFrames.count, 2)
    XCTAssertEqual(result.edgeRoutes.count, 1)
  }

  func testPipelineAcceptsTypedStageReplacement() throws {
    let strategy = FlowingGraphLayoutPipeline<TestLayoutSchema>(
      placement: TestPlacement(),
      postprocessors: [TestOffsetPostprocessor(offset: CGSize(width: 40, height: 20))],
      edgeRouter: TestEdgeRouter()
    )
    let input = try FlowingGraphLayoutResolution.input(
      topology: topology(),
      nodeSizeResolver: FlowingFixedNodeSizeResolver(
        size: CGSize(width: 100, height: 60)
      ),
      portAnchorResolver: FlowingCenteredPortAnchorResolver(),
      pipelineIdentity: strategy.identity
    )
    let result = try strategy.layout(input)

    XCTAssertEqual(result.frame(for: "source")?.origin, CGPoint(x: 40, y: 20))
    XCTAssertEqual(result.frame(for: "target")?.origin, CGPoint(x: 200, y: 20))
  }

  func testCustomExecutionProducesTheStandardResult() throws {
    let strategy = TestCustomStrategy()
    let input = try FlowingGraphLayoutResolution.input(
      topology: topology(),
      nodeSizeResolver: FlowingFixedNodeSizeResolver(
        size: CGSize(width: 100, height: 60)
      ),
      portAnchorResolver: FlowingCenteredPortAnchorResolver(),
      pipelineIdentity: strategy.identity
    )
    let result: FlowingGraphLayoutResult<TestLayoutSchema> = try strategy.layout(input)

    XCTAssertEqual(result.inputID, input.id)
    XCTAssertEqual(result.nodeFrames.map(\.nodeID), ["source", "target"])
  }

  private func pipeline() -> FlowingGraphLayoutPipeline<TestLayoutSchema> {
    FlowingGraphLayoutPipeline(
      placement: TestPlacement(),
      edgeRouter: TestEdgeRouter()
    )
  }

  private func topology() throws -> FlowingGraphLayoutTopology<TestLayoutSchema> {
    try FlowingGraphLayoutTopology(
      nodeIDs: ["source", "target"],
      ports: [],
      edges: [
        FlowingGraphLayoutEdge(
          id: "edge",
          endpoints: .directed(source: .node("source"), target: .node("target"))
        )
      ]
    )
  }
}

private enum TestLayoutSchema: FlowingGraphLayoutSchema {
  typealias NodeID = String
  typealias PortID = String
  typealias EdgeID = String
}

private struct TestPlacement: FlowingGraphNodePlacementStrategy {
  typealias Schema = TestLayoutSchema

  let identity = FlowingLayoutPipelineIdentity(
    components: [FlowingLayoutComponentIdentity()]
  )

  func place(
    _ input: FlowingGraphLayoutInput<TestLayoutSchema>
  ) throws -> FlowingGraphNodePlacement<TestLayoutSchema> {
    try FlowingGraphNodePlacement(
      input: input,
      nodeFrames: [
        FlowingGraphNodeFrame(
          nodeID: "source",
          frame: CGRect(origin: .zero, size: input.size(for: "source"))
        ),
        FlowingGraphNodeFrame(
          nodeID: "target",
          frame: CGRect(
            origin: CGPoint(x: 160, y: 0),
            size: input.size(for: "target")
          )
        ),
      ],
      contentBounds: CGRect(x: 0, y: 0, width: 260, height: 60)
    )
  }
}

private struct TestOffsetPostprocessor: FlowingGraphLayoutPostprocessor {
  typealias Schema = TestLayoutSchema

  let identity = FlowingLayoutComponentIdentity()
  let offset: CGSize

  func process(
    _ placement: FlowingGraphNodePlacement<TestLayoutSchema>,
    input: FlowingGraphLayoutInput<TestLayoutSchema>
  ) throws -> FlowingGraphNodePlacement<TestLayoutSchema> {
    try FlowingGraphNodePlacement(
      input: input,
      nodeFrames: placement.nodeFrames.map {
        FlowingGraphNodeFrame(
          nodeID: $0.nodeID,
          frame: $0.frame.offsetBy(dx: offset.width, dy: offset.height)
        )
      },
      contentBounds: placement.contentBounds.offsetBy(
        dx: offset.width,
        dy: offset.height
      )
    )
  }
}

private struct TestEdgeRouter: FlowingGraphEdgeRoutingStrategy {
  typealias Schema = TestLayoutSchema

  let identity = FlowingLayoutComponentIdentity()

  func routes(
    for input: FlowingGraphLayoutInput<TestLayoutSchema>,
    placement: FlowingGraphNodePlacement<TestLayoutSchema>
  ) throws -> [FlowingGraphLayoutEdgeRoute<TestLayoutSchema>] {
    input.topology.edges.map { edge in
      FlowingGraphLayoutEdgeRoute(
        edgeID: edge.id,
        route: FlowingGraphEdgeRoute(
          start: CGPoint(
            x: placement.frame(for: "source").maxX,
            y: placement.frame(for: "source").midY
          ),
          segments: [
            .line(
              end: CGPoint(
                x: placement.frame(for: "target").minX,
                y: placement.frame(for: "target").midY
              )
            )
          ]
        )
      )
    }
  }
}

private struct TestCustomStrategy: FlowingGraphLayoutStrategy {
  typealias Schema = TestLayoutSchema

  let identity = FlowingLayoutPipelineIdentity(
    components: [FlowingLayoutComponentIdentity()]
  )

  func layout(
    _ input: FlowingGraphLayoutInput<TestLayoutSchema>
  ) throws -> FlowingGraphLayoutResult<TestLayoutSchema> {
    let placement = try TestPlacement().place(input)
    return try FlowingGraphLayoutResult(
      input: input,
      placement: placement,
      edgeRoutes: try TestEdgeRouter().routes(for: input, placement: placement)
    )
  }
}
