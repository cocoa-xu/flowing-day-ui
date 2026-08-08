import AppKit
import XCTest

@testable import FlowingDayPreferencesExample

final class PreferencesExampleTests: XCTestCase {
  @MainActor
  func testExampleStaysOpenWhenATransientPanelCloses() {
    let application = FlowingDayPreferencesExampleApp()

    XCTAssertFalse(
      application.applicationShouldTerminateAfterLastWindowClosed(NSApplication.shared)
    )
  }

  func testExampleNavigationIsAComponentShowcase() {
    XCTAssertEqual(
      ExamplePage.allCases.map(\.rawValue),
      [
        "appearance",
        "layout",
        "typography",
        "motion",
        "icons",
        "components",
        "about",
      ]
    )
  }

  func testLayoutPresetsMatchTheLandingPage() {
    XCTAssertEqual(ExampleContentWidth.narrow.value, 560)
    XCTAssertEqual(ExampleContentWidth.standard.value, 720)
    XCTAssertEqual(ExampleContentWidth.wide.value, 860)
    XCTAssertEqual(ExampleDensity.standard.rowInset, 18)
    XCTAssertEqual(ExampleDensity.standard.sectionSpacing, 20)
  }

  func testExamplePresentsEveryNamedAccentInPaletteOrder() {
    XCTAssertEqual(
      ExampleAccent.palette.map(\.title),
      [
        "Coral",
        "Rose",
        "Berry",
        "Blush",
        "Fuchsia",
        "Apricot",
        "Yuzu",
        "Honey",
        "Butter",
        "Sage",
        "Celadon",
        "Seafoam",
        "Mist",
        "Dew",
        "Glacier",
        "Sky",
        "Periwinkle",
        "Plum",
        "Wisteria",
        "Dusk",
      ]
    )
  }

  func testExampleGroupsRelatedAccentsIntoColorFamilies() {
    XCTAssertEqual(
      ExampleAccentFamily.allCases.map(\.title),
      [
        "Red",
        "Orange",
        "Yellow",
        "Green",
        "Cyan",
        "Blue",
        "Purple",
      ]
    )
    XCTAssertEqual(
      ExampleAccentFamily.allCases.map(\.accents),
      [
        [.coral, .rose, .berry, .blush, .fuchsia],
        [.apricot],
        [.yuzu, .honey, .butter],
        [.sage],
        [.celadon, .seafoam, .mist, .dew],
        [.glacier, .sky, .periwinkle],
        [.plum, .wisteria, .dusk],
      ]
    )
    XCTAssertEqual(ExampleAccentFamily.capacity, 5)
  }
}
