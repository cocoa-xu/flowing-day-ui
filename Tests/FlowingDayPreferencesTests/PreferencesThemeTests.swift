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

  func testNamedAccentsShareTheSameAppearanceLogic() {
    let expectations: [(UInt32, PreferencesAccentHexValues)] = [
      (
        PreferencesNamedAccentBase.yuzu,
        PreferencesAccentHexValues(
          fillLight: 0x939D37,
          fillDark: 0xBBC763,
          foregroundLight: 0x727A00,
          foregroundDark: 0xC5D16D
        )
      ),
      (
        PreferencesNamedAccentBase.glacier,
        PreferencesAccentHexValues(
          fillLight: 0x5AA0B1,
          fillDark: 0x83CADB,
          foregroundLight: 0x367D8E,
          foregroundDark: 0x8DD4E5
        )
      ),
      (
        PreferencesNamedAccentBase.seafoam,
        PreferencesAccentHexValues(
          fillLight: 0x4DA5A0,
          fillDark: 0x78CFC9,
          foregroundLight: 0x24827E,
          foregroundDark: 0x82D9D3
        )
      ),
      (
        PreferencesNamedAccentBase.sage,
        PreferencesAccentHexValues(
          fillLight: 0x76A454,
          fillDark: 0x9ECE7C,
          foregroundLight: 0x558131,
          foregroundDark: 0xA7D885
        )
      ),
      (
        PreferencesNamedAccentBase.plum,
        PreferencesAccentHexValues(
          fillLight: 0xA187BE,
          fillDark: 0xCAB0E9,
          foregroundLight: 0x7F659A,
          foregroundDark: 0xD4BAF3
        )
      ),
      (
        PreferencesNamedAccentBase.honey,
        PreferencesAccentHexValues(
          fillLight: 0xAC9326,
          fillDark: 0xD6BC56,
          foregroundLight: 0x897000,
          foregroundDark: 0xE0C660
        )
      ),
      (
        PreferencesNamedAccentBase.wisteria,
        PreferencesAccentHexValues(
          fillLight: 0x968AC7,
          fillDark: 0xBFB3F2,
          foregroundLight: 0x7468A2,
          foregroundDark: 0xC9BDFC
        )
      ),
    ]

    for (base, expected) in expectations {
      XCTAssertEqual(
        PreferencesAccentDerivation.values(
          base: base,
          fillLightness: PreferencesAccentToken.fillLightness,
          foregroundContrast: PreferencesAccentToken.foregroundContrast
        ),
        expected
      )
    }
  }

  func testGeneratedMotionUsesSecondsAndReducedMotionOverrides() {
    XCTAssertEqual(PreferencesMotion.disclosure, 0.18)
    XCTAssertEqual(PreferencesMotion.page, 0.22)
    XCTAssertEqual(PreferencesMotion.defaultDuration, 0.35)
    XCTAssertEqual(PreferencesMotion.reducedDisclosure, 0.12)
    XCTAssertEqual(PreferencesMotion.reducedExpand, 0.001)
  }
}
