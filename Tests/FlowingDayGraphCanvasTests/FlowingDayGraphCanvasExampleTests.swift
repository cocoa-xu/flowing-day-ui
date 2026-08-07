import FlowingDayGraphCanvas
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

  func testExampleAppliesResizeIntentWithoutLosingTheRequestedFrame() throws {
    let model = GraphCanvasShowcaseModel()
    let presentation = try XCTUnwrap(model.presentation)
    let content = try XCTUnwrap(model.content)
    let node = try XCTUnwrap(presentation.nodes.first)
    let frame = try XCTUnwrap(content.frame(for: node.localID))
    let requestedFrame = CGRect(
      origin: CGPoint(x: frame.minX + 12, y: frame.minY + 8),
      size: CGSize(width: frame.width + 48, height: frame.height + 24)
    )

    model.send(
      .nodeResizeCompleted(
        FlowingGraphCanvasNodeResizeIntent(
          anchorNodeID: node.id,
          changes: [
            FlowingGraphCanvasNodeResizeChange(
              nodeID: node.id,
              originTranslation: CGSize(width: 12, height: 8),
              sizeDelta: CGSize(width: 48, height: 24)
            )
          ],
          edges: [.trailing, .bottom],
          basePresentationSnapshotID: presentation.snapshotID,
          baseLayoutInputID: content.id
        )
      )
    )

    let updatedContent = try XCTUnwrap(model.content)
    let updatedFrame = try XCTUnwrap(updatedContent.frame(for: node.localID))
    XCTAssertEqual(updatedFrame, requestedFrame)
    XCTAssertEqual(model.lastEvent, "Applied node resize intent")
  }

  func testExampleAppliesGroupResizeAsOnePinnedIntent() throws {
    let model = GraphCanvasShowcaseModel()
    let presentation = try XCTUnwrap(model.presentation)
    let content = try XCTUnwrap(model.content)
    let nodes = Array(presentation.nodes.prefix(2))
    XCTAssertEqual(nodes.count, 2)
    let changes = [
      FlowingGraphCanvasNodeResizeChange<ShowcaseCanvasSchema>(
        nodeID: nodes[0].id,
        originTranslation: CGSize(width: 12, height: 8),
        sizeDelta: CGSize(width: 48, height: 24)
      ),
      FlowingGraphCanvasNodeResizeChange<ShowcaseCanvasSchema>(
        nodeID: nodes[1].id,
        originTranslation: CGSize(width: -10, height: 5),
        sizeDelta: CGSize(width: 24, height: 12)
      ),
    ]
    let requestedFrames = try Dictionary(
      uniqueKeysWithValues: zip(nodes, changes).map { node, change in
        let frame = try XCTUnwrap(content.frame(for: node.localID))
        return (
          node.id,
          CGRect(
            x: frame.minX + change.originTranslation.width,
            y: frame.minY + change.originTranslation.height,
            width: frame.width + change.sizeDelta.width,
            height: frame.height + change.sizeDelta.height
          )
        )
      }
    )

    model.send(
      .nodeResizeCompleted(
        FlowingGraphCanvasNodeResizeIntent(
          anchorNodeID: nodes[0].id,
          changes: changes,
          edges: [.trailing, .bottom],
          basePresentationSnapshotID: presentation.snapshotID,
          baseLayoutInputID: content.id
        )
      )
    )

    let updatedContent = try XCTUnwrap(model.content)
    for node in nodes {
      XCTAssertEqual(updatedContent.frame(for: node.localID), requestedFrames[node.id])
    }
  }
}
