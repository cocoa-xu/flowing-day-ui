import FlowingDayCanvas
import FlowingDayGraphComposition
import FlowingDayGraphCore
import FlowingDayGraphLayout
import SwiftUI
import XCTest

@testable import FlowingDayGraphCanvas

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

  func testMiniMapSnapshotSourceMaterializesCanonicalGeometry() throws {
    let fixture = try makeFixture()
    let content = try FlowingGraphCanvasContent<CanvasCompositionSchema>(
      presentation: fixture.presentation,
      layoutInput: fixture.input,
      layoutResult: fixture.result
    )
    let firstNode = try XCTUnwrap(fixture.presentation.nodes.first)
    let edge = try XCTUnwrap(fixture.presentation.edges.first)

    let miniMapSnapshot = try content.miniMapSnapshotSource().makeSnapshot()

    XCTAssertEqual(miniMapSnapshot.nodes.count, fixture.presentation.nodes.count)
    XCTAssertEqual(miniMapSnapshot.edges.count, fixture.presentation.edges.count)
    XCTAssertEqual(miniMapSnapshot.contentBounds, fixture.result.contentBounds)
    XCTAssertEqual(miniMapSnapshot.nodes.first?.id, firstNode.id)
    XCTAssertEqual(miniMapSnapshot.edges.first?.id, edge.id)
  }

  @MainActor
  func testAccessibilitySnapshotKeepsHiddenTopologyNavigable() throws {
    let fixture = try makeFixture()
    let content = try FlowingGraphCanvasContent<CanvasCompositionSchema>(
      presentation: fixture.presentation,
      layoutInput: fixture.input,
      layoutResult: fixture.result
    )

    let snapshot = try content.accessibilitySnapshot(
      canvasDescription: .init(label: "Workflow"),
      node: { node in
        .element(.init(label: node.value, identifier: String(describing: node.id)))
      },
      port: { _ in .hidden },
      edge: { _ in .hidden }
    )

    XCTAssertEqual(snapshot.canvasDescription.label, "Workflow")
    XCTAssertEqual(snapshot.items.count, fixture.presentation.nodes.count)
    XCTAssertEqual(Set(snapshot.items.map(\.id)), Set(fixture.presentation.nodes.map(\.id)))
    for item in snapshot.items {
      XCTAssertEqual(snapshot.relatedElementIDs(for: item.id).count, 1)
      XCTAssertNotEqual(snapshot.nextRelatedElementID(after: item.id), item.id)
    }
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

  func testMarqueeSelectionTracksCurrentCandidatesInsteadOfAccumulatingPastCandidates() throws {
    let ids: [CanvasElementID] = try makeFixture().presentation.nodes.map(\.id)
    let baseSelection: Set<CanvasElementID> = [ids[0]]
    var selectionState = FlowingGraphCanvasMarqueeSelectionState(
      initialSelection: baseSelection,
      mode: .replace
    )

    let firstSelection = selectionState.update(
      candidates: [ids[0], ids[1]],
      hasExceededMinimumDistance: true
    )
    let updatedSelection = selectionState.update(
      candidates: [ids[1]],
      hasExceededMinimumDistance: false
    )

    XCTAssertEqual(firstSelection, Set([ids[0], ids[1]]))
    XCTAssertEqual(updatedSelection, Set([ids[1]]))
  }

  func testAdditiveMarqueeSelectionAlwaysUsesDragStartSelection() throws {
    let ids: [CanvasElementID] = try makeFixture().presentation.nodes.map(\.id)
    let baseSelection: Set<CanvasElementID> = [ids[0]]
    var selectionState = FlowingGraphCanvasMarqueeSelectionState(
      initialSelection: baseSelection,
      mode: .additive
    )

    let firstSelection = selectionState.update(
      candidates: [ids[1]],
      hasExceededMinimumDistance: true
    )
    let updatedSelection = selectionState.update(
      candidates: [],
      hasExceededMinimumDistance: false
    )

    XCTAssertEqual(firstSelection, Set([ids[0], ids[1]]))
    XCTAssertEqual(updatedSelection, baseSelection)
  }

  func testToggleMarqueeSelectionIsResolvedAgainstDragStartSelection() throws {
    let ids: [CanvasElementID] = try makeFixture().presentation.nodes.map(\.id)
    let baseSelection: Set<CanvasElementID> = [ids[0], ids[1]]
    var selectionState = FlowingGraphCanvasMarqueeSelectionState(
      initialSelection: baseSelection,
      mode: .toggle
    )

    let selection = selectionState.update(
      candidates: [ids[1]],
      hasExceededMinimumDistance: true
    )

    XCTAssertEqual(selection, Set([ids[0]]))
  }

  func testMarqueeSelectionDoesNotChangeBeforeMinimumDragDistance() throws {
    let ids: [CanvasElementID] = try makeFixture().presentation.nodes.map(\.id)
    let baseSelection: Set<CanvasElementID> = [ids[0]]
    var selectionState = FlowingGraphCanvasMarqueeSelectionState(
      initialSelection: baseSelection,
      mode: .replace
    )

    let selection = selectionState.update(
      candidates: [ids[1]],
      hasExceededMinimumDistance: false
    )

    XCTAssertEqual(selection, baseSelection)
    XCTAssertFalse(selectionState.isActive)
  }

  func testMultiNodeDragRequestUsesStableNodeOrderAndCapabilities() throws {
    let presentation = try makeFixture().presentation
    let nodeIDs = presentation.nodes.map(\.id)
    let portID = try XCTUnwrap(presentation.ports.first?.id)
    let capabilities = FlowingGraphCanvasNodeCapabilityMap<CanvasCompositionSchema>(
      overrides: [nodeIDs[1]: []]
    )

    let request = try XCTUnwrap(
      FlowingGraphCanvasNodeDragResolver.request(
        anchorNodeID: nodeIDs[0],
        selection: Set(nodeIDs + [portID]),
        presentation: presentation,
        mode: .multiple,
        capabilities: capabilities
      )
    )

    XCTAssertEqual(request.selectedNodeIDs, nodeIDs)
    XCTAssertEqual(request.candidateNodeIDs, [nodeIDs[0]])
  }

  func testDragAdmissionCannotMoveNodesOutsideCandidatesOrExcludeAnchor() throws {
    let presentation = try makeFixture().presentation
    let nodeIDs = presentation.nodes.map(\.id)
    let request = try XCTUnwrap(
      FlowingGraphCanvasNodeDragResolver.request(
        anchorNodeID: nodeIDs[0],
        selection: Set(nodeIDs),
        presentation: presentation,
        mode: .multiple,
        capabilities: .init()
      )
    )

    XCTAssertEqual(
      FlowingGraphCanvasNodeDragResolver.admittedNodeIDs(
        for: request,
        admission: .allowAll
      ),
      Set(nodeIDs)
    )
    XCTAssertTrue(
      FlowingGraphCanvasNodeDragResolver.admittedNodeIDs(
        for: request,
        admission: .allowOnly([nodeIDs[1]])
      ).isEmpty
    )
  }

  func testResizeAdmissionCannotIncludeNodesOutsideCandidatesOrExcludeAnchor() throws {
    let presentation = try makeFixture().presentation
    let nodeIDs = presentation.nodes.map(\.id)
    let frames = Dictionary(
      uniqueKeysWithValues: nodeIDs.enumerated().map { index, nodeID in
        (nodeID, CGRect(x: CGFloat(index * 120), y: 0, width: 100, height: 60))
      }
    )
    let request = FlowingGraphCanvasNodeResizeAdmissionRequest<CanvasCompositionSchema>(
      anchorNodeID: nodeIDs[0],
      selectedNodeIDs: nodeIDs,
      candidateNodeIDs: nodeIDs,
      baseFrames: frames,
      edges: [.trailing, .bottom],
      basePresentationSnapshotID: presentation.snapshotID
    )

    XCTAssertEqual(
      FlowingGraphCanvasNodeResizeResolver.admittedNodeIDs(
        for: request,
        admission: .allowOnly([nodeIDs[0]])
      ),
      [nodeIDs[0]]
    )
    XCTAssertTrue(
      FlowingGraphCanvasNodeResizeResolver.admittedNodeIDs(
        for: request,
        admission: .allowOnly([nodeIDs[1]])
      ).isEmpty
    )
  }

  @MainActor
  func testInteractionPolicyKeepsBackendBehaviorInOneValue() throws {
    let presentation = try makeFixture().presentation
    let nodeIDs = presentation.nodes.map(\.id)
    let frames = Dictionary(
      uniqueKeysWithValues: nodeIDs.enumerated().map { index, nodeID in
        (nodeID, CGRect(x: CGFloat(index * 120), y: 0, width: 100, height: 60))
      }
    )
    let capabilities = FlowingGraphCanvasNodeCapabilityMap<CanvasCompositionSchema>(
      overrides: [nodeIDs[1]: []]
    )
    let constraints = FlowingGraphCanvasNodeSizeConstraintMap<CanvasCompositionSchema>(
      overrides: [
        nodeIDs[0]: FlowingGraphCanvasNodeSizeConstraints(
          minimumSize: CGSize(width: 80, height: 48)
        )
      ]
    )
    let strategy = FlowingGraphCanvasSnappingStrategy<CanvasCompositionSchema>(
      translation: { request in
        FlowingGraphCanvasSnapResult(
          translation: CGSize(width: 37, height: request.proposedTranslation.height),
          guides: []
        )
      }
    )
    let policy = FlowingGraphCanvasInteractionPolicy<CanvasCompositionSchema>(
      nodeCapabilities: capabilities,
      nodeSizeConstraints: constraints,
      snappingStrategy: strategy,
      admitNodeDrag: { .allowOnly([$0.anchorNodeID]) },
      admitNodeResize: { .allowOnly([$0.anchorNodeID]) },
      isAdditiveSelectionActive: { true },
      interactionModifiers: { [.disableSnapping, .largeKeyboardNudge] }
    )
    let dragRequest = try XCTUnwrap(
      FlowingGraphCanvasNodeDragResolver.request(
        anchorNodeID: nodeIDs[0],
        selection: Set(nodeIDs),
        presentation: presentation,
        mode: .multiple,
        capabilities: capabilities
      )
    )
    let resizeRequest = FlowingGraphCanvasNodeResizeAdmissionRequest<CanvasCompositionSchema>(
      anchorNodeID: nodeIDs[0],
      selectedNodeIDs: nodeIDs,
      candidateNodeIDs: nodeIDs,
      baseFrames: frames,
      edges: [.trailing, .bottom],
      basePresentationSnapshotID: presentation.snapshotID
    )
    let firstFrame = try XCTUnwrap(frames[nodeIDs[0]])
    let snapRequest = FlowingGraphCanvasTranslationSnapRequest<CanvasCompositionSchema>(
      movingBounds: firstFrame,
      proposedTranslation: CGSize(width: 10, height: 12),
      candidates: [],
      configuration: .disabled,
      zoom: 1
    )

    XCTAssertEqual(policy.nodeCapabilities, capabilities)
    XCTAssertEqual(policy.nodeSizeConstraints, constraints)
    XCTAssertEqual(policy.admission(for: dragRequest), .allowOnly([nodeIDs[0]]))
    XCTAssertEqual(policy.admission(for: resizeRequest), .allowOnly([nodeIDs[0]]))
    XCTAssertTrue(policy.isAdditiveSelectionActive)
    XCTAssertEqual(policy.interactionModifiers, [.disableSnapping, .largeKeyboardNudge])
    XCTAssertEqual(policy.snappingStrategy.snap(snapRequest).translation.width, 37)
  }

  @MainActor
  func testBackendContextForwardsTheCompleteInteractionContract() throws {
    let fixture = try makeFixture()
    let content = try FlowingGraphCanvasContent<CanvasCompositionSchema>(
      presentation: fixture.presentation,
      layoutInput: fixture.input,
      layoutResult: fixture.result
    )
    let node = try XCTUnwrap(fixture.presentation.nodes.first)
    let nodeID = node.id
    var session = FlowingGraphCanvasSessionState<CanvasCompositionSchema>()
    var receivedViewport: FlowingCanvasViewport?
    var receivedPhase: FlowingCanvasViewportChangePhase?
    var receivedIntent: FlowingGraphCanvasInteractionIntent<CanvasCompositionSchema>?
    let interactionPolicy = FlowingGraphCanvasInteractionPolicy<CanvasCompositionSchema>(
      interactionModifiers: { .disableSnapping }
    )
    let context = FlowingGraphCanvasBackendContext(
      content: content,
      sessionID: FlowingGraphCanvasSessionID(),
      session: Binding(
        get: { session },
        set: { session = $0 }
      ),
      configuration: .init(),
      interactionPolicy: interactionPolicy,
      accessibilitySnapshot: nil,
      contentInsets: .init(),
      contentChangeBehavior: .preserveViewport,
      command: nil,
      onSmartMagnify: { _ in .restore },
      onViewportChange: { viewport, phase in
        receivedViewport = viewport
        receivedPhase = phase
      },
      onIntent: { receivedIntent = $0 }
    )
    let viewport = FlowingCanvasViewport(
      transform: FlowingCanvasTransform(zoom: 1.5, offset: CGSize(width: 8, height: 12))
    )
    let smartMagnifyContext = FlowingGraphCanvasSmartMagnifyContext<CanvasCompositionSchema>(
      canvas: FlowingCanvasSmartMagnifyContext(
        location: .zero,
        worldLocation: .zero,
        viewport: viewport,
        initialZoom: 1,
        canRestoreViewport: true
      ),
      nearestNodeID: nodeID,
      nearestNodeFrame: content.frame(for: node.localID),
      focusedElementID: nil,
      focusedElementBounds: nil
    )
    let intent = FlowingGraphCanvasInteractionIntent<CanvasCompositionSchema>.elementAction(
      FlowingGraphCanvasElementActionIntent(
        action: .inspect,
        elementID: nodeID,
        basePresentationSnapshotID: fixture.presentation.snapshotID
      )
    )

    context.viewportDidChange(viewport, phase: .continuous)
    context.send(intent)

    XCTAssertEqual(context.interactionPolicy.interactionModifiers, .disableSnapping)
    XCTAssertEqual(context.smartMagnify(smartMagnifyContext), .restore)
    XCTAssertEqual(receivedViewport, viewport)
    XCTAssertEqual(receivedPhase, .continuous)
    XCTAssertEqual(receivedIntent, intent)
  }

  func testNodeSizeConstraintsUseOverridesBeforeDefaultsAndFallbacks() throws {
    let nodeIDs = try makeFixture().presentation.nodes.map(\.id)
    let defaultConstraints = FlowingGraphCanvasNodeSizeConstraints(
      minimumSize: CGSize(width: 80, height: 50)
    )
    let override = FlowingGraphCanvasNodeSizeConstraints(
      minimumSize: CGSize(width: 120, height: 70),
      maximumSize: CGSize(width: 240, height: 140)
    )
    let constraints = FlowingGraphCanvasNodeSizeConstraintMap<CanvasCompositionSchema>(
      defaultConstraints: defaultConstraints,
      overrides: [nodeIDs[0]: override]
    )

    XCTAssertEqual(
      constraints.constraints(for: nodeIDs[0], fallbackMinimumSize: CGSize(width: 44, height: 32)),
      override
    )
    XCTAssertEqual(
      constraints.constraints(for: nodeIDs[1], fallbackMinimumSize: CGSize(width: 44, height: 32)),
      defaultConstraints
    )
    XCTAssertEqual(
      FlowingGraphCanvasNodeSizeConstraintMap<CanvasCompositionSchema>()
        .constraints(for: nodeIDs[0], fallbackMinimumSize: CGSize(width: 44, height: 32)),
      FlowingGraphCanvasNodeSizeConstraints(minimumSize: CGSize(width: 44, height: 32))
    )
  }

  func testSingleNodeModeIgnoresTheRestOfTheSelection() throws {
    let presentation = try makeFixture().presentation
    let nodeIDs = presentation.nodes.map(\.id)
    let request = try XCTUnwrap(
      FlowingGraphCanvasNodeDragResolver.request(
        anchorNodeID: nodeIDs[1],
        selection: Set(nodeIDs),
        presentation: presentation,
        mode: .single,
        capabilities: .init()
      )
    )

    XCTAssertEqual(request.candidateNodeIDs, [nodeIDs[1]])
  }

  func testGeometryIntentsPinTheExactLayoutInputIdentity() throws {
    let fixture = try makeFixture()
    let nodeID = try XCTUnwrap(fixture.presentation.nodes.first?.id)
    let drag = FlowingGraphCanvasNodeDragIntent<CanvasCompositionSchema>(
      nodeID: nodeID,
      basePresentationSnapshotID: fixture.presentation.snapshotID,
      baseLayoutInputID: fixture.input.id,
      translation: CGSize(width: 12, height: 8)
    )
    let arrangement = FlowingGraphCanvasNodeArrangementIntent<CanvasCompositionSchema>(
      action: .align(.leading),
      translations: [nodeID: CGSize(width: 12, height: 0)],
      basePresentationSnapshotID: fixture.presentation.snapshotID,
      baseLayoutInputID: fixture.input.id
    )
    let transient = FlowingGraphCanvasTransientNodeDrag<CanvasCompositionSchema>(
      nodeID: nodeID,
      basePresentationSnapshotID: fixture.presentation.snapshotID,
      baseLayoutInputID: fixture.input.id
    )
    let resize = FlowingGraphCanvasNodeResizeIntent<CanvasCompositionSchema>(
      anchorNodeID: nodeID,
      changes: [
        FlowingGraphCanvasNodeResizeChange(
          nodeID: nodeID,
          originTranslation: CGSize(width: 10, height: 20),
          sizeDelta: CGSize(width: 40, height: 20)
        )
      ],
      edges: [.trailing, .bottom],
      basePresentationSnapshotID: fixture.presentation.snapshotID,
      baseLayoutInputID: fixture.input.id
    )
    let transientResize = FlowingGraphCanvasTransientNodeResize<CanvasCompositionSchema>(
      anchorNodeID: nodeID,
      basePresentationSnapshotID: fixture.presentation.snapshotID,
      baseLayoutInputID: fixture.input.id,
      nodeOrder: [nodeID],
      baseFrames: [nodeID: CGRect(x: 10, y: 20, width: 100, height: 60)],
      edges: [.trailing, .bottom]
    )

    XCTAssertEqual(drag.baseLayoutInputID, fixture.input.id)
    XCTAssertEqual(resize.baseLayoutInputID, fixture.input.id)
    XCTAssertEqual(arrangement.baseLayoutInputID, fixture.input.id)
    XCTAssertEqual(transient.baseLayoutInputID, fixture.input.id)
    XCTAssertEqual(transientResize.baseLayoutInputID, fixture.input.id)
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

  func testTransientResizePreservesAnchorPositionInsideNode() {
    let baseFrame = CGRect(x: 10, y: 20, width: 100, height: 60)
    let resizedFrame = FlowingGraphCanvasTransientGeometry.resizing(
      baseFrame,
      edges: [.trailing, .bottom],
      translation: CGSize(width: 100, height: 30)
    )
    let anchor = FlowingGraphCanvasAnchor(
      position: CGPoint(x: 110, y: 50),
      normal: CGVector(dx: 1, dy: 0)
    )

    XCTAssertEqual(resizedFrame, CGRect(x: 10, y: 20, width: 200, height: 90))
    XCTAssertEqual(
      FlowingGraphCanvasTransientGeometry.resizing(
        anchor,
        from: baseFrame,
        to: resizedFrame
      ),
      FlowingGraphCanvasAnchor(
        position: CGPoint(x: 210, y: 65),
        normal: CGVector(dx: 1, dy: 0)
      )
    )
  }

  func testTransientGeometryConstrainsDragToTheDominantAxis() {
    XCTAssertEqual(
      FlowingGraphCanvasTransientGeometry.constrainingToDominantAxis(
        CGSize(width: 18, height: 7)
      ),
      CGSize(width: 18, height: 0)
    )
    XCTAssertEqual(
      FlowingGraphCanvasTransientGeometry.constrainingToDominantAxis(
        CGSize(width: 4, height: -12)
      ),
      CGSize(width: 0, height: -12)
    )
  }

  func testTransientResizePreservesAspectRatioFromOppositeCorner() {
    let result = FlowingGraphCanvasTransientGeometry.resizing(
      CGRect(x: 10, y: 20, width: 100, height: 50),
      edges: [.leading, .top],
      translation: CGSize(width: -20, height: -4),
      modifiers: [.preserveResizeAspectRatio]
    )

    XCTAssertEqual(result, CGRect(x: -10, y: 10, width: 120, height: 60))
  }

  func testTransientResizeKeepsTheLockedAspectRatioDrivingAxis() {
    let result = FlowingGraphCanvasTransientGeometry.resizing(
      CGRect(x: 10, y: 20, width: 100, height: 50),
      edges: [.trailing, .bottom],
      translation: CGSize(width: 20, height: 40),
      behavior: FlowingGraphCanvasResizeBehavior(
        preservesAspectRatio: true,
        aspectRatioDrivingAxis: .horizontal
      )
    )

    XCTAssertEqual(result, CGRect(x: 10, y: 20, width: 120, height: 60))
  }

  func testTransientResizeCanScaleFromCenter() {
    let result = FlowingGraphCanvasTransientGeometry.resizing(
      CGRect(x: 10, y: 20, width: 100, height: 50),
      edges: [.trailing],
      translation: CGSize(width: 10, height: 0),
      modifiers: [.resizeFromCenter]
    )

    XCTAssertEqual(result, CGRect(x: 0, y: 20, width: 120, height: 50))
  }

  func testSideResizePreservesAspectRatioAroundTheOtherAxisCenter() {
    let result = FlowingGraphCanvasTransientGeometry.resizing(
      CGRect(x: 10, y: 20, width: 100, height: 50),
      edges: [.trailing],
      translation: CGSize(width: 20, height: 0),
      modifiers: [.preserveResizeAspectRatio]
    )

    XCTAssertEqual(result, CGRect(x: 10, y: 15, width: 120, height: 60))
  }

  func testTransientGeometryScalesEveryFrameInsideSelectionBounds() {
    let result = FlowingGraphCanvasTransientGeometry.scaling(
      [
        "first": CGRect(x: 0, y: 0, width: 10, height: 10),
        "second": CGRect(x: 30, y: 20, width: 20, height: 20),
      ],
      from: CGRect(x: 0, y: 0, width: 50, height: 40),
      to: CGRect(x: 10, y: 20, width: 100, height: 80)
    )

    XCTAssertEqual(result["first"], CGRect(x: 10, y: 20, width: 20, height: 20))
    XCTAssertEqual(result["second"], CGRect(x: 70, y: 60, width: 40, height: 40))
  }

  func testTransientGroupResizeDerivesStableBoundsAndMembership() throws {
    let fixture = try makeFixture()
    let nodeIDs = fixture.presentation.nodes.prefix(2).map(\.id)
    let frames = Dictionary(
      uniqueKeysWithValues: try nodeIDs.map { nodeID in
        let localID = try XCTUnwrap(fixture.presentation.nodes.first { $0.id == nodeID }?.localID)
        return (nodeID, try XCTUnwrap(fixture.result.frame(for: localID)))
      }
    )
    let resize = FlowingGraphCanvasTransientNodeResize<CanvasCompositionSchema>(
      anchorNodeID: nodeIDs[0],
      basePresentationSnapshotID: fixture.presentation.snapshotID,
      baseLayoutInputID: fixture.input.id,
      nodeOrder: Array(nodeIDs),
      baseFrames: frames,
      edges: [.trailing, .bottom]
    )

    XCTAssertEqual(resize.nodeIDs, Set(nodeIDs))
    XCTAssertEqual(
      resize.baseBounds,
      frames.values.reduce(CGRect.null) { $0.union($1) }
    )
    XCTAssertEqual(resize.bounds, resize.baseBounds)
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

  func testViewportRestoreCommandCarriesExplicitSessionGeometry() {
    let transform = FlowingCanvasTransform(
      zoom: 1.75,
      offset: CGSize(width: 48, height: -32)
    )
    let command = FlowingGraphCanvasSessionCommand<CanvasCompositionSchema>(
      targetSessionID: FlowingGraphCanvasSessionID(),
      action: .restoreViewport(transform),
      animated: false
    )

    XCTAssertEqual(command.action, .restoreViewport(transform))
    XCTAssertFalse(command.animated)
  }

  func testJumpCommandTargetsOneSessionAndCarriesSelectionPolicy() throws {
    let fixture = try makeFixture()
    let nodeID = try XCTUnwrap(fixture.presentation.nodes.first?.id)
    let sessionID = FlowingGraphCanvasSessionID()
    let command: FlowingGraphCanvasSessionCommand<CanvasCompositionSchema> =
      FlowingGraphCanvasNavigation.jumpCommand(
        to: nodeID,
        in: sessionID,
        selection: .add,
        zoom: 1.4,
        animated: false
      )

    XCTAssertTrue(command.targets(sessionID))
    XCTAssertEqual(
      command.action,
      .jumpToElement(elementID: nodeID, selection: .add, zoom: 1.4)
    )
    XCTAssertFalse(command.animated)
  }

  @MainActor
  func testConnectionResolverCreatesValidatedPortConnection() throws {
    let fixture = try makeFixture()
    let content = try FlowingGraphCanvasContent<CanvasCompositionSchema>(
      presentation: fixture.presentation,
      layoutInput: fixture.input,
      layoutResult: fixture.result
    )
    let source = try XCTUnwrap(
      fixture.presentation.ports.first(where: { $0.value == "Output" })
    )
    let target = try XCTUnwrap(
      fixture.presentation.ports.first(where: { $0.value == "Input" })
    )
    let targetAnchor = try XCTUnwrap(content.anchor(for: target.localID))
    let origin = FlowingGraphCanvasConnectionOrigin<CanvasCompositionSchema>.new(
      sourcePortID: source.id
    )
    var requests: [FlowingGraphCanvasConnectionValidationRequest<CanvasCompositionSchema>] = []
    let policy = FlowingGraphCanvasConnectionPolicy<CanvasCompositionSchema>(
      validate: {
        requests.append($0)
        return .valid
      }
    )
    var connection = try XCTUnwrap(
      FlowingGraphCanvasConnectionInteractionResolver.begin(
        origin: origin,
        content: content,
        policy: policy
      )
    )

    FlowingGraphCanvasConnectionInteractionResolver.update(
      &connection,
      worldLocation: targetAnchor.position,
      targetHitRadius: 12,
      content: content,
      policy: policy
    )

    XCTAssertEqual(connection.candidatePortID, target.id)
    XCTAssertEqual(connection.validation, .valid)
    XCTAssertEqual(requests.map(\.targetPortID), [target.id])
    guard
      case .completed(let intent) =
        FlowingGraphCanvasConnectionInteractionResolver.resolve(connection)
    else {
      return XCTFail("Expected a completed connection")
    }
    XCTAssertEqual(
      intent.operation,
      .create(sourcePortID: source.id, targetPortID: target.id)
    )
  }

  @MainActor
  func testConnectionResolverPreservesInvalidFeedbackAndCancellation() throws {
    let fixture = try makeFixture()
    let content = try FlowingGraphCanvasContent<CanvasCompositionSchema>(
      presentation: fixture.presentation,
      layoutInput: fixture.input,
      layoutResult: fixture.result
    )
    let ports = fixture.presentation.ports
    let source = try XCTUnwrap(ports.first)
    let target = try XCTUnwrap(ports.last)
    let targetAnchor = try XCTUnwrap(content.anchor(for: target.localID))
    let feedback = FlowingGraphCanvasConnectionFeedback(message: "Type mismatch")
    let policy = FlowingGraphCanvasConnectionPolicy<CanvasCompositionSchema>(
      validate: { _ in .invalid(feedback) }
    )
    var connection = try XCTUnwrap(
      FlowingGraphCanvasConnectionInteractionResolver.begin(
        origin: .new(sourcePortID: source.id),
        content: content,
        policy: policy
      )
    )

    FlowingGraphCanvasConnectionInteractionResolver.update(
      &connection,
      worldLocation: targetAnchor.position,
      targetHitRadius: 12,
      content: content,
      policy: policy
    )

    guard
      case .cancelled(let intent) =
        FlowingGraphCanvasConnectionInteractionResolver.resolve(connection)
    else {
      return XCTFail("Expected an invalid connection to be cancelled")
    }
    XCTAssertEqual(intent.reason, .invalidTarget(feedback))
  }

  @MainActor
  func testConnectionResolverSupportsEndpointReconnection() throws {
    let fixture = try makeFixture()
    let content = try FlowingGraphCanvasContent<CanvasCompositionSchema>(
      presentation: fixture.presentation,
      layoutInput: fixture.input,
      layoutResult: fixture.result
    )
    let edge = try XCTUnwrap(fixture.presentation.edges.first)
    guard case .directed(.port(let firstID), .port(let secondID)) = edge.endpoints else {
      return XCTFail("Expected port endpoints")
    }
    let origin = FlowingGraphCanvasConnectionOrigin<CanvasCompositionSchema>.reconnect(
      edgeID: edge.id,
      endpoint: .first,
      originalEndpointID: firstID,
      fixedEndpointID: secondID
    )
    let policy = FlowingGraphCanvasConnectionPolicy<CanvasCompositionSchema>()
    var connection = try XCTUnwrap(
      FlowingGraphCanvasConnectionInteractionResolver.begin(
        origin: origin,
        content: content,
        policy: policy
      )
    )
    let firstAnchor = try XCTUnwrap(content.connectionAnchor(for: firstID))
    let secondAnchor = try XCTUnwrap(content.connectionAnchor(for: secondID))
    let initialPreview = FlowingGraphCanvasConnectionPreview(connection: connection)
    XCTAssertEqual(initialPreview.first, firstAnchor)
    XCTAssertEqual(initialPreview.second, secondAnchor)

    FlowingGraphCanvasConnectionInteractionResolver.update(
      &connection,
      worldLocation: firstAnchor.position,
      targetHitRadius: 12,
      content: content,
      policy: policy
    )

    guard
      case .completed(let intent) =
        FlowingGraphCanvasConnectionInteractionResolver.resolve(connection)
    else {
      return XCTFail("Expected endpoint reconnection")
    }
    XCTAssertEqual(
      intent.operation,
      .reconnect(edgeID: edge.id, endpoint: .first, targetPortID: firstID)
    )
  }

  @MainActor
  func testConnectionPolicyCanRejectInteractionBeforeSessionAllocation() throws {
    let fixture = try makeFixture()
    let content = try FlowingGraphCanvasContent<CanvasCompositionSchema>(
      presentation: fixture.presentation,
      layoutInput: fixture.input,
      layoutResult: fixture.result
    )
    let portID = try XCTUnwrap(fixture.presentation.ports.first?.id)
    let policy = FlowingGraphCanvasConnectionPolicy<CanvasCompositionSchema>(
      canBegin: { _ in false }
    )

    XCTAssertNil(
      FlowingGraphCanvasConnectionInteractionResolver.begin(
        origin: .new(sourcePortID: portID),
        content: content,
        policy: policy
      )
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
        FlowingGraphPort(
          key: FlowingGraphPortKey(nodeID: "target", portID: "input"),
          value: "Input"
        )
      )
      transaction.insert(
        FlowingGraphEdge(
          id: "edge",
          endpoints: .directed(
            source: .port(FlowingGraphPortKey(nodeID: "source", portID: "output")),
            target: .port(FlowingGraphPortKey(nodeID: "target", portID: "input"))
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
