import XCTest
import FlowingDayGraphCore

final class FlowingGraphMutationTests: XCTestCase {
  private enum TestSchema: FlowingGraphSchema {
    typealias NodeID = String
    typealias NodeValue = String
    typealias PortID = Int
    typealias PortValue = String
    typealias EdgeID = String
    typealias EdgeValue = String
  }

  func testTransactionCommitsNodesPortsAndEdgesInStableOrder() {
    var graph = FlowingGraph<TestSchema>()

    let changeSet = commit(&graph) { transaction in
      transaction.insert(node("hub"))
      transaction.insert(node("device"))
      transaction.insert(port("hub", 1))
      transaction.insert(port("hub", 2))
      transaction.insert(directedEdge("connection", from: .port(portKey("hub", 1)), to: .node("device")))
    }

    XCTAssertEqual(graph.nodeIDs, ["hub", "device"])
    XCTAssertEqual(graph.portKeys, [portKey("hub", 1), portKey("hub", 2)])
    XCTAssertEqual(graph.edgeIDs, ["connection"])
    XCTAssertEqual(changeSet.nodeChanges.map(\.id), ["hub", "device"])
    XCTAssertEqual(changeSet.portChanges.map(\.id), [portKey("hub", 1), portKey("hub", 2)])
    XCTAssertEqual(changeSet.edgeChanges.map(\.id), ["connection"])
    XCTAssertEqual(graph.localRevision, 1)
    XCTAssertEqual(changeSet.newSnapshotID, graph.snapshotID)
  }

  func testEmptyPortsRemainFirstClassElements() {
    var graph = FlowingGraph<TestSchema>()

    commit(&graph) { transaction in
      transaction.insert(node("hub"))
      for portID in 1...4 {
        transaction.insert(port("hub", portID))
      }
      transaction.insert(node("first-device"))
      transaction.insert(node("fourth-device"))
      transaction.insert(directedEdge("first", from: .port(portKey("hub", 1)), to: .node("first-device")))
      transaction.insert(directedEdge("fourth", from: .port(portKey("hub", 4)), to: .node("fourth-device")))
    }

    XCTAssertEqual(graph.ports(nodeID: "hub").map(\.key.portID), [1, 2, 3, 4])
    XCTAssertTrue(graph.incidentEdgeIDs(endpoint: .port(portKey("hub", 2))).isEmpty)
    XCTAssertTrue(graph.incidentEdgeIDs(endpoint: .port(portKey("hub", 3))).isEmpty)
  }

  func testPortIdentityIsScopedToItsNode() {
    var graph = FlowingGraph<TestSchema>()

    commit(&graph) { transaction in
      transaction.insert(node("first-hub"))
      transaction.insert(node("second-hub"))
      transaction.insert(port("first-hub", 1))
      transaction.insert(port("second-hub", 1))
    }

    XCTAssertNotNil(graph.port(key: portKey("first-hub", 1)))
    XCTAssertNotNil(graph.port(key: portKey("second-hub", 1)))
  }

  func testParallelEdgesRetainIndependentIdentity() {
    var graph = FlowingGraph<TestSchema>()

    commit(&graph) { transaction in
      transaction.insert(node("source"))
      transaction.insert(node("target"))
      transaction.insert(directedEdge("first", from: .node("source"), to: .node("target")))
      transaction.insert(directedEdge("second", from: .node("source"), to: .node("target")))
    }

    XCTAssertEqual(graph.outgoingEdgeIDs(nodeID: "source"), ["first", "second"])
    XCTAssertEqual(graph.incomingEdgeIDs(nodeID: "target"), ["first", "second"])
  }

  func testParallelEdgesCanShareAnExactPortEndpoint() {
    var graph = FlowingGraph<TestSchema>()

    commit(&graph) { transaction in
      transaction.insert(node("hub"))
      transaction.insert(node("display"))
      transaction.insert(node("storage"))
      transaction.insert(port("hub", 1))
      transaction.insert(
        directedEdge("display-tunnel", from: .port(portKey("hub", 1)), to: .node("display"))
      )
      transaction.insert(
        directedEdge("storage-tunnel", from: .port(portKey("hub", 1)), to: .node("storage"))
      )
    }

    XCTAssertEqual(
      graph.incidentEdgeIDs(endpoint: .port(portKey("hub", 1))),
      ["display-tunnel", "storage-tunnel"]
    )
  }

  func testUndirectedEdgesParticipateInIncomingAndOutgoingQueries() {
    var graph = FlowingGraph<TestSchema>()

    commit(&graph) { transaction in
      transaction.insert(node("first"))
      transaction.insert(node("second"))
      transaction.insert(
        FlowingGraphEdge(
          id: "undirected",
          endpoints: .undirected(.node("first"), .node("second")),
          value: ""
        )
      )
    }

    XCTAssertEqual(graph.outgoingEdgeIDs(nodeID: "first"), ["undirected"])
    XCTAssertEqual(graph.incomingEdgeIDs(nodeID: "first"), ["undirected"])
    XCTAssertEqual(graph.outgoingEdgeIDs(nodeID: "second"), ["undirected"])
    XCTAssertEqual(graph.incomingEdgeIDs(nodeID: "second"), ["undirected"])
  }

  func testUnknownEndpointRejectsTheWholeTransaction() {
    var graph = FlowingGraph<TestSchema>()
    let snapshotID = graph.snapshotID

    let result = graph.update { transaction in
      transaction.insert(node("source"))
      transaction.insert(directedEdge("invalid", from: .node("source"), to: .node("missing")))
    }

    assertRejected(result, issue: .unknownEndpoint(.node("missing")))
    XCTAssertTrue(graph.isEmpty)
    XCTAssertEqual(graph.snapshotID, snapshotID)
    XCTAssertEqual(graph.localRevision, 0)
  }

  func testDeletedPortCannotBeReferencedLaterInTheSameTransaction() {
    var graph = FlowingGraph<TestSchema>()
    commit(&graph) { transaction in
      transaction.insert(node("hub"))
      transaction.insert(node("device"))
      transaction.insert(port("hub", 1))
    }
    let snapshotID = graph.snapshotID

    let result = graph.update { transaction in
      transaction.removePort(key: portKey("hub", 1))
      transaction.insert(
        directedEdge("invalid", from: .port(portKey("hub", 1)), to: .node("device"))
      )
    }

    assertRejected(result, issue: .unknownEndpoint(.port(portKey("hub", 1))))
    XCTAssertNotNil(graph.port(key: portKey("hub", 1)))
    XCTAssertNil(graph.edge(id: "invalid"))
    XCTAssertEqual(graph.snapshotID, snapshotID)
  }

  func testDuplicateIdentityRejectsTheWholeTransaction() {
    var graph = FlowingGraph<TestSchema>()

    let result = graph.update { transaction in
      transaction.insert(node("duplicate"))
      transaction.insert(node("duplicate"))
    }

    assertRejected(result, issue: .duplicateElement(.node("duplicate")))
    XCTAssertTrue(graph.isEmpty)
  }

  func testCascadePortRemovalDeletesIncidentEdges() {
    var graph = connectedPortGraph()

    let changeSet = commit(&graph) { transaction in
      transaction.removePort(key: portKey("hub", 1))
    }

    XCTAssertNil(graph.port(key: portKey("hub", 1)))
    XCTAssertNil(graph.edge(id: "connection"))
    XCTAssertEqual(changeSet.portChanges.map(\.id), [portKey("hub", 1)])
    XCTAssertEqual(changeSet.edgeChanges.map(\.id), ["connection"])
  }

  func testStrictPortRemovalRejectsWhenEdgesAreIncident() {
    var graph = connectedPortGraph()
    let snapshotID = graph.snapshotID

    let result = graph.update { transaction in
      transaction.removePort(key: portKey("hub", 1), policy: .strict)
    }

    assertRejected(
      result,
      issue: .incidentEdgesPreventRemoval(.port(portKey("hub", 1)))
    )
    XCTAssertNotNil(graph.port(key: portKey("hub", 1)))
    XCTAssertNotNil(graph.edge(id: "connection"))
    XCTAssertEqual(graph.snapshotID, snapshotID)
  }

  func testStrictNodeRemovalRejectsWhenEdgesAreIncident() {
    var graph = connectedPortGraph()
    let snapshotID = graph.snapshotID

    let result = graph.update { transaction in
      transaction.removeNode(id: "hub", policy: .strict)
    }

    assertRejected(result, issue: .incidentEdgesPreventRemoval(.node("hub")))
    XCTAssertNotNil(graph.node(id: "hub"))
    XCTAssertNotNil(graph.port(key: portKey("hub", 1)))
    XCTAssertNotNil(graph.edge(id: "connection"))
    XCTAssertEqual(graph.snapshotID, snapshotID)
  }

  func testNodeRemovalDeletesOwnedPortsAndAllIncidentEdges() {
    var graph = connectedPortGraph()

    commit(&graph) { transaction in
      transaction.removeNode(id: "hub")
    }

    XCTAssertNil(graph.node(id: "hub"))
    XCTAssertNil(graph.port(key: portKey("hub", 1)))
    XCTAssertNil(graph.edge(id: "connection"))
    XCTAssertNotNil(graph.node(id: "device"))
  }

  func testLargeCascadeRemovalPrunesEveryAdjacencyIndex() {
    let childCount = 20_000
    var graph = FlowingGraph<TestSchema>()
    commit(&graph) { transaction in
      transaction.insert(node("hub"))
      for index in 0..<childCount {
        let childID = "child-\(index)"
        transaction.insert(node(childID))
        transaction.insert(directedEdge("edge-\(index)", from: .node("hub"), to: .node(childID)))
      }
    }

    commit(&graph) { transaction in
      transaction.removeNode(id: "hub")
    }

    XCTAssertEqual(graph.nodes.count, childCount)
    XCTAssertTrue(graph.edges.isEmpty)
    XCTAssertTrue(graph.incomingEdgeIDs(nodeID: "child-0").isEmpty)
    XCTAssertTrue(graph.incomingEdgeIDs(nodeID: "child-19999").isEmpty)
  }

  func testLargeBatchRetargetCleansEachAffectedAdjacencyBucketOnce() {
    let childCount = 20_000
    var graph = FlowingGraph<TestSchema>()
    commit(&graph) { transaction in
      transaction.insert(node("old-source"))
      transaction.insert(node("new-source"))
      for index in 0..<childCount {
        let childID = "child-\(index)"
        transaction.insert(node(childID))
        transaction.insert(
          directedEdge("edge-\(index)", from: .node("old-source"), to: .node(childID))
        )
      }
    }

    commit(&graph) { transaction in
      for index in 0..<childCount {
        transaction.update(
          directedEdge(
            "edge-\(index)",
            from: .node("new-source"),
            to: .node("child-\(index)")
          )
        )
      }
    }

    XCTAssertTrue(graph.outgoingEdgeIDs(nodeID: "old-source").isEmpty)
    XCTAssertEqual(graph.outgoingEdgeIDs(nodeID: "new-source").count, childCount)
    XCTAssertEqual(graph.incomingEdgeIDs(nodeID: "child-0"), ["edge-0"])
    XCTAssertEqual(graph.incomingEdgeIDs(nodeID: "child-19999"), ["edge-19999"])
  }

  func testLargeBatchRemovalCompactsNodeAndPortOrderOnce() {
    let elementCount = 20_000
    var graph = FlowingGraph<TestSchema>()
    commit(&graph) { transaction in
      transaction.insert(node("hub"))
      for index in 0..<elementCount {
        transaction.insert(node("node-\(index)"))
        transaction.insert(port("hub", index))
      }
    }

    commit(&graph) { transaction in
      for index in stride(from: 0, to: elementCount, by: 2) {
        transaction.removeNode(id: "node-\(index)")
        transaction.removePort(key: portKey("hub", index))
      }
    }

    XCTAssertEqual(graph.nodeIDs.count, elementCount / 2 + 1)
    XCTAssertEqual(graph.ports(nodeID: "hub").count, elementCount / 2)
    XCTAssertEqual(graph.nodeIDs.prefix(3), ["hub", "node-1", "node-3"])
    XCTAssertEqual(graph.ports(nodeID: "hub").prefix(3).map(\.key.portID), [1, 3, 5])
  }

  func testRemovedIdentitiesCanBeReinsertedAndReorderedInOneTransaction() {
    var graph = FlowingGraph<TestSchema>()
    commit(&graph) { transaction in
      transaction.insert(node("hub"))
      transaction.insert(node("first"))
      transaction.insert(node("second"))
      transaction.insert(port("hub", 1))
      transaction.insert(port("hub", 2))
      transaction.insert(directedEdge("first-edge", from: .node("hub"), to: .node("first")))
      transaction.insert(directedEdge("second-edge", from: .node("hub"), to: .node("second")))
    }

    commit(&graph) { transaction in
      transaction.removeNode(id: "first")
      transaction.insert(node("first"))
      transaction.moveNode(id: "first", to: .before("second"))
      transaction.removePort(key: portKey("hub", 1))
      transaction.insert(port("hub", 1))
      transaction.movePort(key: portKey("hub", 1), to: .before(2))
      transaction.insert(
        directedEdge("first-edge", from: .node("hub"), to: .node("first"))
      )
      transaction.moveEdge(id: "first-edge", to: .before("second-edge"))
    }

    XCTAssertEqual(graph.nodeIDs, ["hub", "first", "second"])
    XCTAssertEqual(graph.ports(nodeID: "hub").map(\.key.portID), [1, 2])
    XCTAssertEqual(graph.edgeIDs, ["first-edge", "second-edge"])
    XCTAssertEqual(graph.outgoingEdgeIDs(nodeID: "hub"), ["first-edge", "second-edge"])
  }

  func testStableIDReorderUpdatesCollectionsAndIndices() {
    var graph = FlowingGraph<TestSchema>()
    commit(&graph) { transaction in
      transaction.insert(node("first"))
      transaction.insert(node("second"))
      transaction.insert(node("third"))
      transaction.insert(directedEdge("a", from: .node("first"), to: .node("second")))
      transaction.insert(directedEdge("b", from: .node("first"), to: .node("third")))
    }

    let changeSet = commit(&graph) { transaction in
      transaction.moveNode(id: "third", to: .before("second"))
      transaction.moveEdge(id: "b", to: .before("a"))
    }

    XCTAssertEqual(graph.nodeIDs, ["first", "third", "second"])
    XCTAssertEqual(graph.edgeIDs, ["b", "a"])
    XCTAssertEqual(graph.outgoingEdgeIDs(nodeID: "first"), ["b", "a"])
    XCTAssertEqual(changeSet.nodeOrderChanges.first?.id, "third")
    XCTAssertEqual(changeSet.nodeOrderChanges.first?.oldPosition, .after("second"))
    XCTAssertEqual(changeSet.nodeOrderChanges.first?.newPosition, .after("first"))
    XCTAssertEqual(changeSet.edgeOrderChanges.first?.id, "b")
    XCTAssertEqual(changeSet.edgeOrderChanges.first?.oldPosition, .after("a"))
    XCTAssertEqual(changeSet.edgeOrderChanges.first?.newPosition, .first)
  }

  func testPortReorderIsScopedToTheOwningNode() {
    var graph = FlowingGraph<TestSchema>()
    commit(&graph) { transaction in
      transaction.insert(node("first-hub"))
      transaction.insert(node("second-hub"))
      transaction.insert(port("first-hub", 1))
      transaction.insert(port("first-hub", 2))
      transaction.insert(port("first-hub", 3))
      transaction.insert(port("second-hub", 1))
      transaction.insert(port("second-hub", 2))
    }

    let changeSet = commit(&graph) { transaction in
      transaction.movePort(key: portKey("first-hub", 3), to: .before(2))
    }

    XCTAssertEqual(graph.ports(nodeID: "first-hub").map(\.key.portID), [1, 3, 2])
    XCTAssertEqual(graph.ports(nodeID: "second-hub").map(\.key.portID), [1, 2])
    XCTAssertEqual(changeSet.portOrderChanges.first?.id, portKey("first-hub", 3))
    XCTAssertEqual(changeSet.portOrderChanges.first?.oldPosition, .after(portKey("first-hub", 2)))
    XCTAssertEqual(changeSet.portOrderChanges.first?.newPosition, .after(portKey("first-hub", 1)))
  }

  func testEdgeUpdateRetargetsEveryAdjacencyIndex() {
    var graph = FlowingGraph<TestSchema>()
    commit(&graph) { transaction in
      transaction.insert(node("source"))
      transaction.insert(node("old-target"))
      transaction.insert(node("new-target"))
      transaction.insert(port("new-target", 1))
      transaction.insert(directedEdge("edge", from: .node("source"), to: .node("old-target")))
    }

    commit(&graph) { transaction in
      transaction.update(
        directedEdge("edge", from: .node("source"), to: .port(portKey("new-target", 1)))
      )
    }

    XCTAssertTrue(graph.incomingEdgeIDs(nodeID: "old-target").isEmpty)
    XCTAssertEqual(graph.incomingEdgeIDs(nodeID: "new-target"), ["edge"])
    XCTAssertTrue(graph.incidentEdgeIDs(endpoint: .node("old-target")).isEmpty)
    XCTAssertEqual(graph.incidentEdgeIDs(endpoint: .port(portKey("new-target", 1))), ["edge"])
  }

  func testRetargetThenStrictRemovalUsesCurrentConnectivityInOneTransaction() {
    var graph = FlowingGraph<TestSchema>()
    commit(&graph) { transaction in
      transaction.insert(node("source"))
      transaction.insert(node("old-target"))
      transaction.insert(node("new-target"))
      transaction.insert(directedEdge("edge", from: .node("source"), to: .node("old-target")))
    }

    commit(&graph) { transaction in
      transaction.update(
        directedEdge("edge", from: .node("source"), to: .node("new-target"))
      )
      transaction.removeNode(id: "old-target", policy: .strict)
    }

    XCTAssertNil(graph.node(id: "old-target"))
    XCTAssertEqual(graph.incomingEdgeIDs(nodeID: "new-target"), ["edge"])
    XCTAssertNotNil(graph.edge(id: "edge"))
  }

  func testEdgeUpdateCanChangeOrientationAndExactEndpoints() {
    var graph = FlowingGraph<TestSchema>()
    commit(&graph) { transaction in
      transaction.insert(node("first"))
      transaction.insert(node("second"))
      transaction.insert(node("third"))
      transaction.insert(port("first", 1))
      transaction.insert(port("third", 1))
      transaction.insert(
        directedEdge("edge", from: .port(portKey("first", 1)), to: .node("second"))
      )
    }

    commit(&graph) { transaction in
      transaction.update(
        FlowingGraphEdge(
          id: "edge",
          endpoints: .undirected(.node("second"), .port(portKey("third", 1))),
          value: "edge"
        )
      )
    }

    XCTAssertTrue(graph.incidentEdgeIDs(nodeID: "first").isEmpty)
    XCTAssertTrue(graph.incidentEdgeIDs(endpoint: .port(portKey("first", 1))).isEmpty)
    XCTAssertEqual(graph.outgoingEdgeIDs(nodeID: "second"), ["edge"])
    XCTAssertEqual(graph.incomingEdgeIDs(nodeID: "third"), ["edge"])
    XCTAssertEqual(graph.incidentEdgeIDs(endpoint: .port(portKey("third", 1))), ["edge"])
  }

  func testUnknownReorderTargetRejectsAtomically() {
    var graph = FlowingGraph<TestSchema>()
    commit(&graph) { transaction in
      transaction.insert(node("first"))
      transaction.insert(node("second"))
    }
    let snapshotID = graph.snapshotID

    let result = graph.update { transaction in
      transaction.moveNode(id: "first", to: .after("missing"))
    }

    assertRejected(result, issue: .unknownElement(.node("missing")))
    XCTAssertEqual(graph.nodeIDs, ["first", "second"])
    XCTAssertEqual(graph.snapshotID, snapshotID)
  }

  func testChangeSetNormalizesInsertThenRemoveToNoElementChange() {
    var graph = FlowingGraph<TestSchema>()
    let snapshotID = graph.snapshotID

    let changeSet = commit(&graph) { transaction in
      transaction.insert(node("temporary"))
      transaction.removeNode(id: "temporary")
    }

    XCTAssertTrue(changeSet.isEmpty)
    XCTAssertTrue(graph.isEmpty)
    XCTAssertEqual(graph.snapshotID, snapshotID)
    XCTAssertEqual(graph.localRevision, 0)
  }

  func testInvertedChangeSetSwapsValuesOrdersAndSnapshots() throws {
    var graph = FlowingGraph<TestSchema>()
    let changeSet = commit(&graph) { transaction in
      transaction.insert(node("node"))
    }

    let inverted = changeSet.inverted()

    XCTAssertEqual(inverted.oldSnapshotID, changeSet.newSnapshotID)
    XCTAssertEqual(inverted.newSnapshotID, changeSet.oldSnapshotID)
    XCTAssertEqual(try XCTUnwrap(inverted.nodeChanges.first).oldValue, node("node"))
    XCTAssertNil(inverted.nodeChanges.first?.newValue)
    XCTAssertEqual(inverted.nodeOrderChanges.first?.id, "node")
    XCTAssertEqual(inverted.nodeOrderChanges.first?.oldPosition, .first)
    XCTAssertNil(inverted.nodeOrderChanges.first?.newPosition)
  }

  func testNoOpTransactionPreservesSnapshotIdentity() {
    var graph = FlowingGraph<TestSchema>()
    let snapshotID = graph.snapshotID

    let changeSet = commit(&graph) { _ in }

    XCTAssertTrue(changeSet.isEmpty)
    XCTAssertEqual(graph.snapshotID, snapshotID)
    XCTAssertEqual(graph.localRevision, 0)
  }

  func testForkedGraphsNeverShareSnapshotIdentityAfterIndependentCommits() {
    var first = FlowingGraph<TestSchema>()
    var second = first

    commit(&first) { transaction in
      transaction.insert(node("value"))
    }
    commit(&second) { transaction in
      transaction.insert(node("value"))
    }

    XCTAssertEqual(first.localRevision, second.localRevision)
    XCTAssertEqual(first.nodeIDs, second.nodeIDs)
    XCTAssertNotEqual(first.snapshotID, second.snapshotID)
  }

  private func connectedPortGraph() -> FlowingGraph<TestSchema> {
    var graph = FlowingGraph<TestSchema>()
    commit(&graph) { transaction in
      transaction.insert(node("hub"))
      transaction.insert(node("device"))
      transaction.insert(port("hub", 1))
      transaction.insert(directedEdge("connection", from: .port(portKey("hub", 1)), to: .node("device")))
    }
    return graph
  }

  @discardableResult
  private func commit(
    _ graph: inout FlowingGraph<TestSchema>,
    _ body: (inout FlowingGraphTransaction<TestSchema>) -> Void
  ) -> FlowingGraphChangeSet<TestSchema> {
    switch graph.update(body) {
    case let .committed(changeSet):
      return changeSet
    case let .rejected(issue):
      XCTFail("Unexpected rejection: \(issue)")
      fatalError("Unexpected rejection")
    }
  }

  private func assertRejected(
    _ result: FlowingGraphUpdateResult<TestSchema>,
    issue expectedIssue: FlowingGraphMutationIssue<TestSchema>
  ) {
    switch result {
    case .committed:
      XCTFail("Expected transaction rejection")
    case let .rejected(issue):
      XCTAssertEqual(issue, expectedIssue)
    }
  }

  private func node(_ id: String) -> FlowingGraphNode<TestSchema> {
    FlowingGraphNode(id: id, value: id)
  }

  private func port(_ nodeID: String, _ portID: Int) -> FlowingGraphPort<TestSchema> {
    FlowingGraphPort(key: portKey(nodeID, portID), value: "Port \(portID)")
  }

  private func portKey(_ nodeID: String, _ portID: Int) -> FlowingGraphPortKey<TestSchema> {
    FlowingGraphPortKey(nodeID: nodeID, portID: portID)
  }

  private func directedEdge(
    _ id: String,
    from source: FlowingGraphEndpoint<TestSchema>,
    to target: FlowingGraphEndpoint<TestSchema>
  ) -> FlowingGraphEdge<TestSchema> {
    FlowingGraphEdge(
      id: id,
      endpoints: .directed(source: source, target: target),
      value: id
    )
  }
}
