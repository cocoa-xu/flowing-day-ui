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
        "Poppy",
        "Crimson",
        "Petal",
        "Rose",
        "Berry",
        "Fuchsia",
        "Apricot",
        "Butter",
        "Honey",
        "Sunbeam",
        "Yuzu",
        "Leaf",
        "Sage",
        "Sprout",
        "Meadow",
        "Clover",
        "Mint",
        "Dew",
        "Seafoam",
        "Celadon",
        "Mist",
        "Glacier",
        "Brook",
        "Sky",
        "Rain",
        "Breeze",
        "Bluebell",
        "Wisteria",
        "Bloom",
        "Plum",
        "Iris",
        "Lilac",
        "Violet",
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
        [.coral, .poppy, .crimson, .petal, .rose, .berry, .fuchsia],
        [.apricot],
        [.butter, .honey, .sunbeam, .yuzu],
        [.leaf, .sage, .sprout, .meadow, .clover, .mint],
        [.dew, .seafoam, .celadon, .mist],
        [.glacier, .brook, .sky, .rain, .breeze, .bluebell],
        [.wisteria, .bloom, .plum, .iris, .lilac, .violet],
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
