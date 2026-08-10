import SwiftUI
import XCTest

@testable import FlowingDayPreferences

final class FlowingControlsTests: XCTestCase {
  func testDisclosureMotionRespectsReduceMotion() {
    XCTAssertEqual(FlowingDisclosureMotion.duration(reduceMotion: false), 0.18)
    XCTAssertEqual(FlowingDisclosureMotion.duration(reduceMotion: true), 0.12)
    XCTAssertEqual(FlowingDisclosureMotion.offset(reduceMotion: false), -5)
    XCTAssertEqual(FlowingDisclosureMotion.offset(reduceMotion: true), 0)
  }

  @MainActor
  func testDisclosureContentOnlyOccupiesSpaceWhenExpanded() {
    let collapsed = fittingHeight(
      FlowingDisclosureContent(isExpanded: false) {
        Text("Details").frame(height: 24)
      }
    )
    let expanded = fittingHeight(
      FlowingDisclosureContent(isExpanded: true) {
        Text("Details").frame(height: 24)
      }
    )

    XCTAssertEqual(collapsed, 0)
    XCTAssertEqual(expanded, 24)
  }

  @MainActor
  func testDisclosureComposesOutsidePreferencesRows() {
    let collapsed = fittingHeight(
      FlowingDisclosure("Details", isExpanded: .constant(false)) {
        Text("Expanded content").frame(height: 30)
      }
      .frame(width: 240)
    )
    let expanded = fittingHeight(
      FlowingDisclosure("Details", isExpanded: .constant(true)) {
        Text("Expanded content").frame(height: 30)
      }
      .frame(width: 240)
    )

    XCTAssertGreaterThan(expanded, collapsed)
  }

  func testSelectOptionCanCarryItsOwnAccent() {
    let option = FlowingSelectOption(
      "petal",
      label: "Petal",
      accent: PreferencesAccent.petal
    )

    XCTAssertEqual(option.id, "petal")
    XCTAssertEqual(option.accent, .petal)
  }

  func testOptionSearchIgnoresCaseAndSurroundingWhitespace() {
    XCTAssertTrue(FlowingOptionSearch.matches("Asia/Tokyo", query: "  TOKYO "))
    XCTAssertTrue(FlowingOptionSearch.matches("Europe/London", query: ""))
    XCTAssertFalse(FlowingOptionSearch.matches("Europe/London", query: "Tokyo"))
  }

  @MainActor
  func testSelectAndSearchPickerComposeOutsidePreferencesRows() {
    let options = [
      FlowingSelectOption("one", label: "One"),
      FlowingSelectOption("two", label: "Two"),
      FlowingSelectOption("three", label: "Three"),
    ]
    let content = VStack {
      FlowingSelect(
        label: "Value",
        selection: .constant("two"),
        options: options
      )
      .fixedSize()
      FlowingSearchPicker(
        label: "Value",
        selection: .constant("two"),
        options: options,
        maximumVisibleOptions: 2
      )
    }
    .frame(width: 240)

    XCTAssertGreaterThan(fittingHeight(content), 100)
  }

  @MainActor
  func testSearchFocusDismissesOnlyForClicksOutsideItsBoundary() throws {
    final class FocusState {
      var isFocused = true
    }

    let focusState = FocusState()
    let window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 240, height: 120),
      styleMask: .borderless,
      backing: .buffered,
      defer: false
    )
    let contentView = try XCTUnwrap(window.contentView)
    let boundary = FlowingFocusDismissalBoundary.BoundaryView(
      frame: NSRect(x: 20, y: 20, width: 180, height: 30)
    )
    let coordinator = FlowingFocusDismissalBoundary.Coordinator(
      isFocused: Binding(
        get: { focusState.isFocused },
        set: { focusState.isFocused = $0 }
      )
    )
    boundary.coordinator = coordinator
    contentView.addSubview(boundary)
    coordinator.attach(to: boundary)
    defer { coordinator.detach() }

    let insideEvent = try XCTUnwrap(
      mouseDownEvent(in: window, location: NSPoint(x: 30, y: 30))
    )
    let outsideEvent = try XCTUnwrap(
      mouseDownEvent(in: window, location: NSPoint(x: 10, y: 10))
    )

    XCTAssertFalse(coordinator.shouldDismiss(for: insideEvent))
    XCTAssertTrue(coordinator.shouldDismiss(for: outsideEvent))
    focusState.isFocused = false
    XCTAssertFalse(coordinator.shouldDismiss(for: outsideEvent))
  }

  func testSliderMathClampsValuesAndFractions() {
    let range = 10.0...20.0

    XCTAssertEqual(FlowingSliderMath.fraction(of: 5, in: range), 0)
    XCTAssertEqual(FlowingSliderMath.fraction(of: 15, in: range), 0.5)
    XCTAssertEqual(FlowingSliderMath.fraction(of: 25, in: range), 1)
    XCTAssertEqual(FlowingSliderMath.value(atFraction: -1, in: range), 10)
    XCTAssertEqual(FlowingSliderMath.value(atFraction: 0.25, in: range), 12.5)
    XCTAssertEqual(FlowingSliderMath.value(atFraction: 2, in: range), 20)
  }

  @MainActor
  func testSwitchAndSliderComposeOutsidePreferencesRows() {
    let content = VStack {
      FlowingSwitch("Updates", isOn: .constant(true))
      FlowingSlider(value: .constant(0.5), in: 0...1)
    }
    .frame(width: 240)

    XCTAssertGreaterThan(fittingHeight(content), 30)
  }

  func testConnectedSegmentedControlUsesAHairlineSelectionBorder() {
    XCTAssertEqual(FlowingConnectedSegmentedControlMetrics.selectedBorderWidth, 1)
  }

  func testSegmentOptionUsesItsValueAsStableIdentity() {
    let option = FlowingSegmentOption(
      "medium",
      label: "Medium",
      systemImage: "circle"
    )

    XCTAssertEqual(option.id, "medium")
    XCTAssertEqual(option.value, "medium")
    XCTAssertEqual(option.label, "Medium")
    XCTAssertEqual(option.systemImage, "circle")
  }

  @MainActor
  func testTextAndSymbolSegmentedControlsComposeOutsidePreferencesRows() {
    let text = FlowingSegmentedControl(
      label: "Size",
      selection: .constant("medium"),
      options: [
        FlowingSegmentOption("small", label: "Small"),
        FlowingSegmentOption("medium", label: "Medium"),
      ]
    )
    let symbols = FlowingSegmentedControl(
      label: "Mode",
      selection: .constant("list"),
      options: [
        FlowingSegmentOption("list", label: "List", systemImage: "list.bullet"),
        FlowingSegmentOption("grid", label: "Grid", systemImage: "square.grid.2x2"),
      ]
    )

    XCTAssertGreaterThan(fittingHeight(text.frame(width: 220)), 20)
    XCTAssertGreaterThan(fittingHeight(symbols.frame(width: 220)), 20)
  }

  func testSegmentNavigationWrapsInBothDirections() {
    let values = ["first", "second", "third"]

    XCTAssertEqual(
      FlowingSegmentedControlNavigation.destination(
        in: values,
        from: "third",
        offset: 1
      ),
      "first"
    )
    XCTAssertEqual(
      FlowingSegmentedControlNavigation.destination(
        in: values,
        from: "first",
        offset: -1
      ),
      "third"
    )
  }

  func testSegmentNavigationStartsAtBoundaryForUnknownSelection() {
    XCTAssertEqual(
      FlowingSegmentedControlNavigation.destination(
        in: ["first", "second", "third"],
        from: "unknown",
        offset: 1
      ),
      "first"
    )
    XCTAssertEqual(
      FlowingSegmentedControlNavigation.destination(
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

@MainActor
private func mouseDownEvent(in window: NSWindow, location: NSPoint) -> NSEvent? {
  NSEvent.mouseEvent(
    with: .leftMouseDown,
    location: location,
    modifierFlags: [],
    timestamp: 0,
    windowNumber: window.windowNumber,
    context: nil,
    eventNumber: 0,
    clickCount: 1,
    pressure: 1
  )
}

private struct TestItem: Identifiable {
  let id: String

  init(_ id: String) {
    self.id = id
  }
}
