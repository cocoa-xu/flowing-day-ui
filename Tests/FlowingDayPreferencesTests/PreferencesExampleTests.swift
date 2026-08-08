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
        "Apricot",
        "Celadon",
        "Yuzu",
        "Glacier",
        "Seafoam",
        "Mist",
        "Sage",
        "Plum",
        "Honey",
        "Wisteria",
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
        [.coral],
        [.apricot],
        [.yuzu, .honey],
        [.sage],
        [.celadon, .seafoam, .mist],
        [.glacier],
        [.plum, .wisteria],
      ]
    )
    XCTAssertEqual(ExampleAccentFamily.capacity, 5)
  }
}
