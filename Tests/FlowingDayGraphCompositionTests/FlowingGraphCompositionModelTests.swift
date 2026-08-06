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
}
