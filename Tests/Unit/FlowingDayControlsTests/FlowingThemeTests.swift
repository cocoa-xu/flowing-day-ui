import XCTest

@testable import FlowingDayControls

final class FlowingThemeTests: XCTestCase {
  func testCeladonDerivesAllAppearancesFromOneColor() {
    let values = FlowingAccentDerivation.values(
      base: FlowingAccentToken.base,
      fillLightness: FlowingAccentToken.fillLightness,
      foregroundContrast: FlowingAccentToken.foregroundContrast
    )

    XCTAssertEqual(values.fillLight, 0x6D9EA5)
    XCTAssertEqual(values.fillDark, 0x95C7CF)
    XCTAssertEqual(values.foregroundLight, 0x4B7C82)
    XCTAssertEqual(values.foregroundDark, 0x9ED1D9)
  }

  func testNamedAccentsAreDistinctAndShareTheAppearanceDerivation() {
    let bases = FlowingNamedAccentBase.all

    XCTAssertEqual(bases.count, 49)
    XCTAssertEqual(Set(bases).count, bases.count)

    for base in bases {
      let values = FlowingAccentDerivation.values(
        base: base,
        fillLightness: FlowingAccentToken.fillLightness,
        foregroundContrast: FlowingAccentToken.foregroundContrast
      )

      XCTAssertEqual(values.fillLight, base)
      XCTAssertNotEqual(values.fillDark, base)
      XCTAssertNotEqual(values.foregroundLight, base)
      XCTAssertNotEqual(values.foregroundDark, base)
    }
  }

  func testPreferredColorsRemainPaletteAnchors() {
    XCTAssertEqual(FlowingNamedAccentBase.poppy, 0xE96452)
    XCTAssertEqual(FlowingNamedAccentBase.berry, 0xDD62A7)
    XCTAssertEqual(FlowingNamedAccentBase.apricot, 0xB18D62)
    XCTAssertEqual(FlowingNamedAccentBase.honey, 0xAC9326)
    XCTAssertEqual(FlowingNamedAccentBase.leaf, 0x74A629)
    XCTAssertEqual(FlowingNamedAccentBase.seafoam, 0x4DA5A0)
    XCTAssertEqual(FlowingNamedAccentBase.brook, 0x29A3C5)
    XCTAssertEqual(FlowingNamedAccentBase.breeze, 0x6F92DE)
    XCTAssertEqual(FlowingNamedAccentBase.wisteria, 0x968AC7)
    XCTAssertEqual(FlowingNamedAccentBase.bloom, 0x9F82D5)
  }

  func testGeneratedMotionUsesSecondsAndReducedMotionOverrides() {
    XCTAssertEqual(FlowingMotion.disclosure, 0.18)
    XCTAssertEqual(FlowingMotion.page, 0.22)
    XCTAssertEqual(FlowingMotion.defaultDuration, 0.35)
    XCTAssertEqual(FlowingMotion.reducedDisclosure, 0.12)
    XCTAssertEqual(FlowingMotion.reducedExpand, 0.001)
  }
}
