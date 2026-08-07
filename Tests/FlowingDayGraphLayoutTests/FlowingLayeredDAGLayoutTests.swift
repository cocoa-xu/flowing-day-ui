import FlowingDayGraphLayout
import XCTest

final class FlowingLayeredDAGLayoutTests: XCTestCase {
  func testLayeredLayoutPlacesDescendantsBelowParentsWithResolvedSizes() throws {
    let strategy = FlowingLayeredDAGLayout<LayoutSchema>(configuration: configuration)
    let input = try makeInput(
      nodeIDs: ["root", "wide", "narrow"],
      edges: [edge("root", "wide"), edge("root", "narrow")],
      strategy: strategy,
      sizeResolver: VariableSizeResolver(
        sizes: [
          "root": CGSize(width: 100, height: 50),
          "wide": CGSize(width: 180, height: 70),
          "narrow": CGSize(width: 80, height: 40),
        ]
      )
    )
    let result = try strategy.layout(input)

    let root = try XCTUnwrap(result.frame(for: "root"))
    let wide = try XCTUnwrap(result.frame(for: "wide"))
    let narrow = try XCTUnwrap(result.frame(for: "narrow"))
    XCTAssertLessThan(root.maxY, wide.minY)
    XCTAssertLessThan(root.maxY, narrow.minY)
    XCTAssertEqual(wide.size, CGSize(width: 180, height: 70))
    XCTAssertEqual(narrow.size, CGSize(width: 80, height: 40))
  }

  func testLayeredLayoutIsStackSafeForTenThousandNodePath() throws {
    let nodeCount = 10_000
    let nodeIDs = (0..<nodeCount).map(String.init)
    let edges = (1..<nodeCount).map { index in
      FlowingGraphLayoutEdge<LayoutSchema>(
        id: "edge-\(index)",
        endpoints: .directed(
          source: .node(String(index - 1)),
          target: .node(String(index))
        )
      )
    }
    let strategy = FlowingLayeredDAGLayout<LayoutSchema>(configuration: configuration)
    let input = try makeInput(
      nodeIDs: nodeIDs,
      edges: edges,
      strategy: strategy
    )

    let result = try strategy.layout(input)

    XCTAssertEqual(result.nodeFrames.count, nodeCount)
    XCTAssertEqual(result.edgeRoutes.count, nodeCount - 1)
    XCTAssertLessThan(
      try XCTUnwrap(result.frame(for: "0")?.minY),
      try XCTUnwrap(result.frame(for: String(nodeCount - 1))?.minY)
    )
  }

  func testLayerAssignmentCanBeReplacedWithoutReplacingThePipeline() throws {
    let coordinateAssignment = FlowingCenteredLayerCoordinates<LayoutSchema>(
      configuration: configuration
    )
    let strategy = FlowingLayeredDAGLayout<LayoutSchema>(
      layerAssignment: GapLayerAssignment(),
      layerOrdering: FlowingStableLayerOrdering(),
      coordinateAssignment: coordinateAssignment,
      edgeRouter: FlowingCubicEdgeRouter()
    )
    let input = try makeInput(
      nodeIDs: ["root", "child"],
      edges: [edge("root", "child")],
      strategy: strategy
    )
    let result = try strategy.layout(input)

    XCTAssertEqual(result.frame(for: "root")?.minY, 20)
    XCTAssertEqual(result.frame(for: "child")?.minY, 180)
  }

  func testSparseLayerRanksDoNotRequireDenseStorage() throws {
    let coordinateAssignment = FlowingCenteredLayerCoordinates<LayoutSchema>(
      configuration: configuration
    )
    let strategy = FlowingLayeredDAGLayout<LayoutSchema>(
      layerAssignment: SparseLayerAssignment(),
      layerOrdering: FlowingStableLayerOrdering(),
      coordinateAssignment: coordinateAssignment,
      edgeRouter: FlowingCubicEdgeRouter()
    )
    let input = try makeInput(
      nodeIDs: ["root", "child"],
      edges: [edge("root", "child")],
      strategy: strategy
    )

    let result = try strategy.layout(input)

    XCTAssertEqual(result.frame(for: "root")?.minY, 20)
    XCTAssertEqual(result.frame(for: "child")?.minY, 50_000_000_080)
  }

  func testGenericPipelineAcceptsACyclicGraph() throws {
    let strategy = FlowingGraphLayoutPipeline<LayoutSchema>(
      placement: LinearPlacement(),
      edgeRouter: FlowingCubicEdgeRouter()
    )
    let input = try makeInput(
      nodeIDs: ["first", "second"],
      edges: [edge("first", "second"), edge("second", "first", id: "return")],
      strategy: strategy
    )
    let result = try strategy.layout(input)

    XCTAssertEqual(result.edgeRoutes.count, 2)
  }

  func testLayeredLayoutRejectsCyclesWithEdgeEvidence() throws {
    let strategy = FlowingLayeredDAGLayout<LayoutSchema>(configuration: configuration)
    let input = try makeInput(
      nodeIDs: ["first", "second"],
      edges: [edge("first", "second"), edge("second", "first", id: "return")],
      strategy: strategy
    )

    XCTAssertThrowsError(try strategy.layout(input)) { error in
      guard case FlowingGraphLayoutDAGValidationIssue<LayoutSchema>.cycle(let edgePath) = error
      else { return XCTFail("Expected cycle evidence") }
      XCTAssertEqual(Set(edgePath), ["first-second", "return"])
    }
  }

  func testLayeredLayoutRejectsUndirectedEdges() throws {
    let strategy = FlowingLayeredDAGLayout<LayoutSchema>(configuration: configuration)
    let topology = try FlowingGraphLayoutTopology<LayoutSchema>(
      nodeIDs: ["first", "second"],
      ports: [],
      edges: [
        FlowingGraphLayoutEdge(
          id: "undirected",
          endpoints: .undirected(.node("first"), .node("second"))
        )
      ]
    )
    let input = try resolve(topology: topology, strategy: strategy)

    XCTAssertThrowsError(try strategy.layout(input)) { error in
      XCTAssertEqual(
        error as? FlowingGraphLayoutDAGValidationIssue<LayoutSchema>,
        .undirectedEdges(["undirected"])
      )
    }
  }

  func testNestedPresentationIdentityNeedsNoLayoutSpecialCase() throws {
    let root = NestedNodeID(path: ["document"], localID: "root")
    let child = NestedNodeID(path: ["document", "instance"], localID: "child")
    let strategy = FlowingLayeredDAGLayout<NestedLayoutSchema>(
      configuration: configuration
    )
    let topology = try FlowingGraphLayoutTopology<NestedLayoutSchema>(
      nodeIDs: [root, child],
      ports: [],
      edges: [
        FlowingGraphLayoutEdge(
          id: "nested-edge",
          endpoints: .directed(source: .node(root), target: .node(child))
        )
      ]
    )
    let input = try FlowingGraphLayoutResolution.input(
      topology: topology,
      nodeSizeResolver: FlowingFixedNodeSizeResolver(
        size: CGSize(width: 100, height: 60)
      ),
      portAnchorResolver: FlowingCenteredPortAnchorResolver(),
      pipelineIdentity: strategy.identity
    )
    let result = try strategy.layout(input)

    XCTAssertNotNil(result.frame(for: child))
  }

  func testCustomPortAnchorControlsTheEdgeEndpoint() throws {
    let strategy = FlowingGraphLayoutPipeline<LayoutSchema>(
      placement: LinearPlacement(),
      edgeRouter: FlowingCubicEdgeRouter()
    )
    let topology = try FlowingGraphLayoutTopology<LayoutSchema>(
      nodeIDs: ["first", "second"],
      ports: [FlowingGraphLayoutPort(id: "output", nodeID: "first")],
      edges: [
        FlowingGraphLayoutEdge(
          id: "edge",
          endpoints: .directed(
            source: .port(
              FlowingGraphLayoutPortKey(nodeID: "first", portID: "output")
            ),
            target: .node("second")
          )
        )
      ]
    )
    let input = try FlowingGraphLayoutResolution.input(
      topology: topology,
      nodeSizeResolver: FlowingFixedNodeSizeResolver(
        size: CGSize(width: 100, height: 60)
      ),
      portAnchorResolver: OutputAnchorResolver(),
      pipelineIdentity: strategy.identity
    )
    let result = try strategy.layout(input)

    XCTAssertEqual(result.route(for: "edge")?.start, CGPoint(x: 100, y: 15))
  }

  func testPortIdentityIsScopedToItsNode() throws {
    let firstKey = FlowingGraphLayoutPortKey<LayoutSchema>(
      nodeID: "first",
      portID: "output"
    )
    let secondKey = FlowingGraphLayoutPortKey<LayoutSchema>(
      nodeID: "second",
      portID: "output"
    )
    let strategy = FlowingGraphLayoutPipeline<LayoutSchema>(
      placement: LinearPlacement(),
      edgeRouter: FlowingCubicEdgeRouter()
    )
    let topology = try FlowingGraphLayoutTopology<LayoutSchema>(
      nodeIDs: ["first", "second"],
      ports: [
        FlowingGraphLayoutPort(key: firstKey),
        FlowingGraphLayoutPort(key: secondKey),
      ],
      edges: [
        FlowingGraphLayoutEdge(
          id: "edge",
          endpoints: .directed(source: .port(firstKey), target: .port(secondKey))
        )
      ]
    )
    let input = try FlowingGraphLayoutResolution.input(
      topology: topology,
      nodeSizeResolver: FlowingFixedNodeSizeResolver(
        size: CGSize(width: 100, height: 60)
      ),
      portAnchorResolver: FlowingCenteredPortAnchorResolver(),
      pipelineIdentity: strategy.identity
    )

    let result = try strategy.layout(input)

    XCTAssertEqual(result.resolvedPortAnchors.map(\.key), [firstKey, secondKey])
  }

  func testValidatedLookupsReturnNilForUnknownIdentifiers() throws {
    let key = FlowingGraphLayoutPortKey<LayoutSchema>(
      nodeID: "node",
      portID: "output"
    )
    let strategy = FlowingGraphLayoutPipeline<LayoutSchema>(
      placement: LinearPlacement(),
      edgeRouter: FlowingCubicEdgeRouter()
    )
    let topology = try FlowingGraphLayoutTopology<LayoutSchema>(
      nodeIDs: ["node"],
      ports: [FlowingGraphLayoutPort(key: key)],
      edges: []
    )
    let input = try FlowingGraphLayoutResolution.input(
      topology: topology,
      nodeSizeResolver: FlowingFixedNodeSizeResolver(
        size: CGSize(width: 100, height: 60)
      ),
      portAnchorResolver: FlowingCenteredPortAnchorResolver(),
      pipelineIdentity: strategy.identity
    )
    let placement = try LinearPlacement().place(input)
    let assignment = try FlowingLayerAssignment(
      input: input,
      ranks: [("node", 0)]
    )

    XCTAssertNil(input.size(for: "missing"))
    XCTAssertNil(input.placementOffset(for: "missing"))
    XCTAssertNil(
      input.anchor(
        for: FlowingGraphLayoutPortKey(nodeID: "node", portID: "missing")
      )
    )
    XCTAssertNil(placement.frame(for: "missing"))
    XCTAssertNil(assignment.rank(for: "missing"))
  }

  func testSelfLoopConnectsBothPortAnchors() throws {
    let output = FlowingGraphLayoutPortKey<LayoutSchema>(
      nodeID: "node",
      portID: "output"
    )
    let inputPort = FlowingGraphLayoutPortKey<LayoutSchema>(
      nodeID: "node",
      portID: "input"
    )
    let strategy = FlowingGraphLayoutPipeline<LayoutSchema>(
      placement: LinearPlacement(),
      edgeRouter: FlowingCubicEdgeRouter()
    )
    let topology = try FlowingGraphLayoutTopology<LayoutSchema>(
      nodeIDs: ["node"],
      ports: [
        FlowingGraphLayoutPort(key: output),
        FlowingGraphLayoutPort(key: inputPort),
      ],
      edges: [
        FlowingGraphLayoutEdge(
          id: "loop",
          endpoints: .directed(source: .port(output), target: .port(inputPort))
        )
      ]
    )
    let input = try FlowingGraphLayoutResolution.input(
      topology: topology,
      nodeSizeResolver: FlowingFixedNodeSizeResolver(
        size: CGSize(width: 100, height: 60)
      ),
      portAnchorResolver: LoopAnchorResolver(),
      pipelineIdentity: strategy.identity
    )

    let route = try XCTUnwrap(try strategy.layout(input).route(for: "loop"))

    XCTAssertEqual(route.start, CGPoint(x: 100, y: 15))
    guard case .cubic(_, _, let end)? = route.segments.last else {
      return XCTFail("Expected a cubic loop segment")
    }
    XCTAssertEqual(end, CGPoint(x: 0, y: 45))
  }

  func testResultBoundsIncludeCustomEdgeGeometry() throws {
    let strategy = FlowingGraphLayoutPipeline<LayoutSchema>(
      placement: LinearPlacement(),
      edgeRouter: EscapingEdgeRouter()
    )
    let input = try makeInput(
      nodeIDs: ["first", "second"],
      edges: [edge("first", "second")],
      strategy: strategy
    )
    let result = try strategy.layout(input)

    XCTAssertGreaterThanOrEqual(result.contentBounds.maxY, 500)
  }

  func testResultRejectsEdgeGeometryWithOverflowingBounds() throws {
    let strategy = FlowingGraphLayoutPipeline<LayoutSchema>(
      placement: LinearPlacement(),
      edgeRouter: OverflowingEdgeRouter()
    )
    let input = try makeInput(
      nodeIDs: ["first", "second"],
      edges: [edge("first", "second")],
      strategy: strategy
    )

    XCTAssertThrowsError(try strategy.layout(input)) { error in
      XCTAssertEqual(
        error as? FlowingGraphLayoutResultIssue<LayoutSchema>,
        .invalidEdgeRoute("first-second")
      )
    }
  }

  func testInputNormalizesResolvedTablesToTopologyOrder() throws {
    let strategy = FlowingGraphLayoutPipeline<LayoutSchema>(
      placement: LinearPlacement(),
      edgeRouter: FlowingCubicEdgeRouter()
    )
    let topology = try FlowingGraphLayoutTopology<LayoutSchema>(
      nodeIDs: ["first", "second"],
      ports: [],
      edges: []
    )
    let input = try FlowingGraphLayoutInput(
      id: FlowingLayoutInputID(
        presentationSnapshotID: topology.snapshotID,
        pipelineIdentity: strategy.identity,
        nodeSizeRevision: .init(),
        portAnchorRevision: .init(),
        layoutStateRevision: .init()
      ),
      topology: topology,
      nodeSizes: [
        FlowingGraphLayoutNodeSize(
          nodeID: "second",
          size: CGSize(width: 100, height: 60)
        ),
        FlowingGraphLayoutNodeSize(
          nodeID: "first",
          size: CGSize(width: 100, height: 60)
        ),
      ],
      portAnchors: []
    )

    XCTAssertEqual(input.nodeSizes.map(\.nodeID), ["first", "second"])
  }

  func testInputRejectsAMismatchedPresentationSnapshotIdentity() throws {
    let topology = try FlowingGraphLayoutTopology<LayoutSchema>(
      nodeIDs: ["node"],
      ports: [],
      edges: []
    )

    XCTAssertThrowsError(
      try FlowingGraphLayoutInput(
        id: FlowingLayoutInputID(
          presentationSnapshotID: .init(),
          pipelineIdentity: FlowingLayoutPipelineIdentity(stages: []),
          nodeSizeRevision: .init(),
          portAnchorRevision: .init(),
          layoutStateRevision: .init()
        ),
        topology: topology,
        nodeSizes: [
          FlowingGraphLayoutNodeSize(
            nodeID: "node",
            size: CGSize(width: 100, height: 60)
          )
        ],
        portAnchors: []
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphLayoutInputIssue<LayoutSchema>,
        .presentationSnapshotIdentityMismatch
      )
    }
  }

  func testComponentRevisionParticipatesInInputIdentity() throws {
    let strategy = FlowingGraphLayoutPipeline<LayoutSchema>(
      placement: LinearPlacement(),
      edgeRouter: FlowingCubicEdgeRouter()
    )
    let topology = try FlowingGraphLayoutTopology<LayoutSchema>(
      nodeIDs: ["node"],
      ports: [],
      edges: []
    )
    let componentID = UUID()
    let first = try FlowingGraphLayoutResolution.input(
      topology: topology,
      nodeSizeResolver: FlowingFixedNodeSizeResolver(
        size: CGSize(width: 100, height: 60),
        identity: FlowingLayoutComponentIdentity(id: componentID, revision: 1)
      ),
      portAnchorResolver: FlowingCenteredPortAnchorResolver(),
      pipelineIdentity: strategy.identity
    )
    let second = try FlowingGraphLayoutResolution.input(
      topology: topology,
      nodeSizeResolver: FlowingFixedNodeSizeResolver(
        size: CGSize(width: 100, height: 60),
        identity: FlowingLayoutComponentIdentity(id: componentID, revision: 2)
      ),
      portAnchorResolver: FlowingCenteredPortAnchorResolver(),
      pipelineIdentity: strategy.identity
    )

    XCTAssertNotEqual(first.id, second.id)
  }

  private var configuration: FlowingLayeredLayoutConfiguration {
    FlowingLayeredLayoutConfiguration(
      horizontalNodeSpacing: 30,
      verticalNodeSpacing: 50,
      componentSpacing: 70,
      canvasInsets: FlowingLayoutInsets(horizontal: 20, vertical: 20),
      minimumCanvasSize: CGSize(width: 500, height: 300)
    )
  }

  private func edge(
    _ source: String,
    _ target: String,
    id: String? = nil
  ) -> FlowingGraphLayoutEdge<LayoutSchema> {
    FlowingGraphLayoutEdge(
      id: id ?? "\(source)-\(target)",
      endpoints: .directed(source: .node(source), target: .node(target))
    )
  }

  private func makeInput<
    Strategy: FlowingGraphLayoutStrategy<LayoutSchema>,
    SizeResolver: FlowingGraphNodeSizeResolver<LayoutSchema>
  >(
    nodeIDs: [String],
    edges: [FlowingGraphLayoutEdge<LayoutSchema>],
    strategy: Strategy,
    sizeResolver: SizeResolver
  ) throws -> FlowingGraphLayoutInput<LayoutSchema> {
    let topology = try FlowingGraphLayoutTopology<LayoutSchema>(
      nodeIDs: nodeIDs,
      ports: [],
      edges: edges
    )
    return try FlowingGraphLayoutResolution.input(
      topology: topology,
      nodeSizeResolver: sizeResolver,
      portAnchorResolver: FlowingCenteredPortAnchorResolver(),
      pipelineIdentity: strategy.identity
    )
  }

  private func makeInput<Strategy: FlowingGraphLayoutStrategy<LayoutSchema>>(
    nodeIDs: [String],
    edges: [FlowingGraphLayoutEdge<LayoutSchema>],
    strategy: Strategy
  ) throws -> FlowingGraphLayoutInput<LayoutSchema> {
    try makeInput(
      nodeIDs: nodeIDs,
      edges: edges,
      strategy: strategy,
      sizeResolver: FlowingFixedNodeSizeResolver(
        size: CGSize(width: 100, height: 60)
      )
    )
  }

  private func resolve<Strategy: FlowingGraphLayoutStrategy<LayoutSchema>>(
    topology: FlowingGraphLayoutTopology<LayoutSchema>,
    strategy: Strategy
  ) throws -> FlowingGraphLayoutInput<LayoutSchema> {
    try FlowingGraphLayoutResolution.input(
      topology: topology,
      nodeSizeResolver: FlowingFixedNodeSizeResolver(
        size: CGSize(width: 100, height: 60)
      ),
      portAnchorResolver: FlowingCenteredPortAnchorResolver(),
      pipelineIdentity: strategy.identity
    )
  }
}

private enum LayoutSchema: FlowingGraphLayoutSchema {
  typealias NodeID = String
  typealias PortID = String
  typealias EdgeID = String
}

private struct NestedNodeID: Hashable, Sendable {
  let path: [String]
  let localID: String
}

private enum NestedLayoutSchema: FlowingGraphLayoutSchema {
  typealias NodeID = NestedNodeID
  typealias PortID = String
  typealias EdgeID = String
}

private struct VariableSizeResolver: FlowingGraphNodeSizeResolver {
  typealias Schema = LayoutSchema

  let identity = FlowingLayoutComponentIdentity()
  let sizes: [String: CGSize]

  func size(for nodeID: String) throws -> CGSize {
    sizes[nodeID]!
  }
}

private struct GapLayerAssignment: FlowingLayerAssignmentStrategy {
  typealias Schema = LayoutSchema

  let identity = FlowingLayoutComponentIdentity()

  func assignLayers(
    to view: FlowingGraphLayoutDAGView<LayoutSchema>
  ) throws -> FlowingLayerAssignment<LayoutSchema> {
    try FlowingLayerAssignment(
      input: view.input,
      ranks: [("root", 0), ("child", 2)]
    )
  }
}

private struct SparseLayerAssignment: FlowingLayerAssignmentStrategy {
  typealias Schema = LayoutSchema

  let identity = FlowingLayoutComponentIdentity()

  func assignLayers(
    to view: FlowingGraphLayoutDAGView<LayoutSchema>
  ) throws -> FlowingLayerAssignment<LayoutSchema> {
    try FlowingLayerAssignment(
      input: view.input,
      ranks: [("root", 0), ("child", 1_000_000_000)]
    )
  }
}

private struct LinearPlacement: FlowingGraphNodePlacementStrategy {
  typealias Schema = LayoutSchema

  let identity = FlowingLayoutPipelineIdentity(
    component: FlowingLayoutComponentIdentity()
  )

  func place(
    _ input: FlowingGraphLayoutInput<LayoutSchema>
  ) throws -> FlowingGraphNodePlacement<LayoutSchema> {
    let frames = input.topology.nodeIDs.enumerated().map { index, nodeID in
      let size = input.nodeSizes[index].size
      return FlowingGraphNodeFrame<LayoutSchema>(
        nodeID: nodeID,
        frame: CGRect(
          x: CGFloat(index) * 160,
          y: 0,
          width: size.width,
          height: size.height
        )
      )
    }
    return try FlowingGraphNodePlacement(
      input: input,
      nodeFrames: frames,
      contentBounds: CGRect(x: 0, y: 0, width: max(CGFloat(frames.count) * 160, 100), height: 60)
    )
  }
}

private struct OutputAnchorResolver: FlowingGraphPortAnchorResolver {
  typealias Schema = LayoutSchema

  let identity = FlowingLayoutComponentIdentity()

  func anchor(
    for port: FlowingGraphLayoutPort<LayoutSchema>,
    nodeSize: CGSize
  ) throws -> FlowingGraphPortAnchor<LayoutSchema> {
    FlowingGraphPortAnchor(
      key: port.key,
      position: CGPoint(x: nodeSize.width, y: 15),
      normal: CGVector(dx: 1, dy: 0)
    )
  }
}

private struct LoopAnchorResolver: FlowingGraphPortAnchorResolver {
  typealias Schema = LayoutSchema

  let identity = FlowingLayoutComponentIdentity()

  func anchor(
    for port: FlowingGraphLayoutPort<LayoutSchema>,
    nodeSize: CGSize
  ) throws -> FlowingGraphPortAnchor<LayoutSchema> {
    let position =
      port.id == "output"
      ? CGPoint(x: nodeSize.width, y: 15)
      : CGPoint(x: 0, y: 45)
    return FlowingGraphPortAnchor(
      key: port.key,
      position: position,
      normal: .zero
    )
  }
}

private struct EscapingEdgeRouter: FlowingGraphEdgeRoutingStrategy {
  typealias Schema = LayoutSchema

  let identity = FlowingLayoutComponentIdentity()

  func routes(
    for input: FlowingGraphLayoutInput<LayoutSchema>,
    placement: FlowingGraphNodePlacement<LayoutSchema>
  ) throws -> [FlowingGraphLayoutEdgeRoute<LayoutSchema>] {
    [
      FlowingGraphLayoutEdgeRoute(
        edgeID: input.topology.edges[0].id,
        route: FlowingGraphEdgeRoute(
          start: .zero,
          segments: [.line(end: CGPoint(x: 200, y: 500))]
        )
      )
    ]
  }
}

private struct OverflowingEdgeRouter: FlowingGraphEdgeRoutingStrategy {
  typealias Schema = LayoutSchema

  let identity = FlowingLayoutComponentIdentity()

  func routes(
    for input: FlowingGraphLayoutInput<LayoutSchema>,
    placement: FlowingGraphNodePlacement<LayoutSchema>
  ) throws -> [FlowingGraphLayoutEdgeRoute<LayoutSchema>] {
    [
      FlowingGraphLayoutEdgeRoute(
        edgeID: input.topology.edges[0].id,
        route: FlowingGraphEdgeRoute(
          start: CGPoint(x: -CGFloat.greatestFiniteMagnitude, y: 0),
          segments: [
            .line(end: CGPoint(x: CGFloat.greatestFiniteMagnitude, y: 0))
          ]
        )
      )
    ]
  }
}
