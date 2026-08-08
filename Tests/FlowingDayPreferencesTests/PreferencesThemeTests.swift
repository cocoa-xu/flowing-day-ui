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
          fillLight: 0x939B50,
          fillDark: 0xBBC478,
          foregroundLight: 0x71782D,
          foregroundDark: 0xC5CE81
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
          fillLight: 0x839E72,
          fillDark: 0xABC79A,
          foregroundLight: 0x627B51,
          foregroundDark: 0xB4D1A3
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
          fillLight: 0xA89441,
          fillDark: 0xD2BD6B,
          foregroundLight: 0x857218,
          foregroundDark: 0xDCC775
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
