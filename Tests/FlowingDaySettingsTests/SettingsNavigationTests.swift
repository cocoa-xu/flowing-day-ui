import AppKit
import SwiftUI
import XCTest

@testable import FlowingDaySettings

@MainActor
final class SettingsNavigationTests: XCTestCase {
  func testPageGroupsPreserveApplicationMetadata() {
    let page = SettingsPage(
      id: "general",
      title: "General",
      subtitle: "Application behavior",
      icon: .system("gearshape")
    ) {
      Color.clear
    }
    let group = SettingsPageGroup(
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

  func testSettingsViewAcceptsAnEmptyPageCollection() {
    let root = SettingsView(
      selection: .constant("missing"),
      configuration: SettingsViewConfiguration(applicationName: "Example"),
      groups: [SettingsPageGroup<String>(id: "empty", pages: [])]
    )
    let hostingView = NSHostingView(rootView: root)

    hostingView.frame = NSRect(x: 0, y: 0, width: 900, height: 640)
    hostingView.layoutSubtreeIfNeeded()

    XCTAssertNotNil(hostingView.layer)
  }
}
