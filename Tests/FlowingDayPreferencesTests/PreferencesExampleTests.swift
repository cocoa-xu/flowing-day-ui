import AppKit
import XCTest

@testable import FlowingDayPreferencesExample

final class PreferencesExampleTests: XCTestCase {
  func testExampleExposesBothContentWidthPolicies() {
    XCTAssertEqual(ExampleContentLayout.centered.policy, .centered())
    XCTAssertEqual(ExampleContentLayout.fluid.policy, .fluid)
  }

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
        "Cherry",
        "Petal",
        "Rose",
        "Berry",

        "Peach",
        "Citrus",
        "Tangerine",
        "Nectar",
        "Apricot",
        "Amber",
        "Marigold",

        "Butter",
        "Honey",
        "Pollen",
        "Sunbeam",
        "Daffodil",
        "Yuzu",
        "Lemon",

        "Leaf",
        "Sage",
        "Sprout",
        "Meadow",
        "Clover",
        "Fern",
        "Mint",

        "Dew",
        "Seafoam",
        "Lagoon",
        "Tide",
        "Celadon",
        "Ripple",
        "Mist",

        "Glacier",
        "Brook",
        "Sky",
        "Rain",
        "Breeze",
        "Bluebell",
        "Evening",

        "Wisteria",
        "Bloom",
        "Plum",
        "Iris",
        "Lilac",
        "Violet",
        "Fuchsia",
      ]
    )
  }

  func testAppearanceOffersOneFeaturedAccentPerFamily() {
    XCTAssertEqual(
      ExampleAccent.featured,
      [.petal, .apricot, .honey, .leaf, .seafoam, .brook, .wisteria]
    )
    XCTAssertEqual(ExampleAccent.featured.count, ExampleAccentFamily.allCases.count)
    XCTAssertTrue(
      zip(ExampleAccent.featured, ExampleAccentFamily.allCases).allSatisfy { accent, family in
        family.accents.contains(accent)
      }
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
        [.coral, .poppy, .crimson, .cherry, .petal, .rose, .berry],
        [.peach, .citrus, .tangerine, .nectar, .apricot, .amber, .marigold],
        [.butter, .honey, .pollen, .sunbeam, .daffodil, .yuzu, .lemon],
        [.leaf, .sage, .sprout, .meadow, .clover, .fern, .mint],
        [.dew, .seafoam, .lagoon, .tide, .celadon, .ripple, .mist],
        [.glacier, .brook, .sky, .rain, .breeze, .bluebell, .evening],
        [.wisteria, .bloom, .plum, .iris, .lilac, .violet, .fuchsia],
      ]
    )
    XCTAssertTrue(ExampleAccentFamily.allCases.allSatisfy { $0.accents.count == 7 })
    XCTAssertEqual(ExampleAccentFamily.candidateCapacity, 7)
    XCTAssertEqual(ExampleAccentFamily.columnCount, 7)
    XCTAssertTrue(
      ExampleAccentFamily.allCases.allSatisfy {
        $0.accents.count <= ExampleAccentFamily.candidateCapacity
      }
    )
  }
}
