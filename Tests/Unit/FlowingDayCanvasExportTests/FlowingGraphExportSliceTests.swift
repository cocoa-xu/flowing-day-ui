import FlowingDayCanvasExport
import FlowingDayGraphCanvas
import FlowingDayGraphComposition
import FlowingDayGraphCore
import FlowingDayGraphLayout
import SwiftUI
import XCTest

private enum ExportGraphSchema: FlowingGraphSchema {
  typealias NodeID = String
  typealias NodeValue = String
  typealias PortID = String
  typealias PortValue = String
  typealias EdgeID = String
  typealias EdgeValue = String
}

private enum ExportCompositionSchema: FlowingGraphCanvasSchema {
  typealias DocumentID = String
  typealias GraphID = String
  typealias EntryPointID = String
  typealias LinkID = String
  typealias LinkValue = String
  typealias OccurrenceID = Never
  typealias GraphSchema = ExportGraphSchema
}

private typealias ExportContent = FlowingGraphCanvasContent<ExportCompositionSchema>
private typealias ExportElementID = FlowingGraphCompositionElementID<ExportCompositionSchema>
private typealias ExportLayoutSchema = FlowingGraphCanvasLayoutSchema<ExportCompositionSchema>

final class FlowingGraphExportSliceTests: XCTestCase {
  func testCompleteScopePreservesPresentationOrderAndGeometry() throws {
    let content = try makeFlatContent()

    let slice = try FlowingGraphExportSliceResolver.resolve(
      content: content,
      scope: .completePresentation
    )

    XCTAssertEqual(slice.nodeLocalIDs, content.presentation.nodes.map(\.localID))
    XCTAssertEqual(slice.portLocalIDs, content.presentation.ports.map(\.localID))
    XCTAssertEqual(slice.edgeLocalIDs, content.presentation.edges.map(\.localID))
    XCTAssertEqual(slice.inputID, content.id)
    XCTAssertFalse(slice.contentBounds.isEmpty)
  }

  func testSelectionIncludesDirectedAncestorsPortsAndConnectingEdges() throws {
    let content = try makeFlatContent()
    let leafID = try nodeElementID("leaf", in: content)

    let slice = try FlowingGraphExportSliceResolver.resolve(
      content: content,
      scope: .selection(
        [leafID],
        inclusion: [
          .selectedElements,
          .directedAncestors,
          .nodePorts,
          .connectingEdges,
        ]
      )
    )

    XCTAssertEqual(nodeValues(in: slice, content: content), ["root", "branch", "leaf"])
    XCTAssertEqual(edgeValues(in: slice, content: content), ["root-branch", "branch-leaf"])
    XCTAssertEqual(
      slice.portLocalIDs.compactMap { content.port(for: $0)?.value },
      ["output"]
    )
  }

  func testDescendantsCanExcludeSelectedRoots() throws {
    let content = try makeFlatContent()
    let branchID = try nodeElementID("branch", in: content)

    let slice = try FlowingGraphExportSliceResolver.resolve(
      content: content,
      scope: .selection(
        [branchID],
        inclusion: [.directedDescendants, .connectingEdges]
      )
    )

    XCTAssertEqual(nodeValues(in: slice, content: content), ["leaf", "sibling"])
    XCTAssertTrue(slice.edgeLocalIDs.isEmpty)
  }

  func testAncestorAndDescendantClosuresDoNotIncludeSiblingBranches() throws {
    let content = try makeFlatContent()
    let leafID = try nodeElementID("leaf", in: content)

    let slice = try FlowingGraphExportSliceResolver.resolve(
      content: content,
      scope: .selection(
        [leafID],
        inclusion: [
          .selectedElements,
          .directedAncestors,
          .directedDescendants,
          .connectingEdges,
        ]
      )
    )

    XCTAssertEqual(nodeValues(in: slice, content: content), ["root", "branch", "leaf"])
    XCTAssertEqual(edgeValues(in: slice, content: content), ["root-branch", "branch-leaf"])
  }

  func testUndirectedEdgesDoNotInventDirectedAncestors() throws {
    let content = try makeFlatContent()
    let detachedID = try nodeElementID("detached", in: content)

    let slice = try FlowingGraphExportSliceResolver.resolve(
      content: content,
      scope: .selection(
        [detachedID],
        inclusion: [.selectedElements, .directedAncestors, .connectingEdges]
      )
    )

    XCTAssertEqual(nodeValues(in: slice, content: content), ["detached"])
    XCTAssertTrue(slice.edgeLocalIDs.isEmpty)
  }

  func testDirectedSelectionTerminatesOnCycles() throws {
    var graph = FlowingGraph<ExportGraphSchema>()
    guard
      case .committed = graph.update({ transaction in
        transaction.insert(FlowingGraphNode(id: "first", value: "first"))
        transaction.insert(FlowingGraphNode(id: "second", value: "second"))
        transaction.insert(
          FlowingGraphEdge(
            id: "forward",
            endpoints: .directed(source: .node("first"), target: .node("second")),
            value: "forward"
          )
        )
        transaction.insert(
          FlowingGraphEdge(
            id: "backward",
            endpoints: .directed(source: .node("second"), target: .node("first")),
            value: "backward"
          )
        )
      })
    else {
      return XCTFail("Fixture graph mutation failed")
    }
    let content = try makeContent(graph: graph)
    let firstID = try nodeElementID("first", in: content)

    let slice = try FlowingGraphExportSliceResolver.resolve(
      content: content,
      scope: .selection(
        [firstID],
        inclusion: [.selectedElements, .directedDescendants, .connectingEdges]
      )
    )

    XCTAssertEqual(nodeValues(in: slice, content: content), ["first", "second"])
    XCTAssertEqual(edgeValues(in: slice, content: content), ["forward", "backward"])
  }

  func testContainmentClosureIncludesNestedInstancesAndContext() throws {
    let content = try makeNestedContent()
    let childID = try nodeElementID("child-b", graphID: "child", in: content)

    let ancestors = try FlowingGraphExportSliceResolver.resolve(
      content: content,
      scope: .selection(
        [childID],
        inclusion: [
          .selectedElements,
          .containingAncestors,
          .contextRecords,
        ]
      )
    )
    XCTAssertEqual(nodeValues(in: ancestors, content: content), ["container", "child-b"])
    XCTAssertEqual(ancestors.contextLocalIDs.count, 1)

    let containerID = try nodeElementID("container", graphID: "root", in: content)
    let descendants = try FlowingGraphExportSliceResolver.resolve(
      content: content,
      scope: .selection(
        [containerID],
        inclusion: [
          .selectedElements,
          .containedDescendants,
          .contextRecords,
        ]
      )
    )
    XCTAssertEqual(
      nodeValues(in: descendants, content: content),
      ["container", "child-a", "child-b"]
    )
    XCTAssertEqual(descendants.contextLocalIDs.count, 1)
  }

  func testSelectionRejectsUnknownAndEmptyScopes() throws {
    let first = try makeFlatContent()
    let second = try makeSingleNodeContent(id: "other")
    let leafID = try nodeElementID("leaf", in: first)

    XCTAssertThrowsError(
      try FlowingGraphExportSliceResolver.resolve(
        content: second,
        scope: .selection([leafID], inclusion: .standard)
      )
    )
    XCTAssertThrowsError(
      try FlowingGraphExportSliceResolver.resolve(
        content: first,
        scope: .selection([], inclusion: .standard)
      )
    )
  }

  @MainActor
  func testExportCanvasRejectsASliceFromAnotherLayoutInput() throws {
    let first = try makeFlatContent()
    let second = try makeSingleNodeContent(id: "other")
    let slice = try FlowingGraphExportSliceResolver.resolve(
      content: first,
      scope: .completePresentation
    )
    let geometry = try FlowingCanvasExportGeometry(contentBounds: slice.contentBounds)

    XCTAssertThrowsError(
      try FlowingGraphExportCanvas(
        content: second,
        slice: slice,
        geometry: geometry
      ) { _ in
        Color.clear
      } node: { node, _ in
        Text(node.value)
      } edge: { _, _ in
        EmptyView()
      }
    )
  }

  func testDirectedTraversalHandlesTenThousandNodesIteratively() throws {
    let nodeCount = 10_000
    var graph = FlowingGraph<ExportGraphSchema>()
    guard
      case .committed = graph.update({ transaction in
        for index in 0..<nodeCount {
          transaction.insert(FlowingGraphNode(id: "node-\(index)", value: "node-\(index)"))
        }
        for index in 1..<nodeCount {
          transaction.insert(
            FlowingGraphEdge(
              id: "edge-\(index)",
              endpoints: .directed(
                source: .node("node-\(index - 1)"),
                target: .node("node-\(index)")
              ),
              value: "edge-\(index)"
            )
          )
        }
      })
    else {
      return XCTFail("Fixture graph mutation failed")
    }
    let content = try makeContent(graph: graph)
    let lastID = try nodeElementID("node-\(nodeCount - 1)", in: content)

    let slice = try FlowingGraphExportSliceResolver.resolve(
      content: content,
      scope: .selection(
        [lastID],
        inclusion: [.selectedElements, .directedAncestors, .connectingEdges]
      )
    )

    XCTAssertEqual(slice.nodeLocalIDs.count, nodeCount)
    XCTAssertEqual(slice.edgeLocalIDs.count, nodeCount - 1)
  }

  func testCompleteScopeHandlesOneHundredThousandElements() throws {
    let nodeCount = 100_000
    var graph = FlowingGraph<ExportGraphSchema>()
    guard
      case .committed = graph.update({ transaction in
        for index in 0..<nodeCount {
          transaction.insert(FlowingGraphNode(id: "node-\(index)", value: "node-\(index)"))
        }
      })
    else {
      return XCTFail("Fixture graph mutation failed")
    }
    let content = try makeContent(graph: graph)

    let slice = try FlowingGraphExportSliceResolver.resolve(
      content: content,
      scope: .completePresentation
    )

    XCTAssertEqual(slice.nodeLocalIDs.count, nodeCount)
  }

  private func makeFlatContent() throws -> ExportContent {
    var graph = FlowingGraph<ExportGraphSchema>()
    guard
      case .committed = graph.update({ transaction in
        for nodeID in ["root", "branch", "leaf", "sibling", "detached"] {
          transaction.insert(FlowingGraphNode(id: nodeID, value: nodeID))
        }
        transaction.insert(
          FlowingGraphPort(
            key: FlowingGraphPortKey(nodeID: "root", portID: "output"),
            value: "output"
          )
        )
        transaction.insert(
          FlowingGraphEdge(
            id: "root-branch",
            endpoints: .directed(
              source: .port(FlowingGraphPortKey(nodeID: "root", portID: "output")),
              target: .node("branch")
            ),
            value: "root-branch"
          )
        )
        transaction.insert(
          FlowingGraphEdge(
            id: "branch-leaf",
            endpoints: .directed(source: .node("branch"), target: .node("leaf")),
            value: "branch-leaf"
          )
        )
        transaction.insert(
          FlowingGraphEdge(
            id: "branch-sibling",
            endpoints: .directed(source: .node("branch"), target: .node("sibling")),
            value: "branch-sibling"
          )
        )
        transaction.insert(
          FlowingGraphEdge(
            id: "sibling-detached",
            endpoints: .undirected(.node("sibling"), .node("detached")),
            value: "sibling-detached"
          )
        )
      })
    else {
      throw FixtureIssue.mutationFailed
    }
    return try makeContent(graph: graph)
  }

  private func makeSingleNodeContent(id: String) throws -> ExportContent {
    var graph = FlowingGraph<ExportGraphSchema>()
    guard
      case .committed = graph.update({ transaction in
        transaction.insert(FlowingGraphNode(id: id, value: id))
      })
    else {
      throw FixtureIssue.mutationFailed
    }
    return try makeContent(graph: graph)
  }

  private func makeNestedContent() throws -> ExportContent {
    var root = FlowingGraph<ExportGraphSchema>()
    var child = FlowingGraph<ExportGraphSchema>()
    guard
      case .committed = root.update({ transaction in
        transaction.insert(FlowingGraphNode(id: "container", value: "container"))
      }),
      case .committed = child.update({ transaction in
        transaction.insert(FlowingGraphNode(id: "child-a", value: "child-a"))
        transaction.insert(FlowingGraphNode(id: "child-b", value: "child-b"))
      })
    else {
      throw FixtureIssue.mutationFailed
    }
    let document = FlowingGraphDocument<ExportCompositionSchema>(
      id: "document",
      defaultEntryPointID: "main",
      entryPoints: [FlowingGraphEntryPoint(id: "main", name: "Main", graphID: "root")],
      definitions: [
        FlowingGraphDefinition(id: "root", graph: root),
        FlowingGraphDefinition(id: "child", graph: child),
      ],
      subgraphLinks: [
        FlowingSubgraphLink(
          id: "child-link",
          site: FlowingGraphDefinitionNodeAddress(graphID: "root", nodeID: "container"),
          ownership: .reference,
          targetGraphID: "child",
          value: "Child"
        )
      ]
    )
    let presentation = try FlowingGraphProjector(document: document).project(
      state: FlowingGraphProjectionState(
        entryPointID: "main",
        expandedSites: [
          FlowingGraphInstanceNodeAddress(
            instance: FlowingGraphInstanceAddress(path: .root, graphID: "root"),
            nodeID: "container"
          )
        ]
      )
    )
    return try makeContent(presentation: presentation)
  }

  private func makeContent(graph: FlowingGraph<ExportGraphSchema>) throws -> ExportContent {
    let document = FlowingGraphDocument<ExportCompositionSchema>(
      id: "document",
      defaultEntryPointID: "main",
      entryPoints: [FlowingGraphEntryPoint(id: "main", name: "Main", graphID: "root")],
      definitions: [FlowingGraphDefinition(id: "root", graph: graph)],
      subgraphLinks: []
    )
    return try makeContent(
      presentation: FlowingGraphProjector(document: document).projectDefault()
    )
  }

  private func makeContent(
    presentation: FlowingGraphPresentation<ExportCompositionSchema>
  ) throws -> ExportContent {
    let topology = try FlowingGraphCanvasLayoutAdapter.topology(for: presentation)
    let input = try FlowingGraphLayoutResolution.input(
      topology: topology,
      nodeSizeResolver: FlowingFixedNodeSizeResolver(size: CGSize(width: 100, height: 50)),
      portAnchorResolver: FlowingCenteredPortAnchorResolver(),
      pipelineIdentity: FlowingLayoutPipelineIdentity(
        component: FlowingLayoutComponentIdentity()
      )
    )
    let frames = input.topology.nodeIDs.enumerated().map { index, nodeID in
      FlowingGraphNodeFrame<ExportLayoutSchema>(
        nodeID: nodeID,
        frame: CGRect(x: index * 120, y: index * 80, width: 100, height: 50)
      )
    }
    let frameByNodeID = Dictionary(uniqueKeysWithValues: frames.map { ($0.nodeID, $0.frame) })
    let placement = try FlowingGraphNodePlacement(
      input: input,
      nodeFrames: frames,
      contentBounds: frames.map(\.frame).reduce(CGRect.null) { $0.union($1) }
    )
    let routes = input.topology.edges.map { edge in
      let endpoints: (ExportLayoutSchema.NodeID, ExportLayoutSchema.NodeID)
      switch edge.endpoints {
      case .directed(let source, let target):
        endpoints = (input.topology.nodeID(for: source), input.topology.nodeID(for: target))
      case .undirected(let first, let second):
        endpoints = (input.topology.nodeID(for: first), input.topology.nodeID(for: second))
      }
      let first = frameByNodeID[endpoints.0]!
      let second = frameByNodeID[endpoints.1]!
      return FlowingGraphLayoutEdgeRoute<ExportLayoutSchema>(
        edgeID: edge.id,
        route: FlowingGraphEdgeRoute(
          start: CGPoint(x: first.midX, y: first.midY),
          segments: [.line(end: CGPoint(x: second.midX, y: second.midY))]
        )
      )
    }
    let result = try FlowingGraphLayoutResult(
      input: input,
      placement: placement,
      edgeRoutes: routes
    )
    return try FlowingGraphCanvasContent(
      presentation: presentation,
      layoutInput: input,
      layoutResult: result
    )
  }

  private func nodeElementID(
    _ nodeID: String,
    graphID: String = "root",
    in content: ExportContent
  ) throws -> ExportElementID {
    try XCTUnwrap(
      content.presentation.nodes.first {
        $0.address.graphID == graphID && $0.address.elementID == .node(nodeID)
      }?.id
    )
  }

  private func nodeValues(
    in slice: FlowingGraphExportSlice<ExportCompositionSchema>,
    content: ExportContent
  ) -> [String] {
    slice.nodeLocalIDs.compactMap { content.node(for: $0)?.value }
  }

  private func edgeValues(
    in slice: FlowingGraphExportSlice<ExportCompositionSchema>,
    content: ExportContent
  ) -> [String] {
    slice.edgeLocalIDs.compactMap { content.edge(for: $0)?.value }
  }
}

private enum FixtureIssue: Error {
  case mutationFailed
}
