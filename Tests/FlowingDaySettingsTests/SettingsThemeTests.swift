import XCTest

@testable import FlowingDaySettings

final class SettingsThemeTests: XCTestCase {
  func testCeladonDerivesAllAppearancesFromOneColor() {
    let values = SettingsAccentDerivation.values(
      base: SettingsAccentToken.base,
      fillLightness: SettingsAccentToken.fillLightness,
      foregroundContrast: SettingsAccentToken.foregroundContrast
    )

    XCTAssertEqual(values.fillLight, 0x6D9EA5)
    XCTAssertEqual(values.fillDark, 0x95C7CF)
    XCTAssertEqual(values.foregroundLight, 0x4B7C82)
    XCTAssertEqual(values.foregroundDark, 0x9ED1D9)
  }

  func testGeneratedMotionUsesSecondsAndReducedMotionOverrides() {
    XCTAssertEqual(SettingsMotion.disclosure, 0.18)
    XCTAssertEqual(SettingsMotion.page, 0.22)
    XCTAssertEqual(SettingsMotion.defaultDuration, 0.35)
    XCTAssertEqual(SettingsMotion.reducedDisclosure, 0.12)
    XCTAssertEqual(SettingsMotion.reducedExpand, 0.001)
  }
}
