import XCTest
import FlowingDayGraphCore

final class FlowingGraphAPIDesignTests: XCTestCase {
  func testSchemaTypeKeepsConsumerSignaturesReadable() {
    let graph = acceptsSchemaGraph(FlowingGraph<ConsumerSchema>())

    XCTAssertTrue(graph.isEmpty)
  }

  func testDirectGenericPrototypeExposesEveryTypeAtEachUseSite() {
    let graph = DirectGraphPrototype<String, String, Int, String, String, String>()

    XCTAssertTrue(graph.storage.isEmpty)
  }

  func testPortlessPrototypeStillRequiresASeparateSurface() {
    let graph = PortlessGraphPrototype<String, String, String, String>()

    XCTAssertTrue(graph.storage.isEmpty)
  }

  func testStableIDReorderAvoidsSubmittingTheCompleteOrder() {
    let stableIDMutation = StableIDReorderPrototype(
      id: "moved",
      position: FlowingGraphOrderPosition.before("target")
    )
    let completeOrderMutation = CompleteOrderReorderPrototype(
      orderedIDs: ["first", "moved", "target", "last"]
    )

    XCTAssertEqual(stableIDMutation.id, "moved")
    XCTAssertEqual(stableIDMutation.position, .before("target"))
    XCTAssertEqual(completeOrderMutation.orderedIDs.count, 4)
  }

  private func acceptsSchemaGraph(
    _ graph: FlowingGraph<ConsumerSchema>
  ) -> FlowingGraph<ConsumerSchema> {
    graph
  }
}

private enum ConsumerSchema: FlowingGraphSchema {
  typealias NodeID = String
  typealias NodeValue = String
  typealias PortID = Int
  typealias PortValue = String
  typealias EdgeID = String
  typealias EdgeValue = String
}

private struct DirectGraphSchema<
  NodeID: Hashable,
  NodeValue,
  PortID: Hashable,
  PortValue,
  EdgeID: Hashable,
  EdgeValue
>: FlowingGraphSchema {}

private struct DirectGraphPrototype<
  NodeID: Hashable,
  NodeValue,
  PortID: Hashable,
  PortValue,
  EdgeID: Hashable,
  EdgeValue
> {
  typealias Schema = DirectGraphSchema<
    NodeID,
    NodeValue,
    PortID,
    PortValue,
    EdgeID,
    EdgeValue
  >

  var storage = FlowingGraph<Schema>()
}

private struct PortlessGraphSchema<
  NodeID: Hashable,
  NodeValue,
  EdgeID: Hashable,
  EdgeValue
>: FlowingGraphSchema {
  typealias PortID = Never
  typealias PortValue = Never
}

private struct PortlessGraphPrototype<
  NodeID: Hashable,
  NodeValue,
  EdgeID: Hashable,
  EdgeValue
> {
  typealias Schema = PortlessGraphSchema<NodeID, NodeValue, EdgeID, EdgeValue>

  var storage = FlowingGraph<Schema>()
}

private struct StableIDReorderPrototype<ID: Hashable> {
  let id: ID
  let position: FlowingGraphOrderPosition<ID>
}

private struct CompleteOrderReorderPrototype<ID: Hashable> {
  let orderedIDs: [ID]
}
