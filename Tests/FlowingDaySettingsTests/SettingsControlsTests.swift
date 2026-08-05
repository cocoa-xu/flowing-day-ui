import SwiftUI
import XCTest

@testable import FlowingDaySettings

final class SettingsControlsTests: XCTestCase {
  func testDefaultThemeMatchesSettingsVisualHierarchy() {
    let typography = SettingsTypography.standard
    let surfaces = SettingsSurfaces.standard

    XCTAssertEqual(typography.pageTitle.size, 25)
    XCTAssertEqual(typography.pageTitle.weight, .semibold)
    XCTAssertEqual(typography.pageTitle.design, .rounded)
    XCTAssertEqual(typography.contentTitle.size, 21)
    XCTAssertEqual(typography.body.size, 12)
    XCTAssertEqual(typography.rowTitle.size, 13)
    XCTAssertEqual(typography.sectionHeader.size, 10.5)
    XCTAssertEqual(surfaces.sidebar, SettingsPalette.card)
    XCTAssertEqual(surfaces.card, SettingsPalette.control)
  }

  func testThemeCanBeCustomizedPerApplication() {
    let typography = SettingsTypography(
      rowTitle: SettingsTextStyle(
        size: 15,
        weight: .medium,
        fontName: "Helvetica Neue"
      )
    )
    let surfaces = SettingsSurfaces(card: .orange, field: .purple)

    XCTAssertEqual(typography.rowTitle.size, 15)
    XCTAssertEqual(typography.rowTitle.weight, .medium)
    XCTAssertEqual(typography.rowTitle.fontName, "Helvetica Neue")
    XCTAssertEqual(surfaces.card, .orange)
    XCTAssertEqual(surfaces.field, .purple)
  }

  func testSliderMathClampsFractions() {
    let range = 10.0...20.0

    XCTAssertEqual(SettingsSliderMath.fraction(of: 5, in: range), 0)
    XCTAssertEqual(SettingsSliderMath.fraction(of: 15, in: range), 0.5)
    XCTAssertEqual(SettingsSliderMath.fraction(of: 25, in: range), 1)
    XCTAssertEqual(SettingsSliderMath.value(atFraction: -1, in: range), 10)
    XCTAssertEqual(SettingsSliderMath.value(atFraction: 0.25, in: range), 12.5)
    XCTAssertEqual(SettingsSliderMath.value(atFraction: 2, in: range), 20)
  }

  func testSelectionIndicatorsDistinguishSingleAndMultipleChoice() {
    XCTAssertNil(SettingsSelectionStyle.single.symbol(isSelected: true))
    XCTAssertNil(SettingsSelectionStyle.single.symbol(isSelected: false))
    XCTAssertEqual(
      SettingsSelectionStyle.multiple.symbol(isSelected: true),
      "checkmark.circle.fill"
    )
    XCTAssertEqual(
      SettingsSelectionStyle.multiple.symbol(isSelected: false),
      "circle"
    )
  }

  @MainActor
  func testMultiSelectOptionTogglesItsBinding() {
    let state = BooleanState(false)
    let option = SettingsMultiSelectOption(
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
    let option = SettingsMultiSelectOption(
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
    XCTAssertTrue(SettingsOptionSearch.matches("Asia/Tokyo", query: "  TOKYO "))
    XCTAssertTrue(SettingsOptionSearch.matches("Europe/London", query: ""))
    XCTAssertFalse(SettingsOptionSearch.matches("Europe/London", query: "Tokyo"))
  }

  func testDependentRowsMotionRespectsReduceMotion() {
    XCTAssertEqual(
      SettingsDependentRowsMotion.duration(reduceMotion: false),
      0.18
    )
    XCTAssertEqual(
      SettingsDependentRowsMotion.duration(reduceMotion: true),
      0.12
    )
    XCTAssertEqual(SettingsDependentRowsMotion.offset(reduceMotion: false), -5)
    XCTAssertEqual(SettingsDependentRowsMotion.offset(reduceMotion: true), 0)
  }

  @MainActor
  func testSelectionButtonTogglesItsBinding() {
    let state = BooleanState(false)
    let button = SettingsIconSelectionButton(
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
      SettingsIconSelectionButton(
        symbol: "display",
        title: "Displays",
        tint: .orange,
        isSelected: .constant(true)
      )
    )

    XCTAssertEqual(height, SettingsIconSelectionButtonMetrics.height)
  }

  @MainActor
  func testRowsWithoutCaptionsUseCompactHeight() {
    let compactHeight = fittingHeight(
      SettingsPopupRow(
        title: "Background",
        selection: .constant("Canvas"),
        options: [SettingsPopupOption("Canvas", label: "Canvas")]
      )
    )
    let detailedHeight = fittingHeight(
      SettingsPopupRow(
        title: "Background",
        caption: "Choose how the exported canvas is rendered.",
        selection: .constant("Canvas"),
        options: [SettingsPopupOption("Canvas", label: "Canvas")]
      )
    )

    XCTAssertEqual(compactHeight, SettingsRowLayout.minimumHeight)
    XCTAssertLessThan(compactHeight, detailedHeight)
  }

  @MainActor
  func testDependentRowsOnlyOccupySpaceWhenVisible() {
    let hiddenHeight = fittingHeight(
      SettingsDependentRows(isVisible: false) {
        SettingsRow(title: "Dependent setting")
      }
    )
    let visibleHeight = fittingHeight(
      SettingsDependentRows(isVisible: true) {
        SettingsRow(title: "Dependent setting")
      }
    )

    XCTAssertLessThan(hiddenHeight, 1)
    XCTAssertGreaterThan(visibleHeight, 40)
  }

  @MainActor
  func testSwitchGroupIncludesDependentRowsWhenEnabled() {
    let disabledHeight = fittingHeight(
      SettingsSwitchGroup(title: "Master setting", isOn: .constant(false)) {
        SettingsRow(title: "Dependent setting")
      }
    )
    let enabledHeight = fittingHeight(
      SettingsSwitchGroup(title: "Master setting", isOn: .constant(true)) {
        SettingsRow(title: "Dependent setting")
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
