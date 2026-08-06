import XCTest

@testable import FlowingDayGraphCanvasExample

@MainActor
final class FlowingDayGraphCanvasExampleTests: XCTestCase {
  func testExampleBuildsEveryLayoutAndPresentation() {
    let model = GraphCanvasShowcaseModel()

    for layout in ShowcaseLayoutStyle.allCases {
      model.selectLayout(layout)
      XCTAssertNotNil(model.content)
      XCTAssertNil(model.errorMessage)
    }

    for presentation in ShowcasePresentationStyle.allCases {
      model.selectPresentation(presentation)
      XCTAssertEqual(model.presentationStyle, presentation)
      XCTAssertNotNil(model.content)
      XCTAssertNil(model.errorMessage)
    }
  }

  func testInterfaceEditorEmitsAndAppliesSemanticChanges() {
    let model = GraphCanvasShowcaseModel()
    XCTAssertEqual(model.bindingRows.compactMap(\.internalEndpoint).count, 2)

    model.toggleBinding("output")
    XCTAssertEqual(model.bindingRows.compactMap(\.internalEndpoint).count, 1)
    XCTAssertEqual(model.lastEvent, "Applied document editing intent")

    model.toggleBinding("output")
    XCTAssertEqual(model.bindingRows.compactMap(\.internalEndpoint).count, 2)
  }
}
