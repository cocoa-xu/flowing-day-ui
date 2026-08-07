import FlowingDayGraphCore
import XCTest

final class FlowingGraphAlgorithmTests: XCTestCase {
  private enum TestSchema: FlowingGraphSchema {
    typealias NodeID = String
    typealias NodeValue = Void
    typealias PortID = Int
    typealias PortValue = Void
    typealias EdgeID = String
    typealias EdgeValue = Void
  }

  private enum StressSchema: FlowingGraphSchema {
    typealias NodeID = Int
    typealias NodeValue = Void
    typealias PortID = Int
    typealias PortValue = Void
    typealias EdgeID = Int
    typealias EdgeValue = Void
  }

  func testReachabilityRespectsDirectionAndUndirectedPolicy() {
    let graph = graph(
      nodes: ["a", "b", "c", "d"],
      edges: [
        directed("ab", "a", "b"),
        directed("cb", "c", "b"),
        undirected("bd", "b", "d"),
      ]
    )

    XCTAssertEqual(graph.reachableNodeIDs(from: "a"), ["a", "b", "d"])
    XCTAssertEqual(graph.reachableNodeIDs(from: "b", policy: .incoming), ["b", "a", "c", "d"])
    XCTAssertEqual(
      graph.reachableNodeIDs(
        from: "a",
        policy: .init(direction: .outgoing, includesUndirected: false)
      ),
      ["a", "b"]
    )
    XCTAssertEqual(graph.descendantNodeIDs(of: "a"), ["b"])
    XCTAssertEqual(graph.ancestorNodeIDs(of: "b"), ["a", "c"])
  }

  func testReachabilityTerminatesOnCycle() {
    let graph = graph(
      nodes: ["a", "b", "c"],
      edges: [
        directed("ab", "a", "b"),
        directed("bc", "b", "c"),
        directed("ca", "c", "a"),
      ]
    )

    XCTAssertEqual(graph.reachableNodeIDs(from: "a"), ["a", "b", "c"])
  }

  func testShortestPathReturnsStableEdgeIdentity() {
    let graph = graph(
      nodes: ["a", "b", "c", "d"],
      edges: [
        directed("ab-first", "a", "b"),
        directed("ab-second", "a", "b"),
        directed("bd", "b", "d"),
        directed("ac", "a", "c"),
        directed("cd", "c", "d"),
      ]
    )

    XCTAssertEqual(
      graph.shortestPath(from: "a", to: "d"),
      FlowingGraphPath(nodeIDs: ["a", "b", "d"], edgeIDs: ["ab-first", "bd"])
    )
    XCTAssertNil(graph.shortestPath(from: "d", to: "a"))
  }

  func testWeakComponentsIgnoreEdgeOrientation() {
    let graph = graph(
      nodes: ["a", "b", "c", "isolated"],
      edges: [
        directed("ba", "b", "a"),
        undirected("bc", "b", "c"),
      ]
    )

    XCTAssertEqual(graph.weaklyConnectedComponents(), [["a", "b", "c"], ["isolated"]])
  }

  func testStrongComponentsTreatUndirectedEdgesAsBidirectionalReachability() {
    let graph = graph(
      nodes: ["a", "b", "c", "d"],
      edges: [
        undirected("ab", "a", "b"),
        directed("bc", "b", "c"),
        directed("cb", "c", "b"),
        directed("cd", "c", "d"),
      ]
    )

    XCTAssertEqual(graph.stronglyConnectedComponents(), [["a", "b", "c"], ["d"]])
    XCTAssertEqual(graph.firstCycleEdgeIDs(), ["bc", "cb"])
  }

  func testDirectedAndUndirectedSelfLoopsAreCycles() {
    let directedGraph = graph(
      nodes: ["a"],
      edges: [directed("loop", "a", "a")]
    )
    let undirectedGraph = graph(
      nodes: ["a"],
      edges: [undirected("loop", "a", "a")]
    )

    XCTAssertEqual(directedGraph.firstCycleEdgeIDs(), ["loop"])
    XCTAssertEqual(undirectedGraph.firstCycleEdgeIDs(), ["loop"])
  }

  func testOneUndirectedEdgeIsNotACycleButParallelEdgesAre() {
    let single = graph(
      nodes: ["a", "b"],
      edges: [undirected("first", "a", "b")]
    )
    let parallel = graph(
      nodes: ["a", "b"],
      edges: [
        undirected("first", "a", "b"),
        undirected("second", "a", "b"),
      ]
    )

    XCTAssertNil(single.firstCycleEdgeIDs())
    XCTAssertEqual(parallel.firstCycleEdgeIDs(), ["first", "second"])
  }

  func testMixedTwoEdgeCycleIsFoundRegardlessOfRepresentativeOrder() {
    let graph = graph(
      nodes: ["a", "b"],
      edges: [
        undirected("undirected", "a", "b"),
        directed("directed", "a", "b"),
      ]
    )

    XCTAssertEqual(graph.firstCycleEdgeIDs(), ["directed", "undirected"])
  }

  func testMixedCycleUsesDirectedEdgesOnlyInTheirForwardDirection() {
    let cyclic = graph(
      nodes: ["a", "b", "c"],
      edges: [
        directed("ab", "a", "b"),
        undirected("bc", "b", "c"),
        directed("ca", "c", "a"),
      ]
    )
    let acyclic = graph(
      nodes: ["a", "b", "c"],
      edges: [
        directed("ba", "b", "a"),
        undirected("bc", "b", "c"),
        directed("ca", "c", "a"),
      ]
    )

    XCTAssertEqual(cyclic.firstCycleEdgeIDs(), ["ab", "bc", "ca"])
    XCTAssertNil(acyclic.firstCycleEdgeIDs())
  }

  func testNodeLevelAlgorithmsTreatPortsOnTheSameNodeAsASelfLoop() {
    var graph = FlowingGraph<TestSchema>()
    commit(&graph) { transaction in
      transaction.insert(node("hub"))
      transaction.insert(FlowingGraphPort(key: portKey("hub", 1), value: ()))
      transaction.insert(FlowingGraphPort(key: portKey("hub", 2), value: ()))
      transaction.insert(
        FlowingGraphEdge(
          id: "internal",
          endpoints: .directed(
            source: .port(portKey("hub", 1)),
            target: .port(portKey("hub", 2))
          ),
          value: ()
        )
      )
    }

    XCTAssertEqual(graph.firstCycleEdgeIDs(), ["internal"])
  }

  func testDAGValidationRejectsUndirectedEdgesWithStableDiagnostics() {
    let graph = graph(
      nodes: ["a", "b", "c"],
      edges: [
        undirected("first", "a", "b"),
        undirected("second", "b", "c"),
      ]
    )

    assertInvalidDAG(graph.validateDAG(), issue: .undirectedEdges(["first", "second"]))
  }

  func testDAGValidationReportsTheExactCycleEdges() {
    let graph = graph(
      nodes: ["a", "b", "c"],
      edges: [
        directed("ab", "a", "b"),
        directed("bc", "b", "c"),
        directed("ca", "c", "a"),
        directed("ac", "a", "c"),
      ]
    )

    assertInvalidDAG(
      graph.validateDAG(),
      issue: .cycle(edgePath: ["ab", "bc", "ca"])
    )
  }

  func testDAGViewRetainsTheExactValidatedSnapshotAndOrder() {
    var graph = graph(
      nodes: ["a", "b", "c", "d"],
      edges: [
        directed("ac", "a", "c"),
        directed("bc", "b", "c"),
        directed("cd", "c", "d"),
      ]
    )
    let view = validDAG(graph.validateDAG())
    let validatedSnapshotID = graph.snapshotID

    commit(&graph) { transaction in
      transaction.insert(node("later"))
    }

    XCTAssertEqual(view.topologicalNodeIDs, ["a", "b", "c", "d"])
    XCTAssertEqual(view.snapshotID, validatedSnapshotID)
    XCTAssertNotEqual(view.snapshotID, graph.snapshotID)
    XCTAssertNil(view.graph.node(id: "later"))
  }

  func testCycleDetectionMatchesExhaustiveSmallGraphSearch() {
    let nodeCount = 5
    let edgeCount = 8

    for seed in 0..<200 {
      var generator = Generator(state: UInt64(seed + 1))
      var graph = FlowingGraph<StressSchema>()
      commit(&graph) { transaction in
        for nodeID in 0..<nodeCount {
          transaction.insert(FlowingGraphNode(id: nodeID, value: ()))
        }
        for edgeID in 0..<edgeCount {
          let first = generator.next(upperBound: nodeCount)
          let second = generator.next(upperBound: nodeCount)
          let endpoints: FlowingGraphEdgeEndpoints<StressSchema> =
            generator.next(upperBound: 2) == 0
            ? .directed(source: .node(first), target: .node(second))
            : .undirected(.node(first), .node(second))
          transaction.insert(
            FlowingGraphEdge(id: edgeID, endpoints: endpoints, value: ())
          )
        }
      }

      let cycle = graph.firstCycleEdgeIDs()
      XCTAssertEqual(
        cycle != nil,
        hasCycleByExhaustiveSearch(graph),
        "Cycle existence differed for seed \(seed)"
      )
      if let cycle {
        XCTAssertTrue(
          isValidCircuit(cycle, in: graph),
          "Invalid cycle diagnostic for seed \(seed): \(cycle)"
        )
      }
    }
  }

  func testAlgorithmValuesAreConditionallySendable() {
    func requireSendable<T: Sendable>(_: T) {}

    let graph = FlowingGraph<StressSchema>()
    requireSendable(FlowingGraphTraversalPolicy.outgoing)
    requireSendable(FlowingGraphPath<StressSchema>(nodeIDs: [], edgeIDs: []))
    let view = validDAG(graph.validateDAG())
    requireSendable(view)
    requireSendable(FlowingDAGValidationResult<StressSchema>.valid(view))
  }

  func testAlgorithmsAreStackSafeOnOneHundredThousandNodePath() {
    let nodeCount = 100_000
    var graph = FlowingGraph<StressSchema>()
    commit(&graph) { transaction in
      for nodeID in 0..<nodeCount {
        transaction.insert(FlowingGraphNode(id: nodeID, value: ()))
      }
      for edgeID in 0..<(nodeCount - 1) {
        transaction.insert(
          FlowingGraphEdge(
            id: edgeID,
            endpoints: .directed(
              source: .node(edgeID),
              target: .node(edgeID + 1)
            ),
            value: ()
          )
        )
      }
    }

    let reachable = graph.reachableNodeIDs(from: 0)
    let components = graph.stronglyConnectedComponents()
    let dag = validDAG(graph.validateDAG())

    XCTAssertEqual(reachable.count, nodeCount)
    XCTAssertEqual(reachable.first, 0)
    XCTAssertEqual(reachable.last, nodeCount - 1)
    XCTAssertEqual(components.count, nodeCount)
    XCTAssertEqual(dag.topologicalNodeIDs.count, nodeCount)
    XCTAssertEqual(dag.topologicalNodeIDs.first, 0)
    XCTAssertEqual(dag.topologicalNodeIDs.last, nodeCount - 1)
  }

  private func graph(
    nodes nodeIDs: [String],
    edges: [FlowingGraphEdge<TestSchema>]
  ) -> FlowingGraph<TestSchema> {
    var graph = FlowingGraph<TestSchema>()
    commit(&graph) { transaction in
      for nodeID in nodeIDs {
        transaction.insert(node(nodeID))
      }
      for edge in edges {
        transaction.insert(edge)
      }
    }
    return graph
  }

  private func node(_ id: String) -> FlowingGraphNode<TestSchema> {
    FlowingGraphNode(id: id, value: ())
  }

  private func directed(
    _ id: String,
    _ source: String,
    _ target: String
  ) -> FlowingGraphEdge<TestSchema> {
    FlowingGraphEdge(
      id: id,
      endpoints: .directed(source: .node(source), target: .node(target)),
      value: ()
    )
  }

  private func undirected(
    _ id: String,
    _ first: String,
    _ second: String
  ) -> FlowingGraphEdge<TestSchema> {
    FlowingGraphEdge(
      id: id,
      endpoints: .undirected(.node(first), .node(second)),
      value: ()
    )
  }

  private func portKey(_ nodeID: String, _ portID: Int) -> FlowingGraphPortKey<TestSchema> {
    FlowingGraphPortKey(nodeID: nodeID, portID: portID)
  }

  @discardableResult
  private func commit<Schema: FlowingGraphSchema>(
    _ graph: inout FlowingGraph<Schema>,
    _ body: (inout FlowingGraphTransaction<Schema>) -> Void
  ) -> FlowingGraphChangeSet<Schema> {
    switch graph.update(body) {
    case .committed(let changeSet):
      return changeSet
    case .rejected(let issue):
      XCTFail("Unexpected rejection: \(issue)")
      fatalError("Unexpected rejection")
    }
  }

  private func assertInvalidDAG(
    _ result: FlowingDAGValidationResult<TestSchema>,
    issue expectedIssue: FlowingDAGValidationIssue<TestSchema>
  ) {
    switch result {
    case .valid:
      XCTFail("Expected invalid DAG")
    case .invalid(let issue):
      XCTAssertEqual(issue, expectedIssue)
    }
  }

  private func validDAG<Schema: FlowingGraphSchema>(
    _ result: FlowingDAGValidationResult<Schema>
  ) -> FlowingDAGView<Schema> {
    switch result {
    case .valid(let view):
      return view
    case .invalid(let issue):
      XCTFail("Unexpected DAG validation failure: \(issue)")
      fatalError("Unexpected DAG validation failure")
    }
  }

  private func hasCycleByExhaustiveSearch(
    _ graph: FlowingGraph<StressSchema>
  ) -> Bool {
    func search(
      from current: Int,
      to start: Int,
      usedEdgeIDs: Set<Int>
    ) -> Bool {
      for step in referenceSteps(from: current, in: graph)
      where !usedEdgeIDs.contains(step.edgeID) {
        if step.nodeID == start {
          return true
        }
        var nextUsedEdgeIDs = usedEdgeIDs
        nextUsedEdgeIDs.insert(step.edgeID)
        if search(
          from: step.nodeID,
          to: start,
          usedEdgeIDs: nextUsedEdgeIDs
        ) {
          return true
        }
      }
      return false
    }

    return graph.nodeIDs.contains { nodeID in
      search(from: nodeID, to: nodeID, usedEdgeIDs: [])
    }
  }

  private func isValidCircuit(
    _ edgeIDs: [Int],
    in graph: FlowingGraph<StressSchema>
  ) -> Bool {
    guard !edgeIDs.isEmpty, Set(edgeIDs).count == edgeIDs.count else { return false }

    return graph.nodeIDs.contains { start in
      var current = start
      for edgeID in edgeIDs {
        guard
          let step = referenceSteps(from: current, in: graph)
            .first(where: { $0.edgeID == edgeID })
        else { return false }
        current = step.nodeID
      }
      return current == start
    }
  }

  private func referenceSteps(
    from nodeID: Int,
    in graph: FlowingGraph<StressSchema>
  ) -> [(edgeID: Int, nodeID: Int)] {
    graph.outgoingEdgeIDs(nodeID: nodeID).compactMap { edgeID in
      guard let edge = graph.edge(id: edgeID) else { return nil }
      switch edge.endpoints {
      case .directed(let source, let target):
        guard case .node(nodeID) = source, case .node(let targetID) = target else {
          return nil
        }
        return (edgeID, targetID)
      case .undirected(let first, let second):
        guard case .node(let firstID) = first, case .node(let secondID) = second else {
          return nil
        }
        if firstID == nodeID {
          return (edgeID, secondID)
        }
        if secondID == nodeID {
          return (edgeID, firstID)
        }
        return nil
      }
    }
  }

  private struct Generator {
    var state: UInt64

    mutating func next(upperBound: Int) -> Int {
      state = state &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
      return Int(state % UInt64(upperBound))
    }
  }
}
