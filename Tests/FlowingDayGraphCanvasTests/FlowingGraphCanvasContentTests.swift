import FlowingDayGraphCanvas
import FlowingDayGraphComposition
import FlowingDayGraphCore
import FlowingDayGraphLayout
import SwiftUI
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

  func testContentAcceptsCyclicAndUndirectedPresentations() throws {
    var graph = FlowingGraph<CanvasGraphSchema>()
    let mutation = graph.update { transaction in
      for nodeID in ["first", "second", "third"] {
        transaction.insert(FlowingGraphNode(id: nodeID, value: nodeID))
      }
      transaction.insert(
        FlowingGraphEdge(
          id: "forward",
          endpoints: .directed(source: .node("first"), target: .node("second")),
          value: "Forward"
        )
      )
      transaction.insert(
        FlowingGraphEdge(
          id: "backward",
          endpoints: .directed(source: .node("second"), target: .node("first")),
          value: "Backward"
        )
      )
      transaction.insert(
        FlowingGraphEdge(
          id: "undirected",
          endpoints: .undirected(.node("second"), .node("third")),
          value: "Undirected"
        )
      )
    }
    guard case .committed = mutation else {
      return XCTFail("Fixture graph mutation failed")
    }
    let presentation = try project(graph)
    let content = try makeManualContent(presentation: presentation)

    XCTAssertEqual(content.presentation.edges.count, 3)
    XCTAssertEqual(
      content.presentation.edges.compactMap { content.edgeAnchors(for: $0.localID)?.isDirected },
      [true, true, false]
    )
  }

  func testLayoutAdapterPreservesExpandedInstanceContainment() throws {
    var root = FlowingGraph<CanvasGraphSchema>()
    var child = FlowingGraph<CanvasGraphSchema>()
    guard
      case .committed = root.update({ transaction in
        transaction.insert(FlowingGraphNode(id: "container", value: "Container"))
      }),
      case .committed = child.update({ transaction in
        transaction.insert(FlowingGraphNode(id: "first", value: "First"))
        transaction.insert(FlowingGraphNode(id: "second", value: "Second"))
      })
    else {
      return XCTFail("Fixture graph mutation failed")
    }
    let document = FlowingGraphDocument<CanvasCompositionSchema>(
      id: "document",
      defaultEntryPointID: "main",
      entryPoints: [
        FlowingGraphEntryPoint(id: "main", name: "Main", graphID: "root")
      ],
      definitions: [
        FlowingGraphDefinition(id: "root", graph: root),
        FlowingGraphDefinition(id: "child", graph: child),
      ],
      subgraphLinks: [
        FlowingSubgraphLink(
          id: "child",
          site: FlowingGraphDefinitionNodeAddress(
            graphID: "root",
            nodeID: "container"
          ),
          ownership: .reference,
          targetGraphID: "child",
          value: "Child"
        )
      ]
    )
    let rootInstance = FlowingGraphInstanceAddress<String, String>(
      path: .root,
      graphID: "root"
    )
    let presentation = try FlowingGraphProjector(document: document).project(
      state: FlowingGraphProjectionState(
        entryPointID: "main",
        expandedSites: [
          FlowingGraphInstanceNodeAddress(
            instance: rootInstance,
            nodeID: "container"
          )
        ]
      )
    )

    let topology = try FlowingGraphCanvasLayoutAdapter.topology(for: presentation)
    let containerNode = try XCTUnwrap(
      presentation.nodes.first { $0.address.graphID == "root" }
    )
    let childNodeIDs = presentation.nodes.filter { $0.address.graphID == "child" }
      .map(\.localID)

    XCTAssertEqual(topology.containments.count, 1)
    XCTAssertEqual(topology.containments[0].containerNodeID, containerNode.localID)
    XCTAssertEqual(topology.containments[0].memberNodeIDs, childNodeIDs)
  }

  func testContentIndexesTenThousandNodesWithoutMaterializingTheWorld() throws {
    let nodeCount = 10_001
    var graph = FlowingGraph<CanvasGraphSchema>()
    let mutation = graph.update { transaction in
      for index in 0..<nodeCount {
        let nodeID = "node-\(index)"
        transaction.insert(FlowingGraphNode(id: nodeID, value: nodeID))
      }
    }
    guard case .committed = mutation else {
      return XCTFail("Fixture graph mutation failed")
    }
    let presentation = try project(graph)
    let content = try makeManualContent(presentation: presentation)
    let anchorNode = presentation.nodes[5_050]
    let anchorFrame = try XCTUnwrap(content.frame(for: anchorNode.localID))

    let slice = content.renderSlice(intersecting: anchorFrame.insetBy(dx: -180, dy: -120))

    XCTAssertEqual(content.presentation.nodes.count, nodeCount)
    XCTAssertLessThan(slice.nodeIDs.count, 30)
    XCTAssertTrue(slice.nodeIDs.contains(anchorNode.localID))
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

  @MainActor
  func testPublicViewSupportsAnOptionalPortBuilder() throws {
    let fixture = try makeFixture()
    let content = try FlowingGraphCanvasContent<CanvasCompositionSchema>(
      presentation: fixture.presentation,
      layoutInput: fixture.input,
      layoutResult: fixture.result
    )
    let session = Binding.constant(
      FlowingGraphCanvasSessionState<CanvasCompositionSchema>()
    )
    let view = FlowingGraphCanvas(
      content: content,
      sessionID: .init(),
      session: session
    ) { _ in
      Color.clear
    } node: { node, _ in
      Text(node.value)
    } edge: { _, context in
      FlowingGraphCanvasDefaultEdge(context: context)
    }

    XCTAssertFalse(String(reflecting: type(of: view)).isEmpty)
  }

  func testSessionCommandsOnlyTargetTheirDeclaredSession() {
    let target = FlowingGraphCanvasSessionID()
    let other = FlowingGraphCanvasSessionID()
    let command = FlowingGraphCanvasSessionCommand<CanvasCompositionSchema>(
      targetSessionID: target,
      action: .fit(scope: .presentation, padding: 24)
    )

    XCTAssertTrue(command.targets(target))
    XCTAssertFalse(command.targets(other))
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

  private func project(
    _ graph: FlowingGraph<CanvasGraphSchema>
  ) throws -> FlowingGraphPresentation<CanvasCompositionSchema> {
    let document = FlowingGraphDocument<CanvasCompositionSchema>(
      id: "document",
      defaultEntryPointID: "main",
      entryPoints: [
        FlowingGraphEntryPoint(id: "main", name: "Main", graphID: "root")
      ],
      definitions: [FlowingGraphDefinition(id: "root", graph: graph)],
      subgraphLinks: []
    )
    return try FlowingGraphProjector(document: document).projectDefault()
  }

  private func makeManualContent(
    presentation: FlowingGraphPresentation<CanvasCompositionSchema>
  ) throws -> FlowingGraphCanvasContent<CanvasCompositionSchema> {
    let topology = try FlowingGraphCanvasLayoutAdapter.topology(for: presentation)
    let pipelineIdentity = FlowingLayoutPipelineIdentity(
      component: FlowingLayoutComponentIdentity()
    )
    let input = try FlowingGraphLayoutResolution.input(
      topology: topology,
      nodeSizeResolver: FlowingFixedNodeSizeResolver(size: CGSize(width: 120, height: 64)),
      portAnchorResolver: FlowingCenteredPortAnchorResolver(),
      pipelineIdentity: pipelineIdentity
    )
    let nodeFrames: [FlowingGraphNodeFrame<CanvasLayoutSchema>] =
      input.topology.nodeIDs.enumerated().map { index, nodeID in
        let column = index % 100
        let row = index / 100
        return FlowingGraphNodeFrame<CanvasLayoutSchema>(
          nodeID: nodeID,
          frame: CGRect(
            x: CGFloat(column * 160),
            y: CGFloat(row * 104),
            width: 120,
            height: 64
          )
        )
      }
    let contentBounds = nodeFrames.map(\.frame).reduce(CGRect.null) { $0.union($1) }
    let placement = try FlowingGraphNodePlacement(
      input: input,
      nodeFrames: nodeFrames,
      contentBounds: contentBounds
    )
    let edgeRoutes = input.topology.edges.enumerated().map { index, edge in
      let y = CGFloat(index * 8)
      return FlowingGraphLayoutEdgeRoute<CanvasLayoutSchema>(
        edgeID: edge.id,
        route: FlowingGraphEdgeRoute(
          start: CGPoint(x: 0, y: y),
          segments: [.line(end: CGPoint(x: 100, y: y))]
        )
      )
    }
    let result = try FlowingGraphLayoutResult(
      input: input,
      placement: placement,
      edgeRoutes: edgeRoutes
    )
    return try FlowingGraphCanvasContent(
      presentation: presentation,
      layoutInput: input,
      layoutResult: result
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
