import AppKit
import SwiftUI
import XCTest

@testable import FlowingDayPreferences

@MainActor
final class PreferencesNavigationTests: XCTestCase {
  func testPreferencesViewUsesCenteredContentByDefault() {
    let configuration = PreferencesViewConfiguration(applicationName: "Example")

    XCTAssertEqual(configuration.contentWidthPolicy, .centered())
  }

  func testContentWidthPolicyResolvesFluidAndCenteredLayouts() {
    XCTAssertNil(
      PreferencesContentWidthPolicy.fluid.resolvedMaximumWidth(defaultWidth: 720)
    )
    XCTAssertEqual(
      PreferencesContentWidthPolicy.centered().resolvedMaximumWidth(defaultWidth: 720),
      720
    )
    XCTAssertEqual(
      PreferencesContentWidthPolicy.centered(maximumWidth: 860).resolvedMaximumWidth(
        defaultWidth: 720
      ),
      860
    )
  }

  func testCenteredContentWidthRejectsInvalidValues() {
    XCTAssertEqual(
      PreferencesContentWidthPolicy.centered(maximumWidth: -.infinity).resolvedMaximumWidth(
        defaultWidth: 720
      ),
      720
    )
    XCTAssertEqual(
      PreferencesContentWidthPolicy.centered(maximumWidth: 0).resolvedMaximumWidth(
        defaultWidth: 720
      ),
      720
    )
  }

  func testPageGroupsPreserveApplicationMetadata() {
    let page = PreferencesPage(
      id: "general",
      title: "General",
      subtitle: "Application behavior",
      icon: .system("gearshape")
    ) {
      Color.clear
    }
    let group = PreferencesPageGroup(
      id: "primary",
      title: "Application",
      pages: [page],
      isIndented: true
    )

    XCTAssertEqual(group.id, "primary")
    XCTAssertEqual(group.title, "Application")
    XCTAssertEqual(group.pages.map(\.id), ["general"])
    XCTAssertTrue(group.isIndented)
  }

  func testPreferencesViewAcceptsAnEmptyPageCollection() {
    let root = PreferencesView(
      selection: .constant("missing"),
      configuration: PreferencesViewConfiguration(applicationName: "Example"),
      groups: [PreferencesPageGroup<String>(id: "empty", pages: [])]
    )
    let hostingView = NSHostingView(rootView: root)

    hostingView.frame = NSRect(x: 0, y: 0, width: 900, height: 640)
    hostingView.layoutSubtreeIfNeeded()

    XCTAssertNotNil(hostingView.layer)
  }

  func testPageCanUseASeparateHeaderIcon() {
    let page = PreferencesPage(
      id: "about",
      title: "About",
      subtitle: "Application information",
      icon: .system("info.circle"),
      headerIcon: .application
    ) {
      Color.clear
    }

    guard case .system(let sidebarSymbol) = page.icon else {
      return XCTFail("Expected a system sidebar icon")
    }
    guard case .application = page.headerIcon else {
      return XCTFail("Expected the application header icon")
    }

    XCTAssertEqual(sidebarSymbol, "info.circle")
  }

  func testPageUsesItsNavigationIconForTheHeaderByDefault() {
    let page = PreferencesPage(
      id: "general",
      title: "General",
      subtitle: "Application behavior",
      icon: .system("gearshape")
    ) {
      Color.clear
    }

    guard case .system(let headerSymbol) = page.headerIcon else {
      return XCTFail("Expected the navigation icon to be reused")
    }

    XCTAssertEqual(headerSymbol, "gearshape")
  }

  func testPageSupportsAHeaderWithoutASubtitle() {
    let page = PreferencesPage(
      id: "companion",
      title: "Companion",
      icon: .system("leaf")
    ) {
      Color.clear
    }

    XCTAssertNil(page.subtitle)
  }

  func testPageSupportsAnAccentColoredTemplateImage() {
    let image = NSImage(size: NSSize(width: 18, height: 18))
    let page = PreferencesPage(
      id: "companion",
      title: "Companion",
      icon: .template(image)
    ) {
      Color.clear
    }

    guard case .template(let pageImage) = page.icon else {
      return XCTFail("Expected a template image")
    }
    XCTAssertTrue(pageImage === image)
  }
}
