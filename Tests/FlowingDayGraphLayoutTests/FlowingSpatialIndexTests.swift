import FlowingDayGraphLayout
import XCTest

final class FlowingSpatialIndexTests: XCTestCase {
  func testSupportsLocalFrameUpdates() throws {
    var index = try FlowingSpatialIndex(
      entries: [
        FlowingSpatialIndexEntry(
          id: "first",
          frame: CGRect(x: 0, y: 0, width: 100, height: 60)
        ),
        FlowingSpatialIndexEntry(
          id: "second",
          frame: CGRect(x: 200, y: 0, width: 100, height: 60)
        ),
      ]
    )

    try index.updateFrame(
      CGRect(x: 600, y: 400, width: 100, height: 60),
      for: "first"
    )

    XCTAssertEqual(
      index.itemIDs(intersecting: CGRect(x: -20, y: -20, width: 160, height: 100)),
      []
    )
    XCTAssertEqual(
      index.itemIDs(intersecting: CGRect(x: 580, y: 380, width: 160, height: 100)),
      ["first"]
    )
  }

  func testQueryBudgetFallsBackWithoutChangingResults() throws {
    let index = try FlowingSpatialIndex(
      entries: [
        FlowingSpatialIndexEntry(
          id: "first",
          frame: CGRect(x: 0, y: 0, width: 100, height: 60)
        ),
        FlowingSpatialIndexEntry(
          id: "second",
          frame: CGRect(x: 2_000, y: 2_000, width: 100, height: 60)
        ),
      ],
      configuration: FlowingSpatialIndexConfiguration(maximumCellsPerQuery: 1)
    )

    XCTAssertEqual(
      index.itemIDs(intersecting: CGRect(x: -100, y: -100, width: 2_500, height: 2_500)),
      ["first", "second"]
    )
  }

  func testNearestQueryBudgetFallsBackWithoutChangingResults() throws {
    let index = try FlowingSpatialIndex(
      entries: [
        FlowingSpatialIndexEntry(
          id: "first",
          frame: CGRect(x: 0, y: 0, width: 100, height: 60)
        ),
        FlowingSpatialIndexEntry(
          id: "second",
          frame: CGRect(x: 2_000, y: 0, width: 100, height: 60)
        ),
      ],
      configuration: FlowingSpatialIndexConfiguration(
        maximumNearestCellsVisited: 1
      )
    )

    XCTAssertEqual(index.nearestItemID(to: CGPoint(x: 1_000, y: 30)), "first")
  }

  func testCullsTenThousandItemsToTheViewport() throws {
    let nodeCount = 10_000
    let entries = (0..<nodeCount).map { index in
      FlowingSpatialIndexEntry(
        id: index,
        frame: CGRect(
          x: CGFloat(index % 100) * 140,
          y: CGFloat(index / 100) * 100,
          width: 100,
          height: 60
        )
      )
    }
    let index = try FlowingSpatialIndex(entries: entries)
    let visible = index.itemIDs(
      intersecting: CGRect(x: 6_900, y: 4_900, width: 500, height: 400)
    )

    XCTAssertLessThan(visible.count, 40)
    XCTAssertTrue(visible.contains(5_050))
  }

  func testCullsOneHundredThousandItemsToTheViewport() throws {
    let nodeCount = 100_000
    let entries = (0..<nodeCount).map { index in
      FlowingSpatialIndexEntry(
        id: index,
        frame: CGRect(
          x: CGFloat(index % 500) * 140,
          y: CGFloat(index / 500) * 100,
          width: 100,
          height: 60
        )
      )
    }
    let index = try FlowingSpatialIndex(entries: entries)
    let visible = index.itemIDs(
      intersecting: CGRect(x: 34_900, y: 9_900, width: 500, height: 400)
    )

    XCTAssertLessThan(visible.count, 40)
    XCTAssertTrue(visible.contains(50_250))
  }

  func testRenderSliceDoesNotMaterializeOffscreenEdgeEndpoints() throws {
    let topology = try FlowingGraphLayoutTopology<RenderSchema>(
      nodeIDs: ["first", "second"],
      ports: [],
      edges: [
        FlowingGraphLayoutEdge(
          id: "edge",
          endpoints: .directed(source: .node("first"), target: .node("second"))
        )
      ]
    )
    let pipelineIdentity = FlowingLayoutPipelineIdentity(
      component: FlowingLayoutComponentIdentity()
    )
    let input = try FlowingGraphLayoutResolution.input(
      topology: topology,
      nodeSizeResolver: FlowingFixedNodeSizeResolver(
        size: CGSize(width: 100, height: 60)
      ),
      portAnchorResolver: FlowingCenteredPortAnchorResolver(),
      pipelineIdentity: pipelineIdentity
    )
    let placement = try FlowingGraphNodePlacement(
      input: input,
      nodeFrames: [
        FlowingGraphNodeFrame(
          nodeID: "first",
          frame: CGRect(x: 0, y: 0, width: 100, height: 60)
        ),
        FlowingGraphNodeFrame(
          nodeID: "second",
          frame: CGRect(x: 1_000, y: 0, width: 100, height: 60)
        ),
      ],
      contentBounds: CGRect(x: 0, y: 0, width: 1_100, height: 60)
    )
    let result = try FlowingGraphLayoutResult(
      input: input,
      placement: placement,
      edgeRoutes: [
        FlowingGraphLayoutEdgeRoute(
          edgeID: "edge",
          route: FlowingGraphEdgeRoute(
            start: CGPoint(x: 100, y: 30),
            segments: [.line(end: CGPoint(x: 1_000, y: 30))]
          )
        )
      ]
    )
    let index = try FlowingGraphRenderIndex(input: input, result: result)

    let slice = index.slice(
      intersecting: CGRect(x: 450, y: 0, width: 100, height: 60)
    )

    XCTAssertEqual(slice.nodeIDs, [])
    XCTAssertEqual(slice.nodeFrames, [])
    XCTAssertEqual(slice.edgeIDs, ["edge"])
    XCTAssertEqual(slice.edgeRoutes.map(\.edgeID), ["edge"])

    let zeroMarginIndex = try FlowingGraphRenderIndex(
      input: input,
      result: result,
      configuration: FlowingGraphRenderIndexConfiguration(edgeCullingMargin: 0)
    )
    XCTAssertEqual(
      zeroMarginIndex.slice(
        intersecting: CGRect(x: 450, y: 29, width: 100, height: 2)
      ).edgeIDs,
      ["edge"]
    )
  }

  func testRenderIndexSupportsAnEdgeLargerThanTheSpatialGridBudget() throws {
    let topology = try FlowingGraphLayoutTopology<RenderSchema>(
      nodeIDs: ["first", "second"],
      ports: [],
      edges: [
        FlowingGraphLayoutEdge(
          id: "edge",
          endpoints: .directed(source: .node("first"), target: .node("second"))
        )
      ]
    )
    let input = try makeInput(topology: topology)
    let placement = try makePlacement(input: input)
    let result = try FlowingGraphLayoutResult(
      input: input,
      placement: placement,
      edgeRoutes: [
        FlowingGraphLayoutEdgeRoute(
          edgeID: "edge",
          route: FlowingGraphEdgeRoute(
            start: .zero,
            segments: [.line(end: CGPoint(x: 100_000_000, y: 100_000_000))]
          )
        )
      ]
    )
    let index = try FlowingGraphRenderIndex(input: input, result: result)

    XCTAssertEqual(
      index.slice(
        intersecting: CGRect(x: 49_999_900, y: 49_999_900, width: 200, height: 200)
      ).edgeIDs,
      ["edge"]
    )
  }

  func testRenderIndexCullsTenThousandElongatedEdges() throws {
    let edgeCount = 10_000
    let edges = (0..<edgeCount).map { edgeIndex in
      FlowingGraphLayoutEdge<RenderSchema>(
        id: "edge-\(edgeIndex)",
        endpoints: .directed(source: .node("first"), target: .node("second"))
      )
    }
    let topology = try FlowingGraphLayoutTopology<RenderSchema>(
      nodeIDs: ["first", "second"],
      ports: [],
      edges: edges
    )
    let input = try makeInput(topology: topology)
    let placement = try makePlacement(input: input)
    let routes = edges.enumerated().map { edgeIndex, edge in
      let y = CGFloat(edgeIndex) * 100
      return FlowingGraphLayoutEdgeRoute<RenderSchema>(
        edgeID: edge.id,
        route: FlowingGraphEdgeRoute(
          start: CGPoint(x: 0, y: y),
          segments: [.line(end: CGPoint(x: 100_000, y: y))]
        )
      )
    }
    let result = try FlowingGraphLayoutResult(
      input: input,
      placement: placement,
      edgeRoutes: routes
    )
    let index = try FlowingGraphRenderIndex(input: input, result: result)

    XCTAssertEqual(
      index.slice(
        intersecting: CGRect(x: 49_900, y: 499_950, width: 200, height: 100)
      ).edgeIDs,
      ["edge-5000"]
    )
  }

  private func makeInput(
    topology: FlowingGraphLayoutTopology<RenderSchema>
  ) throws -> FlowingGraphLayoutInput<RenderSchema> {
    try FlowingGraphLayoutResolution.input(
      topology: topology,
      nodeSizeResolver: FlowingFixedNodeSizeResolver(
        size: CGSize(width: 100, height: 60)
      ),
      portAnchorResolver: FlowingCenteredPortAnchorResolver(),
      pipelineIdentity: FlowingLayoutPipelineIdentity(
        component: FlowingLayoutComponentIdentity()
      )
    )
  }

  private func makePlacement(
    input: FlowingGraphLayoutInput<RenderSchema>
  ) throws -> FlowingGraphNodePlacement<RenderSchema> {
    try FlowingGraphNodePlacement(
      input: input,
      nodeFrames: [
        FlowingGraphNodeFrame(
          nodeID: "first",
          frame: CGRect(x: 0, y: 0, width: 100, height: 60)
        ),
        FlowingGraphNodeFrame(
          nodeID: "second",
          frame: CGRect(x: 1_000, y: 0, width: 100, height: 60)
        ),
      ],
      contentBounds: CGRect(x: 0, y: 0, width: 1_100, height: 60)
    )
  }
}

private enum RenderSchema: FlowingGraphLayoutSchema {
  typealias NodeID = String
  typealias PortID = String
  typealias EdgeID = String
}
