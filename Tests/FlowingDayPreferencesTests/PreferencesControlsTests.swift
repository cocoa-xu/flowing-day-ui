import SwiftUI
import XCTest

@testable import FlowingDayPreferences

final class PreferencesControlsTests: XCTestCase {
  func testDefaultThemeMatchesPreferencesVisualHierarchy() {
    let typography = PreferencesTypography.standard
    let surfaces = PreferencesSurfaces.standard

    XCTAssertEqual(typography.pageTitle.size, 25)
    XCTAssertEqual(typography.pageTitle.weight, .semibold)
    XCTAssertEqual(typography.pageTitle.design, .rounded)
    XCTAssertEqual(typography.contentTitle.size, 21)
    XCTAssertEqual(typography.body.size, 12)
    XCTAssertEqual(typography.rowTitle.size, 13)
    XCTAssertEqual(typography.sectionHeader.size, 10.5)
    XCTAssertEqual(surfaces.sidebar, PreferencesPalette.card)
    XCTAssertEqual(surfaces.card, PreferencesPalette.control)
  }

  func testThemeCanBeCustomizedPerApplication() {
    let typography = PreferencesTypography(
      rowTitle: PreferencesTextStyle(
        size: 15,
        weight: .medium,
        fontName: "Helvetica Neue"
      )
    )
    let surfaces = PreferencesSurfaces(card: .orange, field: .purple)

    XCTAssertEqual(typography.rowTitle.size, 15)
    XCTAssertEqual(typography.rowTitle.weight, .medium)
    XCTAssertEqual(typography.rowTitle.fontName, "Helvetica Neue")
    XCTAssertEqual(surfaces.card, .orange)
    XCTAssertEqual(surfaces.field, .purple)
  }

  func testSliderMathClampsFractions() {
    let range = 10.0...20.0

    XCTAssertEqual(PreferencesSliderMath.fraction(of: 5, in: range), 0)
    XCTAssertEqual(PreferencesSliderMath.fraction(of: 15, in: range), 0.5)
    XCTAssertEqual(PreferencesSliderMath.fraction(of: 25, in: range), 1)
    XCTAssertEqual(PreferencesSliderMath.value(atFraction: -1, in: range), 10)
    XCTAssertEqual(PreferencesSliderMath.value(atFraction: 0.25, in: range), 12.5)
    XCTAssertEqual(PreferencesSliderMath.value(atFraction: 2, in: range), 20)
  }

  func testSelectionIndicatorsDistinguishSingleAndMultipleChoice() {
    XCTAssertNil(PreferencesSelectionStyle.single.symbol(isSelected: true))
    XCTAssertNil(PreferencesSelectionStyle.single.symbol(isSelected: false))
    XCTAssertEqual(
      PreferencesSelectionStyle.multiple.symbol(isSelected: true),
      "checkmark.circle.fill"
    )
    XCTAssertEqual(
      PreferencesSelectionStyle.multiple.symbol(isSelected: false),
      "circle"
    )
  }

  func testConnectedSegmentNavigationWrapsInBothDirections() {
    let values = ["first", "second", "third"]

    XCTAssertEqual(
      PreferencesConnectedSegmentedControlNavigation.destination(
        in: values,
        from: "third",
        offset: 1
      ),
      "first"
    )
    XCTAssertEqual(
      PreferencesConnectedSegmentedControlNavigation.destination(
        in: values,
        from: "first",
        offset: -1
      ),
      "third"
    )
  }

  func testConnectedSegmentNavigationStartsAtTheNearestBoundaryForAnUnknownSelection() {
    XCTAssertEqual(
      PreferencesConnectedSegmentedControlNavigation.destination(
        in: ["first", "second", "third"],
        from: "unknown",
        offset: 1
      ),
      "first"
    )
    XCTAssertEqual(
      PreferencesConnectedSegmentedControlNavigation.destination(
        in: ["first", "second", "third"],
        from: "unknown",
        offset: -1
      ),
      "third"
    )
  }

  @MainActor
  func testConnectedSegmentedRowUsesCompactRowHeight() {
    let height = fittingHeight(
      PreferencesConnectedSegmentedRow(
        title: "Layout",
        selection: .constant("first"),
        options: [
          PreferencesPopupOption("first", label: "First"),
          PreferencesPopupOption("second", label: "Second"),
        ]
      )
    )

    XCTAssertEqual(height, PreferencesRowLayout.minimumHeight)
  }

  @MainActor
  func testMultiSelectOptionTogglesItsBinding() {
    let state = BooleanState(false)
    let option = PreferencesMultiSelectOption(
      "Activity",
      isOn: Binding(
        get: { state.value },
        set: { state.value = $0 }
      )
    )

    XCTAssertEqual(option.id, "Activity")
    XCTAssertFalse(option.isSelected)

    option.toggle()

    XCTAssertTrue(option.isSelected)
    XCTAssertTrue(state.value)
  }

  @MainActor
  func testDisabledMultiSelectOptionDoesNotToggle() {
    let state = BooleanState(true)
    let option = PreferencesMultiSelectOption(
      "Chart",
      id: "network-chart",
      isOn: Binding(
        get: { state.value },
        set: { state.value = $0 }
      ),
      isEnabled: false
    )

    option.toggle()

    XCTAssertEqual(option.id, "network-chart")
    XCTAssertTrue(option.isSelected)
    XCTAssertTrue(state.value)
  }

  func testOptionSearchIgnoresCaseAndSurroundingWhitespace() {
    XCTAssertTrue(PreferencesOptionSearch.matches("Asia/Tokyo", query: "  TOKYO "))
    XCTAssertTrue(PreferencesOptionSearch.matches("Europe/London", query: ""))
    XCTAssertFalse(PreferencesOptionSearch.matches("Europe/London", query: "Tokyo"))
  }

  func testDependentRowsMotionRespectsReduceMotion() {
    XCTAssertEqual(
      PreferencesDependentRowsMotion.duration(reduceMotion: false),
      0.18
    )
    XCTAssertEqual(
      PreferencesDependentRowsMotion.duration(reduceMotion: true),
      0.12
    )
    XCTAssertEqual(PreferencesDependentRowsMotion.offset(reduceMotion: false), -5)
    XCTAssertEqual(PreferencesDependentRowsMotion.offset(reduceMotion: true), 0)
  }

  @MainActor
  func testSelectionButtonTogglesItsBinding() {
    let state = BooleanState(false)
    let button = PreferencesIconSelectionButton(
      symbol: "network",
      title: "Network",
      tint: .blue,
      isSelected: Binding(
        get: { state.value },
        set: { state.value = $0 }
      )
    )

    button.toggle()

    XCTAssertTrue(state.value)
  }

  @MainActor
  func testSelectionButtonUsesCompactRowHeight() {
    let height = fittingHeight(
      PreferencesIconSelectionButton(
        symbol: "display",
        title: "Displays",
        tint: .orange,
        isSelected: .constant(true)
      )
    )

    XCTAssertEqual(height, PreferencesIconSelectionButtonMetrics.height)
  }

  @MainActor
  func testRowsWithoutCaptionsUseCompactHeight() {
    let compactHeight = fittingHeight(
      PreferencesPopupRow(
        title: "Background",
        selection: .constant("Canvas"),
        options: [PreferencesPopupOption("Canvas", label: "Canvas")]
      )
    )
    let detailedHeight = fittingHeight(
      PreferencesPopupRow(
        title: "Background",
        caption: "Choose how the exported canvas is rendered.",
        selection: .constant("Canvas"),
        options: [PreferencesPopupOption("Canvas", label: "Canvas")]
      )
    )

    XCTAssertEqual(compactHeight, PreferencesRowLayout.minimumHeight)
    XCTAssertLessThan(compactHeight, detailedHeight)
  }

  @MainActor
  func testDependentRowsOnlyOccupySpaceWhenVisible() {
    let hiddenHeight = fittingHeight(
      PreferencesDependentRows(isVisible: false) {
        PreferencesRow(title: "Dependent setting")
      }
    )
    let visibleHeight = fittingHeight(
      PreferencesDependentRows(isVisible: true) {
        PreferencesRow(title: "Dependent setting")
      }
    )

    XCTAssertLessThan(hiddenHeight, 1)
    XCTAssertGreaterThan(visibleHeight, 40)
  }

  @MainActor
  func testSwitchGroupIncludesDependentRowsWhenEnabled() {
    let disabledHeight = fittingHeight(
      PreferencesSwitchGroup(title: "Master setting", isOn: .constant(false)) {
        PreferencesRow(title: "Dependent setting")
      }
    )
    let enabledHeight = fittingHeight(
      PreferencesSwitchGroup(title: "Master setting", isOn: .constant(true)) {
        PreferencesRow(title: "Dependent setting")
      }
    )

    XCTAssertGreaterThan(enabledHeight - disabledHeight, 40)
  }

  @MainActor
  private func fittingHeight<Content: View>(_ content: Content) -> CGFloat {
    let hostingView = NSHostingView(rootView: content.frame(width: 600))
    hostingView.layoutSubtreeIfNeeded()
    return hostingView.fittingSize.height
  }
}

private final class BooleanState {
  var value: Bool

  init(_ value: Bool) {
    self.value = value
  }
}
