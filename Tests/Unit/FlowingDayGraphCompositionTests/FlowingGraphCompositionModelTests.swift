import FlowingDayGraphComposition
import FlowingDayGraphCore
import XCTest

final class FlowingGraphCompositionModelTests: XCTestCase {
  func testDocumentKeepsStableEntryPointOrder() {
    let document = FlowingGraphDocument<TestCompositionSchema>(
      id: "document",
      defaultEntryPointID: "primary",
      entryPoints: [
        FlowingGraphEntryPoint(id: "primary", name: "Primary", graphID: "root"),
        FlowingGraphEntryPoint(id: "secondary", name: "Secondary", graphID: "library"),
      ],
      definitions: [
        FlowingGraphDefinition(id: "root", graph: .init()),
        FlowingGraphDefinition(id: "library", graph: .init()),
      ],
      subgraphLinks: []
    )

    XCTAssertEqual(document.entryPoints.map(\.id), ["primary", "secondary"])
  }

  func testProjectionStateSupportsValueEqualityAndHashing() {
    let state = FlowingGraphProjectionState<TestCompositionSchema>(
      entryPointID: "main",
      expandedSites: [site(graphID: "root", nodeID: "child")]
    )

    XCTAssertEqual(Set([state, state]).count, 1)
  }

  func testCompositionIdentityCanCarryARuntimeOccurrence() {
    let address = FlowingGraphElementAddress<String, TestGraphSchema>(
      instancePath: .root,
      graphID: "root",
      elementID: .node("node")
    )
    let first = FlowingGraphCompositionElementID<RuntimeOccurrenceCompositionSchema>
      .source(address: address, occurrenceID: "first")
    let second = FlowingGraphCompositionElementID<RuntimeOccurrenceCompositionSchema>
      .source(address: address, occurrenceID: "second")
    let localFirst = FlowingGraphPresentationLocalElementID<
      RuntimeOccurrenceCompositionSchema
    >.source(
      instanceHandle: .init(rawValue: 0),
      elementID: .node("node"),
      occurrenceID: "first"
    )
    let localSecond = FlowingGraphPresentationLocalElementID<
      RuntimeOccurrenceCompositionSchema
    >.source(
      instanceHandle: .init(rawValue: 0),
      elementID: .node("node"),
      occurrenceID: "second"
    )

    XCTAssertNotEqual(first, second)
    XCTAssertNotEqual(localFirst, localSecond)
  }
}
