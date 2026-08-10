import SwiftUI
import XCTest

@testable import FlowingDayPreferences

final class FlowingControlsTests: XCTestCase {
  func testConnectedSegmentedControlUsesAHairlineSelectionBorder() {
    XCTAssertEqual(FlowingConnectedSegmentedControlMetrics.selectedBorderWidth, 1)
  }

  func testSegmentOptionUsesItsValueAsStableIdentity() {
    let option = FlowingSegmentOption("medium", label: "Medium")

    XCTAssertEqual(option.id, "medium")
    XCTAssertEqual(option.value, "medium")
    XCTAssertEqual(option.label, "Medium")
  }

  func testConnectedSegmentNavigationWrapsInBothDirections() {
    let values = ["first", "second", "third"]

    XCTAssertEqual(
      FlowingConnectedSegmentedControlNavigation.destination(
        in: values,
        from: "third",
        offset: 1
      ),
      "first"
    )
    XCTAssertEqual(
      FlowingConnectedSegmentedControlNavigation.destination(
        in: values,
        from: "first",
        offset: -1
      ),
      "third"
    )
  }

  func testConnectedSegmentNavigationStartsAtBoundaryForUnknownSelection() {
    XCTAssertEqual(
      FlowingConnectedSegmentedControlNavigation.destination(
        in: ["first", "second", "third"],
        from: "unknown",
        offset: 1
      ),
      "first"
    )
    XCTAssertEqual(
      FlowingConnectedSegmentedControlNavigation.destination(
        in: ["first", "second", "third"],
        from: "unknown",
        offset: -1
      ),
      "third"
    )
  }

  @MainActor
  func testConnectedSegmentedControlFitsWithoutPreferencesRow() {
    let height = fittingHeight(
      FlowingConnectedSegmentedControl(
        label: "Size",
        selection: .constant("medium"),
        options: [
          FlowingSegmentOption("small", label: "Small"),
          FlowingSegmentOption("medium", label: "Medium"),
          FlowingSegmentOption("large", label: "Large"),
        ]
      )
      .frame(width: 240)
    )

    XCTAssertGreaterThan(height, 20)
    XCTAssertLessThan(height, 40)
  }

  @MainActor
  func testWrappingGridMovesOverflowingItemsToTheNextLine() {
    let height = fittingHeight(
      FlowingWrappingGrid(items: testItems, spacing: 7) { item in
        Text(item.id)
          .frame(width: 80, height: 20)
      }
      .frame(width: 170)
    )

    XCTAssertEqual(height, 47, accuracy: 0.5)
  }

  @MainActor
  func testExtractedPillsGridAndButtonStyleComposeOutsidePreferencesRows() {
    let content = VStack {
      FlowingTag("Static")
      FlowingSelectableTag("Selected", isSelected: true) {}
      FlowingAdaptiveGrid(items: testItems, minimumWidth: 80) { item in
        FlowingChip(item.id) {}
      }
      Button("Continue") {}
        .buttonStyle(FlowingSoftButtonStyle(isProminent: true))
    }

    XCTAssertGreaterThan(fittingHeight(content.frame(width: 260)), 80)
  }

  private var testItems: [TestItem] {
    [TestItem("One"), TestItem("Two"), TestItem("Three")]
  }

  @MainActor
  private func fittingHeight<Content: View>(_ content: Content) -> CGFloat {
    let hostingView = NSHostingView(rootView: content)
    hostingView.layoutSubtreeIfNeeded()
    return hostingView.fittingSize.height
  }
}

private struct TestItem: Identifiable {
  let id: String

  init(_ id: String) {
    self.id = id
  }
}
