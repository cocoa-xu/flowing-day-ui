import FlowingDayGraphCanvas
import XCTest

final class FlowingGraphCanvasKeyboardNavigationTests: XCTestCase {
  func testNavigatorChoosesTheNearestCandidateInTheRequestedDirection() {
    let current = candidate("current", x: 100, y: 100, order: 0)
    let candidates = [
      current,
      candidate("near-right", x: 180, y: 110, order: 1),
      candidate("far-right", x: 300, y: 100, order: 2),
      candidate("left", x: 20, y: 100, order: 3),
    ]

    XCTAssertEqual(
      FlowingGraphCanvasKeyboardNavigator.nextNodeID(
        from: current,
        direction: .right,
        candidates: candidates
      ),
      "near-right"
    )
  }

  func testNavigatorUsesOrthogonalDistanceThenPresentationOrderForTies() {
    let current = candidate("current", x: 100, y: 100, order: 0)
    let candidates = [
      current,
      candidate("diagonal", x: 130, y: 140, order: 1),
      candidate("straight", x: 150, y: 100, order: 2),
    ]

    XCTAssertEqual(
      FlowingGraphCanvasKeyboardNavigator.nextNodeID(
        from: current,
        direction: .right,
        candidates: candidates
      ),
      "straight"
    )

    let first = candidate("first", x: 180, y: 100, order: 1)
    let second = candidate("second", x: 180, y: 100, order: 2)
    XCTAssertEqual(
      FlowingGraphCanvasKeyboardNavigator.nextNodeID(
        from: current,
        direction: .right,
        candidates: [second, first]
      ),
      "first"
    )
  }

  func testNavigatorReturnsNilAtTheDirectionalBoundary() {
    let current = candidate("current", x: 100, y: 100, order: 0)

    XCTAssertNil(
      FlowingGraphCanvasKeyboardNavigator.nextNodeID(
        from: current,
        direction: .up,
        candidates: [
          current,
          candidate("right", x: 180, y: 100, order: 1),
          candidate("down", x: 100, y: 180, order: 2),
        ]
      )
    )
  }

  func testNavigatorHandlesTenThousandCandidatesWithoutViewMaterialization() {
    let candidates = (0...10_000).map { index in
      candidate(
        "node-\(index)",
        x: CGFloat(index * 60),
        y: CGFloat((index % 3) * 40),
        order: index
      )
    }

    XCTAssertEqual(
      FlowingGraphCanvasKeyboardNavigator.nextNodeID(
        from: candidates[0],
        direction: .right,
        candidates: candidates
      ),
      "node-1"
    )
  }

  func testInteractionDefaultsAreExplicitAndCanBeDisabled() {
    XCTAssertTrue(FlowingGraphCanvasKeyboardNavigationConfiguration.standard.isEnabled)
    XCTAssertEqual(
      FlowingGraphCanvasKeyboardNavigationConfiguration.standard.selectionBehavior,
      .replace
    )
    XCTAssertTrue(
      FlowingGraphCanvasKeyboardNavigationConfiguration.standard.keepsFocusedNodeVisible
    )
    XCTAssertFalse(FlowingGraphCanvasKeyboardNavigationConfiguration.disabled.isEnabled)

    XCTAssertTrue(FlowingGraphCanvasAccessibilityConfiguration.standard.isEnabled)
    XCTAssertTrue(
      FlowingGraphCanvasAccessibilityConfiguration.standard.providesSelectionAction
    )
    XCTAssertFalse(FlowingGraphCanvasAccessibilityConfiguration.disabled.isEnabled)

    XCTAssertTrue(FlowingGraphCanvasNodeResizingConfiguration.standard.isEnabled)
    XCTAssertEqual(
      FlowingGraphCanvasNodeResizingConfiguration.standard.minimumSize,
      CGSize(width: 44, height: 32)
    )
    XCTAssertFalse(FlowingGraphCanvasNodeResizingConfiguration.disabled.isEnabled)
    XCTAssertTrue(FlowingGraphCanvasNodeCapabilities.standard.contains(.resizable))

    XCTAssertTrue(FlowingGraphCanvasKeyboardNudgingConfiguration.standard.isEnabled)
    XCTAssertEqual(FlowingGraphCanvasKeyboardNudgingConfiguration.standard.step, 1)
    XCTAssertEqual(FlowingGraphCanvasKeyboardNudgingConfiguration.standard.largeStep, 10)
    XCTAssertFalse(FlowingGraphCanvasKeyboardNudgingConfiguration.disabled.isEnabled)
  }

  func testKeyboardNudgerUsesStandardAndLargeIncrements() {
    let configuration = FlowingGraphCanvasKeyboardNudgingConfiguration(
      step: 2,
      largeStep: 16
    )

    XCTAssertEqual(
      FlowingGraphCanvasKeyboardNudger.translation(
        direction: .left,
        configuration: configuration
      ),
      CGSize(width: -2, height: 0)
    )
    XCTAssertEqual(
      FlowingGraphCanvasKeyboardNudger.translation(
        direction: .down,
        configuration: configuration,
        modifiers: [.largeKeyboardNudge]
      ),
      CGSize(width: 0, height: 16)
    )
    XCTAssertNil(
      FlowingGraphCanvasKeyboardNudger.translation(
        direction: .right,
        configuration: .disabled
      )
    )
  }

  private func candidate(
    _ id: String,
    x: CGFloat,
    y: CGFloat,
    order: Int
  ) -> FlowingGraphCanvasNavigationCandidate<String> {
    FlowingGraphCanvasNavigationCandidate(
      id: id,
      frame: CGRect(x: x, y: y, width: 40, height: 30),
      presentationOrder: order
    )
  }
}
