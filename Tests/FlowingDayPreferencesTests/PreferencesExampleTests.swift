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
        "Fuchsia",
        "Crimson",
        "Apricot",
        "Yuzu",
        "Honey",
        "Butter",
        "Sunbeam",
        "Sage",
        "Meadow",
        "Mint",
        "Celadon",
        "Seafoam",
        "Mist",
        "Dew",
        "Glacier",
        "Sky",
        "Periwinkle",
        "Breeze",
        "Plum",
        "Wisteria",
        "Violet",
        "Lilac",
        "Bloom",
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
        [.coral, .rose, .berry, .fuchsia, .crimson],
        [.apricot],
        [.yuzu, .honey, .butter, .sunbeam],
        [.sage, .meadow, .mint],
        [.celadon, .seafoam, .mist, .dew],
        [.glacier, .sky, .periwinkle, .breeze],
        [.plum, .wisteria, .violet, .lilac, .bloom],
      ]
    )
    XCTAssertEqual(ExampleAccentFamily.candidateCapacity, 10)
    XCTAssertEqual(ExampleAccentFamily.columnCount, 5)
    XCTAssertTrue(
      ExampleAccentFamily.allCases.allSatisfy {
        $0.accents.count <= ExampleAccentFamily.candidateCapacity
      }
    )
  }
}
