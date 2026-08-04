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
}
