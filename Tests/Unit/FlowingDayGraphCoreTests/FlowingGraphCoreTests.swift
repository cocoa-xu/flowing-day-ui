import FlowingDayGraphCore
import XCTest

final class FlowingGraphCoreTests: XCTestCase {
  private enum TestSchema: FlowingGraphSchema {
    typealias NodeID = String
    typealias NodeValue = String
    typealias PortID = Int
    typealias PortValue = String
    typealias EdgeID = String
    typealias EdgeValue = String
  }

  func testSchemaKeepsTheGraphSurfaceToOneGenericParameter() {
    let graph = FlowingGraph<TestSchema>()

    XCTAssertTrue(graph.isEmpty)
  }

  func testElementCountsDoNotRequireMaterializingOrderedSnapshots() {
    var graph = FlowingGraph<TestSchema>()
    _ = graph.update { transaction in
      transaction.insert(FlowingGraphNode(id: "source", value: ""))
      transaction.insert(FlowingGraphNode(id: "target", value: ""))
      transaction.insert(
        FlowingGraphPort(
          key: FlowingGraphPortKey(nodeID: "source", portID: 1),
          value: ""
        )
      )
      transaction.insert(
        FlowingGraphEdge(
          id: "edge",
          endpoints: .directed(source: .node("source"), target: .node("target")),
          value: ""
        )
      )
    }

    XCTAssertEqual(graph.nodeCount, 2)
    XCTAssertEqual(graph.portCount, 1)
    XCTAssertEqual(graph.edgeCount, 1)
  }

  func testNodeAndPortEndpointsRemainDistinct() {
    let node = FlowingGraphEndpoint<TestSchema>.node("hub")
    let port = FlowingGraphEndpoint<TestSchema>.port(
      FlowingGraphPortKey(nodeID: "hub", portID: 1)
    )

    XCTAssertNotEqual(node, port)
  }

  func testUndirectedEndpointEqualityIgnoresRepresentativeOrder() {
    let first = FlowingGraphEndpoint<TestSchema>.node("first")
    let second = FlowingGraphEndpoint<TestSchema>.node("second")

    XCTAssertEqual(
      FlowingGraphEdgeEndpoints<TestSchema>.undirected(first, second),
      FlowingGraphEdgeEndpoints<TestSchema>.undirected(second, first)
    )
  }

  func testDirectedEndpointEqualityPreservesDirection() {
    let first = FlowingGraphEndpoint<TestSchema>.node("first")
    let second = FlowingGraphEndpoint<TestSchema>.node("second")

    XCTAssertNotEqual(
      FlowingGraphEdgeEndpoints<TestSchema>.directed(source: first, target: second),
      FlowingGraphEdgeEndpoints<TestSchema>.directed(source: second, target: first)
    )
  }

  func testOrderPositionUsesStableElementIdentity() {
    let position = FlowingGraphOrderPosition<String>.after("node-a")

    XCTAssertEqual(position, .after("node-a"))
  }

  func testElementAddressIncludesDefinitionAndInstancePath() {
    let path = FlowingGraphInstancePath(
      components: [
        FlowingGraphDefinitionNodeAddress(
          graphID: "root",
          nodeID: "composite"
        )
      ]
    )
    let first = FlowingGraphElementAddress<String, TestSchema>(
      instancePath: path,
      graphID: "definition-a",
      elementID: .node("value")
    )
    let second = FlowingGraphElementAddress<String, TestSchema>(
      instancePath: path,
      graphID: "definition-b",
      elementID: .node("value")
    )

    XCTAssertNotEqual(first, second)
  }

  func testPresentationIdentityDistinguishesRuntimeOccurrences() {
    let address = FlowingGraphElementAddress<String, TestSchema>(
      instancePath: .root,
      graphID: "root",
      elementID: .node("value")
    )
    let first = FlowingPresentationElementID<String, TestSchema, String, String>.source(
      address: address,
      occurrenceID: "first"
    )
    let second = FlowingPresentationElementID<String, TestSchema, String, String>.source(
      address: address,
      occurrenceID: "second"
    )

    XCTAssertNotEqual(first, second)
  }

  func testSyntheticPresentationIdentityPreservesRoleAndSourceOrder() {
    typealias PresentationID = FlowingPresentationElementID<
      String,
      TestSchema,
      String,
      String
    >
    let firstAddress = FlowingGraphElementAddress<String, TestSchema>(
      instancePath: .root,
      graphID: "root",
      elementID: .node("first")
    )
    let secondAddress = FlowingGraphElementAddress<String, TestSchema>(
      instancePath: .root,
      graphID: "root",
      elementID: .node("second")
    )
    let boundary = PresentationID.synthetic(
      role: "boundary",
      sourceAddresses: [firstAddress, secondAddress],
      occurrenceID: nil
    )
    let proxy = PresentationID.synthetic(
      role: "proxy",
      sourceAddresses: [firstAddress, secondAddress],
      occurrenceID: nil
    )
    let reversed = PresentationID.synthetic(
      role: "boundary",
      sourceAddresses: [secondAddress, firstAddress],
      occurrenceID: nil
    )

    XCTAssertNotEqual(boundary, proxy)
    XCTAssertNotEqual(boundary, reversed)
    XCTAssertNotEqual(
      boundary,
      PresentationID.source(address: firstAddress, occurrenceID: nil)
    )
  }

  func testCoreValuesAreConditionallySendable() {
    requireSendable(FlowingGraph<TestSchema>())
    requireSendable(
      FlowingGraphEndpoint<TestSchema>.port(
        FlowingGraphPortKey(nodeID: "hub", portID: 1)
      )
    )
    requireSendable(
      FlowingPresentationElementID<String, TestSchema, String, String>.source(
        address: FlowingGraphElementAddress(
          instancePath: .root,
          graphID: "root",
          elementID: .node("value")
        ),
        occurrenceID: nil
      )
    )
  }

  private func requireSendable<Value: Sendable>(_: Value) {}
}
