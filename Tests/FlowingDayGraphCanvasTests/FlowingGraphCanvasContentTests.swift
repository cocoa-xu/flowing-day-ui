import FlowingDayGraphCanvas
import FlowingDayGraphComposition
import FlowingDayGraphCore
import FlowingDayGraphLayout
import XCTest

private enum CanvasGraphSchema: FlowingGraphSchema {
  typealias NodeID = String
  typealias NodeValue = String
  typealias PortID = String
  typealias PortValue = String
  typealias EdgeID = String
  typealias EdgeValue = String
}

private enum CanvasCompositionSchema: FlowingGraphCanvasSchema {
  typealias DocumentID = String
  typealias GraphID = String
  typealias EntryPointID = String
  typealias LinkID = String
  typealias LinkValue = String
  typealias OccurrenceID = String
  typealias GraphSchema = CanvasGraphSchema
}

private typealias CanvasLayoutSchema = FlowingGraphCanvasLayoutSchema<
  CanvasCompositionSchema
>
private typealias CanvasStrategy = FlowingLayeredDAGLayout<CanvasLayoutSchema>
private typealias CanvasElementID = FlowingGraphCompositionElementID<
  CanvasCompositionSchema
>

private struct CanvasFixture {
  let presentation: FlowingGraphPresentation<CanvasCompositionSchema>
  let input: FlowingGraphLayoutInput<CanvasLayoutSchema>
  let result: FlowingGraphLayoutResult<CanvasLayoutSchema>
  let strategy: CanvasStrategy
}

final class FlowingGraphCanvasContentTests: XCTestCase {
  func testContentBridgesCanonicalAndPresentationLocalIdentity() throws {
    let fixture = try makeFixture()
    let content = try FlowingGraphCanvasContent<CanvasCompositionSchema>(
      presentation: fixture.presentation,
      layoutInput: fixture.input,
      layoutResult: fixture.result
    )
    let firstNode = try XCTUnwrap(fixture.presentation.nodes.first)
    let firstPort = try XCTUnwrap(fixture.presentation.ports.first)
    let edge = try XCTUnwrap(fixture.presentation.edges.first)

    XCTAssertEqual(content.localID(for: firstNode.id), firstNode.localID)
    XCTAssertEqual(content.elementID(for: firstNode.localID), firstNode.id)
    XCTAssertNotNil(content.frame(for: firstNode.localID))
    XCTAssertNotNil(content.anchor(for: firstPort.localID))
    XCTAssertNotNil(content.route(for: edge.localID))
    XCTAssertEqual(content.incidentEdgeLocalIDs(of: firstNode.localID), [edge.localID])
  }

  func testContentRejectsGeometryForADifferentTopology() throws {
    let fixture = try makeFixture()
    let reversedTopology = try FlowingGraphLayoutTopology<CanvasLayoutSchema>(
      snapshotID: fixture.presentation.snapshotID,
      nodeIDs: Array(fixture.input.topology.nodeIDs.reversed()),
      ports: fixture.input.topology.ports,
      edges: fixture.input.topology.edges
    )
    let input = try makeInput(
      topology: reversedTopology,
      strategy: fixture.strategy
    )
    let result = try fixture.strategy.layout(input)

    XCTAssertThrowsError(
      try FlowingGraphCanvasContent<CanvasCompositionSchema>(
        presentation: fixture.presentation,
        layoutInput: input,
        layoutResult: result
      )
    ) { error in
      XCTAssertEqual(error as? FlowingGraphCanvasContentIssue, .layoutTopologyMismatch)
    }
  }

  func testContentRejectsAResultFromAnotherInputRevision() throws {
    let fixture = try makeFixture()
    let input = try FlowingGraphLayoutInput<CanvasLayoutSchema>(
      id: FlowingLayoutInputID(
        presentationSnapshotID: fixture.presentation.snapshotID,
        pipelineIdentity: fixture.strategy.identity,
        nodeSizeRevision: .init(),
        portAnchorRevision: .init(),
        layoutStateRevision: .init()
      ),
      topology: fixture.input.topology,
      nodeSizes: fixture.input.nodeSizes,
      portAnchors: fixture.input.portAnchors
    )

    XCTAssertThrowsError(
      try FlowingGraphCanvasContent<CanvasCompositionSchema>(
        presentation: fixture.presentation,
        layoutInput: input,
        layoutResult: fixture.result
      )
    ) { error in
      XCTAssertEqual(error as? FlowingGraphCanvasContentIssue, .layoutInputIdentityMismatch)
    }
  }

  func testSelectionReducerAppliesEveryMutationMode() throws {
    let presentation = try makeFixture().presentation
    let ids: [CanvasElementID] = presentation.nodes.map(\.id)
    var selection: Set<CanvasElementID> = Set(ids.prefix(1))

    FlowingGraphCanvasSessionReducer.apply(
      FlowingGraphCanvasSelectionCommand<CanvasCompositionSchema>.add([ids[1]]),
      to: &selection
    )
    XCTAssertEqual(selection, Set(ids))

    FlowingGraphCanvasSessionReducer.apply(
      FlowingGraphCanvasSelectionCommand<CanvasCompositionSchema>.toggle([ids[0]]),
      to: &selection
    )
    XCTAssertEqual(selection, Set([ids[1]]))

    FlowingGraphCanvasSessionReducer.apply(
      FlowingGraphCanvasSelectionCommand<CanvasCompositionSchema>.remove([ids[1]]),
      to: &selection
    )
    XCTAssertTrue(selection.isEmpty)

    FlowingGraphCanvasSessionReducer.apply(
      FlowingGraphCanvasSelectionCommand<CanvasCompositionSchema>.replace([ids[0]]),
      to: &selection
    )
    FlowingGraphCanvasSessionReducer.apply(
      FlowingGraphCanvasSelectionCommand<CanvasCompositionSchema>.clear,
      to: &selection
    )
    XCTAssertTrue(selection.isEmpty)
  }

  func testTransientGeometryMovesEndpointsWithoutRecomputingLayout() {
    let route = FlowingGraphEdgeRoute(
      start: CGPoint(x: 0, y: 0),
      segments: [
        .cubic(
          control1: CGPoint(x: 10, y: 0),
          control2: CGPoint(x: 20, y: 30),
          end: CGPoint(x: 30, y: 30)
        )
      ]
    )

    let moved = FlowingGraphCanvasTransientGeometry.deforming(
      route,
      firstEndpointDelta: CGSize(width: 3, height: 5),
      secondEndpointDelta: CGSize(width: 12, height: 8)
    )

    XCTAssertEqual(moved.start, CGPoint(x: 3, y: 5))
    XCTAssertEqual(
      moved.segments,
      [
        .cubic(
          control1: CGPoint(x: 16, y: 6),
          control2: CGPoint(x: 29, y: 37),
          end: CGPoint(x: 42, y: 38)
        )
      ]
    )
  }

  private func makeFixture() throws -> CanvasFixture {
    var graph = FlowingGraph<CanvasGraphSchema>()
    let mutation = graph.update { transaction in
      transaction.insert(FlowingGraphNode(id: "source", value: "Source"))
      transaction.insert(FlowingGraphNode(id: "target", value: "Target"))
      transaction.insert(
        FlowingGraphPort(
          key: FlowingGraphPortKey(nodeID: "source", portID: "output"),
          value: "Output"
        )
      )
      transaction.insert(
        FlowingGraphEdge(
          id: "edge",
          endpoints: .directed(
            source: .port(FlowingGraphPortKey(nodeID: "source", portID: "output")),
            target: .node("target")
          ),
          value: "Edge"
        )
      )
    }
    guard case .committed = mutation else {
      XCTFail("Fixture graph mutation failed")
      throw FlowingGraphCanvasContentIssue.layoutTopologyMismatch
    }

    let document = FlowingGraphDocument<CanvasCompositionSchema>(
      id: "document",
      defaultEntryPointID: "main",
      entryPoints: [
        FlowingGraphEntryPoint(id: "main", name: "Main", graphID: "root")
      ],
      definitions: [FlowingGraphDefinition(id: "root", graph: graph)],
      subgraphLinks: []
    )
    let presentation = try FlowingGraphProjector(document: document).projectDefault()
    let topology = try FlowingGraphCanvasLayoutAdapter.topology(for: presentation)
    let strategy = makeStrategy()
    let input = try makeInput(topology: topology, strategy: strategy)
    let result = try strategy.layout(input)
    return CanvasFixture(
      presentation: presentation,
      input: input,
      result: result,
      strategy: strategy
    )
  }

  private func makeStrategy() -> CanvasStrategy {
    FlowingLayeredDAGLayout(
      layerAssignment: FlowingLongestPathLayerAssignment(),
      layerOrdering: FlowingStableLayerOrdering(),
      coordinateAssignment: FlowingCenteredLayerCoordinates(
        configuration: FlowingLayeredLayoutConfiguration(
          horizontalNodeSpacing: 24,
          verticalNodeSpacing: 48,
          componentSpacing: 64,
          canvasInsets: FlowingLayoutInsets(horizontal: 20, vertical: 20),
          minimumCanvasSize: .zero
        )
      ),
      edgeRouter: FlowingCubicEdgeRouter()
    )
  }

  private func makeInput<Strategy: FlowingGraphLayoutStrategy>(
    topology: FlowingGraphLayoutTopology<CanvasLayoutSchema>,
    strategy: Strategy
  ) throws -> FlowingGraphLayoutInput<CanvasLayoutSchema>
  where Strategy.Schema == CanvasLayoutSchema {
    try FlowingGraphLayoutResolution.input(
      topology: topology,
      nodeSizeResolver: FlowingFixedNodeSizeResolver(size: CGSize(width: 120, height: 64)),
      portAnchorResolver: FlowingCenteredPortAnchorResolver(),
      pipelineIdentity: strategy.identity
    )
  }
}
