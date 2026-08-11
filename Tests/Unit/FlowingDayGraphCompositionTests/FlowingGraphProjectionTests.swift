import FlowingDayGraphComposition
import FlowingDayGraphCore
import XCTest

final class FlowingGraphProjectionTests: XCTestCase {
  func testCollapsedProjectionKeepsTheCompositeNodeAndBoundary() throws {
    let document = makeDocument(
      definitions: [
        makeDefinition("root", nodes: ["composite", "value"]),
        makeDefinition("child", nodes: ["child-value"]),
      ],
      links: [makeLink("child", from: "root", nodeID: "composite", to: "child")]
    )

    let presentation = try FlowingGraphProjector(document: document).project(
      state: FlowingGraphProjectionState(entryPointID: "main")
    )

    XCTAssertEqual(presentation.instances.map(\.address.graphID), ["root"])
    XCTAssertEqual(presentation.nodes.map(\.address.graphID), ["root", "root"])
    XCTAssertEqual(presentation.contextEdges.map(\.state), [.boundary(.collapsed)])
  }

  func testInlineExpansionProducesNestedOwnedInstances() throws {
    let document = makeDocument(
      definitions: [
        makeDefinition("root", nodes: ["middle-site"]),
        makeDefinition("middle", nodes: ["leaf-site"]),
        makeDefinition("leaf", nodes: ["value"]),
      ],
      links: [
        makeLink("middle", from: "root", nodeID: "middle-site", to: "middle", ownership: .owned),
        makeLink("leaf", from: "middle", nodeID: "leaf-site", to: "leaf", ownership: .owned),
      ]
    )
    let expanded: Set<TestSite> = [
      site(graphID: "root", nodeID: "middle-site"),
      site(
        graphID: "middle",
        nodeID: "leaf-site",
        components: [("root", "middle-site")]
      ),
    ]

    let presentation = try FlowingGraphProjector(document: document).project(
      state: FlowingGraphProjectionState(
        entryPointID: "main",
        expandedSites: expanded
      )
    )

    XCTAssertEqual(presentation.instances.map(\.address.graphID), ["root", "middle", "leaf"])
    XCTAssertEqual(presentation.instances.map(\.depth), [0, 1, 2])
    XCTAssertEqual(presentation.instances.map(\.handle.rawValue), [0, 1, 2])
    XCTAssertEqual(
      presentation.instances.map { $0.parentInstanceHandle?.rawValue },
      [nil, 0, 1]
    )
    XCTAssertEqual(
      presentation.contextEdges.map { $0.targetInstanceHandle?.rawValue },
      [1, 2]
    )
    XCTAssertEqual(
      presentation.instances.map(\.address.path.components.count),
      [0, 1, 2]
    )
    XCTAssertEqual(
      presentation.contextEdges.map(\.state),
      [
        .expanded(instance(graphID: "middle", components: [("root", "middle-site")])),
        .expanded(
          instance(
            graphID: "leaf",
            components: [("root", "middle-site"), ("middle", "leaf-site")]
          )
        ),
      ]
    )
  }

  func testTwoReferencesToOneDefinitionHaveDistinctPresentationIdentity() throws {
    let document = makeDocument(
      definitions: [
        makeDefinition("root", nodes: ["first-site", "second-site"]),
        makeDefinition("shared", nodes: ["shared-value"]),
      ],
      links: [
        makeLink("first", from: "root", nodeID: "first-site", to: "shared"),
        makeLink("second", from: "root", nodeID: "second-site", to: "shared"),
      ]
    )
    let expanded: Set<TestSite> = [
      site(graphID: "root", nodeID: "first-site"),
      site(graphID: "root", nodeID: "second-site"),
    ]

    let presentation = try FlowingGraphProjector(document: document).project(
      state: FlowingGraphProjectionState(
        entryPointID: "main",
        expandedSites: expanded
      )
    )
    let sharedNodes = presentation.nodes.filter { $0.address.graphID == "shared" }

    XCTAssertEqual(sharedNodes.count, 2)
    XCTAssertNotEqual(sharedNodes[0].id, sharedNodes[1].id)
    XCTAssertNotEqual(sharedNodes[0].localID, sharedNodes[1].localID)
    XCTAssertNotEqual(
      sharedNodes[0].address.instancePath,
      sharedNodes[1].address.instancePath
    )
  }

  func testDuplicateLocalNodeIDsAcrossDefinitionsRemainDistinct() throws {
    let document = makeDocument(
      definitions: [
        makeDefinition("root", nodes: ["same", "child-site"]),
        makeDefinition("child", nodes: ["same"]),
      ],
      links: [makeLink("child", from: "root", nodeID: "child-site", to: "child")]
    )

    let presentation = try FlowingGraphProjector(document: document).project(
      state: FlowingGraphProjectionState(
        entryPointID: "main",
        expandedSites: [site(graphID: "root", nodeID: "child-site")]
      )
    )
    let sameNodes = presentation.nodes.filter {
      $0.address.elementID == .node("same")
    }

    XCTAssertEqual(sameNodes.count, 2)
    XCTAssertNotEqual(sameNodes[0].id, sameNodes[1].id)
    XCTAssertEqual(Set(sameNodes.map(\.address.graphID)), ["root", "child"])
  }

  func testRecursiveReferenceBecomesAStableBoundary() throws {
    let document = makeDocument(
      definitions: [makeDefinition("root", nodes: ["recursive-site"])],
      links: [makeLink("recursive", from: "root", nodeID: "recursive-site", to: "root")]
    )
    let projector = try FlowingGraphProjector(document: document)
    let state = FlowingGraphProjectionState<TestCompositionSchema>(
      entryPointID: "main",
      expandedSites: [site(graphID: "root", nodeID: "recursive-site")]
    )

    let first = try projector.project(state: state)
    let second = try projector.project(state: state)

    XCTAssertEqual(first.instances.count, 1)
    XCTAssertEqual(first.contextEdges.map(\.state), [.boundary(.recursiveReference("root"))])
    XCTAssertEqual(first.contextEdges.map(\.id), second.contextEdges.map(\.id))
  }

  func testDiamondExpansionTruncatesDeterministicallyAtTheInstanceBudget() throws {
    let document = diamondDocument()
    let expanded: Set<TestSite> = [
      site(graphID: "root", nodeID: "first-b"),
      site(graphID: "root", nodeID: "second-b"),
      site(graphID: "b", nodeID: "first-c", components: [("root", "first-b")]),
      site(graphID: "b", nodeID: "second-c", components: [("root", "first-b")]),
      site(graphID: "b", nodeID: "first-c", components: [("root", "second-b")]),
      site(graphID: "b", nodeID: "second-c", components: [("root", "second-b")]),
    ]
    let state = FlowingGraphProjectionState<TestCompositionSchema>(
      entryPointID: "main",
      expandedSites: expanded
    )
    let budget = FlowingGraphProjectionBudget(
      maxInstances: 5,
      maxDepth: 8,
      maxNodes: 100,
      maxPorts: 100,
      maxEdges: 100,
      maxExpansionWork: 1_000
    )
    let projector = try FlowingGraphProjector(document: document)

    let first = try projector.project(state: state, budget: budget)
    let second = try projector.project(state: state, budget: budget)

    XCTAssertEqual(first.instances.map(\.address.graphID), ["root", "b", "c", "c", "b"])
    XCTAssertEqual(
      first.contextEdges.map(\.state),
      [
        .expanded(instance(graphID: "b", components: [("root", "first-b")])),
        .expanded(instance(graphID: "b", components: [("root", "second-b")])),
        .expanded(
          instance(
            graphID: "c",
            components: [("root", "first-b"), ("b", "first-c")]
          )
        ),
        .expanded(
          instance(
            graphID: "c",
            components: [("root", "first-b"), ("b", "second-c")]
          )
        ),
        .boundary(.budgetExceeded(.instances)),
        .boundary(.budgetExceeded(.instances)),
      ]
    )
    XCTAssertEqual(first.contextEdges.map(\.id), second.contextEdges.map(\.id))
    XCTAssertEqual(first.contextEdges.map(\.state), second.contextEdges.map(\.state))
  }

  func testFocusedProjectionUsesTheFullCanonicalInstancePath() throws {
    let document = makeDocument(
      definitions: [
        makeDefinition("root", nodes: ["child-site", "root-value"]),
        makeDefinition("child", nodes: ["child-value"]),
      ],
      links: [makeLink("child", from: "root", nodeID: "child-site", to: "child")]
    )
    let focusPath = FlowingGraphInstancePath(
      components: [
        FlowingGraphDefinitionNodeAddress(graphID: "root", nodeID: "child-site")
      ]
    )

    let presentation = try FlowingGraphProjector(document: document).project(
      state: FlowingGraphProjectionState(
        entryPointID: "main",
        focusPath: focusPath
      )
    )

    XCTAssertEqual(presentation.instances.map(\.address.graphID), ["child"])
    XCTAssertEqual(presentation.instances[0].address.path, focusPath)
    XCTAssertEqual(
      presentation.instances[0].parentSite,
      site(graphID: "root", nodeID: "child-site")
    )
    XCTAssertEqual(presentation.nodes.map(\.address.graphID), ["child"])
  }

  func testProjectionCanSelectANonDefaultNamedEntryPoint() throws {
    let document = makeDocument(
      entryPoints: [
        FlowingGraphEntryPoint(id: "main", name: "Main", graphID: "root"),
        FlowingGraphEntryPoint(id: "alternate", name: "Alternate", graphID: "alternate"),
      ],
      definitions: [
        makeDefinition("root", nodes: ["root-value"]),
        makeDefinition("alternate", nodes: ["alternate-value"]),
      ]
    )

    let presentation = try FlowingGraphProjector(document: document).project(
      state: FlowingGraphProjectionState(entryPointID: "alternate")
    )

    XCTAssertEqual(presentation.entryPointID, "alternate")
    XCTAssertEqual(presentation.instances.map(\.address.graphID), ["alternate"])
  }

  func testDefaultProjectionUsesTheExplicitDefaultEntryPoint() throws {
    let document = makeDocument(
      defaultEntryPointID: "secondary",
      entryPoints: [
        FlowingGraphEntryPoint(id: "primary", name: "Primary", graphID: "primary"),
        FlowingGraphEntryPoint(id: "secondary", name: "Secondary", graphID: "secondary"),
      ],
      definitions: [
        makeDefinition("primary", nodes: ["primary-value"]),
        makeDefinition("secondary", nodes: ["secondary-value"]),
      ]
    )

    let presentation = try FlowingGraphProjector(document: document).projectDefault()

    XCTAssertEqual(presentation.entryPointID, "secondary")
    XCTAssertEqual(presentation.instances.map(\.address.graphID), ["secondary"])
  }

  func testProjectionPreservesPortsAndExactEdgeEndpoints() throws {
    let portKey = FlowingGraphPortKey<TestGraphSchema>(nodeID: "source", portID: "output")
    let graph = makeGraph(
      nodes: ["source", "target"],
      ports: [FlowingGraphPort(key: portKey, value: "output")],
      edges: [
        FlowingGraphEdge(
          id: "edge",
          endpoints: .directed(source: .port(portKey), target: .node("target")),
          value: "edge"
        )
      ]
    )
    let document = makeDocument(
      definitions: [FlowingGraphDefinition(id: "root", graph: graph)]
    )

    let presentation = try FlowingGraphProjector(document: document).project(
      state: FlowingGraphProjectionState(entryPointID: "main")
    )

    XCTAssertEqual(presentation.ports.count, 1)
    guard case .directed(let source, let target) = presentation.edges[0].endpoints else {
      return XCTFail("Expected a directed edge")
    }
    XCTAssertEqual(source, .port(presentation.ports[0].id))
    let targetNode = try XCTUnwrap(
      presentation.nodes.first { $0.address.elementID == .node("target") }
    )
    XCTAssertEqual(target, .node(targetNode.id))
  }

  func testInlineExpansionRedirectsBoundPortsAcrossTheInstanceBoundary() throws {
    let boundExternal = FlowingGraphPortKey<TestGraphSchema>(
      nodeID: "composite",
      portID: "bound"
    )
    let unboundExternal = FlowingGraphPortKey<TestGraphSchema>(
      nodeID: "composite",
      portID: "unbound"
    )
    let internalPort = FlowingGraphPortKey<TestGraphSchema>(
      nodeID: "internal",
      portID: "input"
    )
    let root = makeGraph(
      nodes: ["source", "composite"],
      ports: [
        FlowingGraphPort(key: boundExternal, value: "bound"),
        FlowingGraphPort(key: unboundExternal, value: "unbound"),
      ],
      edges: [
        FlowingGraphEdge(
          id: "bound-edge",
          endpoints: .directed(source: .node("source"), target: .port(boundExternal)),
          value: "bound-edge"
        ),
        FlowingGraphEdge(
          id: "unbound-edge",
          endpoints: .directed(source: .node("source"), target: .port(unboundExternal)),
          value: "unbound-edge"
        ),
      ]
    )
    let child = makeGraph(
      nodes: ["internal"],
      ports: [FlowingGraphPort(key: internalPort, value: "input")]
    )
    let interface = FlowingSubgraphInterface<TestCompositionSchema>(
      bindings: [
        FlowingSubgraphInterfaceBinding(
          externalPort: boundExternal,
          internalEndpoint: .port(internalPort)
        )
      ]
    )
    let document = makeDocument(
      definitions: [
        FlowingGraphDefinition(id: "root", graph: root),
        FlowingGraphDefinition(id: "child", graph: child),
      ],
      links: [
        makeLink(
          "child",
          from: "root",
          nodeID: "composite",
          to: "child",
          interface: interface
        )
      ]
    )
    let projector = try FlowingGraphProjector(document: document)

    let collapsed = try projector.project(
      state: FlowingGraphProjectionState(entryPointID: "main")
    )
    let expanded = try projector.project(
      state: FlowingGraphProjectionState(
        entryPointID: "main",
        expandedSites: [site(graphID: "root", nodeID: "composite")]
      )
    )

    let collapsedBound = try XCTUnwrap(
      collapsed.edges.first { $0.address.elementID == .edge("bound-edge") }
    )
    let collapsedExternalPort = try XCTUnwrap(
      collapsed.ports.first { $0.address.elementID == .port(boundExternal) }
    )
    guard case .directed(_, let collapsedTarget) = collapsedBound.endpoints else {
      return XCTFail("Expected a directed edge")
    }
    XCTAssertEqual(collapsedTarget, .port(collapsedExternalPort.id))

    let expandedBound = try XCTUnwrap(
      expanded.edges.first { $0.address.elementID == .edge("bound-edge") }
    )
    let expandedInternalPort = try XCTUnwrap(
      expanded.ports.first {
        $0.address.graphID == "child" && $0.address.elementID == .port(internalPort)
      }
    )
    guard case .directed(let expandedSource, let expandedTarget) = expandedBound.endpoints else {
      return XCTFail("Expected a directed edge")
    }
    let rootSource = try XCTUnwrap(
      expanded.nodes.first {
        $0.address.graphID == "root" && $0.address.elementID == .node("source")
      }
    )
    XCTAssertEqual(expandedSource, .node(rootSource.id))
    XCTAssertEqual(expandedTarget, .port(expandedInternalPort.id))

    let expandedUnbound = try XCTUnwrap(
      expanded.edges.first { $0.address.elementID == .edge("unbound-edge") }
    )
    let expandedExternalPort = try XCTUnwrap(
      expanded.ports.first { $0.address.elementID == .port(unboundExternal) }
    )
    guard case .directed(_, let unboundTarget) = expandedUnbound.endpoints else {
      return XCTFail("Expected a directed edge")
    }
    XCTAssertEqual(unboundTarget, .port(expandedExternalPort.id))
  }

  func testTwoExpandedInterfacesCanRedirectBothEndsOfOneEdge() throws {
    let firstExternal = FlowingGraphPortKey<TestGraphSchema>(
      nodeID: "first-site",
      portID: "port"
    )
    let secondExternal = FlowingGraphPortKey<TestGraphSchema>(
      nodeID: "second-site",
      portID: "port"
    )
    let root = makeGraph(
      nodes: ["first-site", "second-site"],
      ports: [
        FlowingGraphPort(key: firstExternal, value: "first"),
        FlowingGraphPort(key: secondExternal, value: "second"),
      ],
      edges: [
        FlowingGraphEdge(
          id: "between",
          endpoints: .directed(source: .port(firstExternal), target: .port(secondExternal)),
          value: "between"
        )
      ]
    )
    let interface = { (externalPort: FlowingGraphPortKey<TestGraphSchema>) in
      FlowingSubgraphInterface<TestCompositionSchema>(
        bindings: [
          FlowingSubgraphInterfaceBinding(
            externalPort: externalPort,
            internalEndpoint: .node("internal")
          )
        ]
      )
    }
    let document = makeDocument(
      definitions: [
        FlowingGraphDefinition(id: "root", graph: root),
        makeDefinition("child", nodes: ["internal"]),
      ],
      links: [
        makeLink(
          "first",
          from: "root",
          nodeID: "first-site",
          to: "child",
          interface: interface(firstExternal)
        ),
        makeLink(
          "second",
          from: "root",
          nodeID: "second-site",
          to: "child",
          interface: interface(secondExternal)
        ),
      ]
    )

    let presentation = try FlowingGraphProjector(document: document).project(
      state: FlowingGraphProjectionState(
        entryPointID: "main",
        expandedSites: [
          site(graphID: "root", nodeID: "first-site"),
          site(graphID: "root", nodeID: "second-site"),
        ]
      )
    )
    let firstInternal = try XCTUnwrap(
      presentation.nodes.first {
        $0.address.graphID == "child"
          && $0.address.instancePath.components.last?.nodeID == "first-site"
      }
    )
    let secondInternal = try XCTUnwrap(
      presentation.nodes.first {
        $0.address.graphID == "child"
          && $0.address.instancePath.components.last?.nodeID == "second-site"
      }
    )
    let edge = try XCTUnwrap(
      presentation.edges.first { $0.address.elementID == .edge("between") }
    )
    guard case .directed(let source, let target) = edge.endpoints else {
      return XCTFail("Expected a directed edge")
    }

    XCTAssertEqual(source, .node(firstInternal.id))
    XCTAssertEqual(target, .node(secondInternal.id))
  }

  func testInterfaceRedirectionScalesWithTwentyThousandIncidentEdges() throws {
    let edgeCount = 20_000
    let externalPort = FlowingGraphPortKey<TestGraphSchema>(
      nodeID: "composite",
      portID: "external"
    )
    let sourceNodeIDs = (0..<edgeCount).map { "source-\($0)" }
    let root = makeGraph(
      nodes: ["composite"] + sourceNodeIDs,
      ports: [FlowingGraphPort(key: externalPort, value: "external")],
      edges: sourceNodeIDs.enumerated().map { index, nodeID in
        FlowingGraphEdge(
          id: "edge-\(index)",
          endpoints: .directed(source: .node(nodeID), target: .port(externalPort)),
          value: "edge"
        )
      }
    )
    let document = makeDocument(
      definitions: [
        FlowingGraphDefinition(id: "root", graph: root),
        makeDefinition("child", nodes: ["internal"]),
      ],
      links: [
        makeLink(
          "child",
          from: "root",
          nodeID: "composite",
          to: "child",
          interface: FlowingSubgraphInterface(
            bindings: [
              FlowingSubgraphInterfaceBinding(
                externalPort: externalPort,
                internalEndpoint: .node("internal")
              )
            ]
          )
        )
      ]
    )

    let presentation = try FlowingGraphProjector(document: document).project(
      state: FlowingGraphProjectionState(
        entryPointID: "main",
        expandedSites: [site(graphID: "root", nodeID: "composite")]
      ),
      budget: FlowingGraphProjectionBudget(
        maxInstances: 2,
        maxDepth: 1,
        maxNodes: edgeCount + 2,
        maxPorts: 1,
        maxEdges: edgeCount + 1,
        maxExpansionWork: edgeCount * 3 + 10
      )
    )
    let internalNode = try XCTUnwrap(
      presentation.nodes.first { $0.address.graphID == "child" }
    )

    XCTAssertEqual(presentation.edges.count, edgeCount)
    XCTAssertTrue(
      presentation.edges.allSatisfy { edge in
        guard case .directed(_, let target) = edge.endpoints else { return false }
        return target == .node(internalNode.id)
      }
    )
  }

  func testChildExpansionReportsTheFirstExceededBudgetDimension() throws {
    let document = makeDocument(
      definitions: [
        makeDefinition("root", nodes: ["child-site"]),
        makeDefinition("child", nodes: ["first", "second"]),
      ],
      links: [makeLink("child", from: "root", nodeID: "child-site", to: "child")]
    )
    let budget = FlowingGraphProjectionBudget(
      maxInstances: 10,
      maxDepth: 10,
      maxNodes: 1,
      maxPorts: 10,
      maxEdges: 10,
      maxExpansionWork: 100
    )

    let presentation = try FlowingGraphProjector(document: document).project(
      state: FlowingGraphProjectionState(
        entryPointID: "main",
        expandedSites: [site(graphID: "root", nodeID: "child-site")]
      ),
      budget: budget
    )

    XCTAssertEqual(presentation.contextEdges.map(\.state), [.boundary(.budgetExceeded(.nodes))])
  }

  func testDepthBudgetTruncatesAtTheExpansionSite() throws {
    let document = makeDocument(
      definitions: [
        makeDefinition("root", nodes: ["child-site"]),
        makeDefinition("child", nodes: ["value"]),
      ],
      links: [makeLink("child", from: "root", nodeID: "child-site", to: "child")]
    )
    let budget = FlowingGraphProjectionBudget(
      maxInstances: 10,
      maxDepth: 0,
      maxNodes: 10,
      maxPorts: 10,
      maxEdges: 10,
      maxExpansionWork: 100
    )

    let presentation = try FlowingGraphProjector(document: document).project(
      state: FlowingGraphProjectionState(
        entryPointID: "main",
        expandedSites: [site(graphID: "root", nodeID: "child-site")]
      ),
      budget: budget
    )

    XCTAssertEqual(presentation.contextEdges.map(\.state), [.boundary(.budgetExceeded(.depth))])
  }

  func testPortEdgeAndWorkBudgetsEachTruncateTheChildExpansion() throws {
    let childPort = FlowingGraphPort<TestGraphSchema>(
      key: FlowingGraphPortKey(nodeID: "source", portID: "port"),
      value: "port"
    )
    let childEdge = FlowingGraphEdge<TestGraphSchema>(
      id: "edge",
      endpoints: .directed(source: .node("source"), target: .node("target")),
      value: "edge"
    )
    let childGraph = makeGraph(
      nodes: ["source", "target"],
      ports: [childPort],
      edges: [childEdge]
    )
    let document = makeDocument(
      definitions: [
        makeDefinition("root", nodes: ["child-site"]),
        FlowingGraphDefinition(id: "child", graph: childGraph),
      ],
      links: [makeLink("child", from: "root", nodeID: "child-site", to: "child")]
    )
    let projector = try FlowingGraphProjector(document: document)
    let state = FlowingGraphProjectionState<TestCompositionSchema>(
      entryPointID: "main",
      expandedSites: [site(graphID: "root", nodeID: "child-site")]
    )

    let portLimited = try projector.project(
      state: state,
      budget: FlowingGraphProjectionBudget(
        maxInstances: 10,
        maxDepth: 10,
        maxNodes: 10,
        maxPorts: 0,
        maxEdges: 10,
        maxExpansionWork: 100
      )
    )
    let edgeLimited = try projector.project(
      state: state,
      budget: FlowingGraphProjectionBudget(
        maxInstances: 10,
        maxDepth: 10,
        maxNodes: 10,
        maxPorts: 10,
        maxEdges: 1,
        maxExpansionWork: 100
      )
    )
    let workLimited = try projector.project(
      state: state,
      budget: FlowingGraphProjectionBudget(
        maxInstances: 10,
        maxDepth: 10,
        maxNodes: 10,
        maxPorts: 10,
        maxEdges: 10,
        maxExpansionWork: 3
      )
    )

    XCTAssertEqual(portLimited.contextEdges.map(\.state), [.boundary(.budgetExceeded(.ports))])
    XCTAssertEqual(edgeLimited.contextEdges.map(\.state), [.boundary(.budgetExceeded(.edges))])
    XCTAssertEqual(
      workLimited.contextEdges.map(\.state),
      [.boundary(.budgetExceeded(.expansionWork))]
    )
  }

  func testContextEdgesCountAgainstTheRootEdgeBudget() throws {
    let document = makeDocument(
      definitions: [
        makeDefinition("root", nodes: ["child-site"]),
        makeDefinition("child", nodes: ["value"]),
      ],
      links: [makeLink("child", from: "root", nodeID: "child-site", to: "child")]
    )
    let projector = try FlowingGraphProjector(document: document)

    XCTAssertThrowsError(
      try projector.project(
        state: FlowingGraphProjectionState(entryPointID: "main"),
        budget: FlowingGraphProjectionBudget(
          maxInstances: 1,
          maxDepth: 0,
          maxNodes: 1,
          maxPorts: 0,
          maxEdges: 0,
          maxExpansionWork: 10
        )
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphProjectionError<TestCompositionSchema>,
        .rootExceedsBudget(dimension: .edges, required: 1, limit: 0)
      )
    }
  }

  func testRootStructureOverBudgetReturnsStructuredFailure() throws {
    let document = makeDocument(
      definitions: [makeDefinition("root", nodes: ["first", "second"])]
    )
    let budget = FlowingGraphProjectionBudget(
      maxInstances: 1,
      maxDepth: 0,
      maxNodes: 1,
      maxPorts: 0,
      maxEdges: 0,
      maxExpansionWork: 10
    )
    let projector = try FlowingGraphProjector(document: document)

    XCTAssertThrowsError(
      try projector.project(
        state: FlowingGraphProjectionState(entryPointID: "main"),
        budget: budget
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphProjectionError<TestCompositionSchema>,
        .rootExceedsBudget(dimension: .nodes, required: 2, limit: 1)
      )
    }
  }

  func testInvalidBudgetEntryPointAndFocusPathReturnStructuredFailures() throws {
    let document = makeDocument(
      definitions: [makeDefinition("root", nodes: ["value"])]
    )
    let projector = try FlowingGraphProjector(document: document)
    let invalidBudget = FlowingGraphProjectionBudget(
      maxInstances: -1,
      maxDepth: 0,
      maxNodes: 0,
      maxPorts: 0,
      maxEdges: 0,
      maxExpansionWork: 0
    )

    XCTAssertThrowsError(
      try projector.project(
        state: FlowingGraphProjectionState(entryPointID: "main"),
        budget: invalidBudget
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphProjectionError<TestCompositionSchema>,
        .invalidBudget(dimension: .instances, value: -1)
      )
    }
    XCTAssertThrowsError(
      try projector.project(state: FlowingGraphProjectionState(entryPointID: "missing"))
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphProjectionError<TestCompositionSchema>,
        .unknownEntryPoint("missing")
      )
    }

    let invalidComponent = FlowingGraphDefinitionNodeAddress(
      graphID: "root",
      nodeID: "missing"
    )
    XCTAssertThrowsError(
      try projector.project(
        state: FlowingGraphProjectionState(
          entryPointID: "main",
          focusPath: FlowingGraphInstancePath(components: [invalidComponent])
        )
      )
    ) { error in
      XCTAssertEqual(
        error as? FlowingGraphProjectionError<TestCompositionSchema>,
        .invalidFocusPath(componentIndex: 0, site: invalidComponent)
      )
    }
  }

  func testOneHundredThousandNodeProjectionStaysFinite() throws {
    let nodeIDs = (0..<100_000).map { "node-\($0)" }
    let document = makeDocument(
      definitions: [
        FlowingGraphDefinition(id: "root", graph: makeGraph(nodes: nodeIDs))
      ]
    )

    let presentation = try FlowingGraphProjector(document: document).project(
      state: FlowingGraphProjectionState(entryPointID: "main")
    )

    XCTAssertEqual(presentation.nodes.count, 100_000)
    XCTAssertEqual(presentation.nodes.first?.address.elementID, .node("node-0"))
    XCTAssertEqual(presentation.nodes.last?.address.elementID, .node("node-99999"))
  }

  func testDeepExpansionUsesNoRecursiveCallStackAndStopsAtDepthBudget() throws {
    let definitionCount = 10_000
    var definitions: [FlowingGraphDefinition<TestCompositionSchema>] = []
    var links: [TestLink] = []
    definitions.reserveCapacity(definitionCount)
    links.reserveCapacity(definitionCount - 1)
    for index in 0..<definitionCount {
      definitions.append(makeDefinition("graph-\(index)", nodes: ["child"]))
      if index + 1 < definitionCount {
        links.append(
          makeLink(
            "link-\(index)",
            from: "graph-\(index)",
            nodeID: "child",
            to: "graph-\(index + 1)",
            ownership: .owned
          )
        )
      }
    }

    var components: [(graphID: String, nodeID: String)] = []
    var expandedSites: Set<TestSite> = []
    for depth in 0...64 {
      expandedSites.insert(
        site(
          graphID: "graph-\(depth)",
          nodeID: "child",
          components: components
        )
      )
      components.append(("graph-\(depth)", "child"))
    }
    let presentation = try FlowingGraphProjector(
      document: makeDocument(definitions: definitions, links: links)
    ).project(
      state: FlowingGraphProjectionState(
        entryPointID: "main",
        expandedSites: expandedSites
      ),
      budget: FlowingGraphProjectionBudget(
        maxInstances: 100,
        maxDepth: 64,
        maxNodes: 100,
        maxPorts: 0,
        maxEdges: 100,
        maxExpansionWork: 1_000
      )
    )

    XCTAssertEqual(presentation.instances.count, 65)
    XCTAssertEqual(
      presentation.contextEdges.last?.state,
      .boundary(.budgetExceeded(.depth))
    )
  }

  func testProjectionValuesAreConditionallySendable() throws {
    let document = makeDocument(
      definitions: [makeDefinition("root", nodes: ["value"])]
    )
    let projector = try FlowingGraphProjector(document: document)
    let presentation = try projector.project(
      state: FlowingGraphProjectionState(entryPointID: "main")
    )

    requireSendable(projector)
    requireSendable(presentation)
  }

  private func diamondDocument() -> TestDocument {
    makeDocument(
      definitions: [
        makeDefinition("root", nodes: ["first-b", "second-b"]),
        makeDefinition("b", nodes: ["first-c", "second-c"]),
        makeDefinition("c", nodes: ["leaf"]),
      ],
      links: [
        makeLink("first-b", from: "root", nodeID: "first-b", to: "b"),
        makeLink("second-b", from: "root", nodeID: "second-b", to: "b"),
        makeLink("first-c", from: "b", nodeID: "first-c", to: "c"),
        makeLink("second-c", from: "b", nodeID: "second-c", to: "c"),
      ]
    )
  }

  private func requireSendable<Value: Sendable>(_: Value) {}
}
