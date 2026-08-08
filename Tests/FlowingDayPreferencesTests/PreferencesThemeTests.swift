import XCTest

@testable import FlowingDayPreferences

final class PreferencesThemeTests: XCTestCase {
  func testCeladonDerivesAllAppearancesFromOneColor() {
    let values = PreferencesAccentDerivation.values(
      base: PreferencesAccentToken.base,
      fillLightness: PreferencesAccentToken.fillLightness,
      foregroundContrast: PreferencesAccentToken.foregroundContrast
    )

    XCTAssertEqual(values.fillLight, 0x6D9EA5)
    XCTAssertEqual(values.fillDark, 0x95C7CF)
    XCTAssertEqual(values.foregroundLight, 0x4B7C82)
    XCTAssertEqual(values.foregroundDark, 0x9ED1D9)
  }

  func testNamedAccentsAreDistinctAndShareTheAppearanceDerivation() {
    let bases = PreferencesNamedAccentBase.all

    XCTAssertEqual(bases.count, 49)
    XCTAssertEqual(Set(bases).count, bases.count)

    for base in bases {
      let values = PreferencesAccentDerivation.values(
        base: base,
        fillLightness: PreferencesAccentToken.fillLightness,
        foregroundContrast: PreferencesAccentToken.foregroundContrast
      )

      XCTAssertEqual(values.fillLight, base)
      XCTAssertNotEqual(values.fillDark, base)
      XCTAssertNotEqual(values.foregroundLight, base)
      XCTAssertNotEqual(values.foregroundDark, base)
    }
  }

  func testPreferredColorsRemainPaletteAnchors() {
    XCTAssertEqual(PreferencesNamedAccentBase.poppy, 0xE96452)
    XCTAssertEqual(PreferencesNamedAccentBase.berry, 0xDD62A7)
    XCTAssertEqual(PreferencesNamedAccentBase.apricot, 0xB18D62)
    XCTAssertEqual(PreferencesNamedAccentBase.honey, 0xAC9326)
    XCTAssertEqual(PreferencesNamedAccentBase.leaf, 0x74A629)
    XCTAssertEqual(PreferencesNamedAccentBase.seafoam, 0x4DA5A0)
    XCTAssertEqual(PreferencesNamedAccentBase.brook, 0x29A3C5)
    XCTAssertEqual(PreferencesNamedAccentBase.breeze, 0x6F92DE)
    XCTAssertEqual(PreferencesNamedAccentBase.wisteria, 0x968AC7)
    XCTAssertEqual(PreferencesNamedAccentBase.bloom, 0x9F82D5)
  }

  func testGeneratedMotionUsesSecondsAndReducedMotionOverrides() {
    XCTAssertEqual(PreferencesMotion.disclosure, 0.18)
    XCTAssertEqual(PreferencesMotion.page, 0.22)
    XCTAssertEqual(PreferencesMotion.defaultDuration, 0.35)
    XCTAssertEqual(PreferencesMotion.reducedDisclosure, 0.12)
    XCTAssertEqual(PreferencesMotion.reducedExpand, 0.001)
  }
}
