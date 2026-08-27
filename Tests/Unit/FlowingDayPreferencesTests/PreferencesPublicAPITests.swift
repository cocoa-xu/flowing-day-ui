import AppKit
import FlowingDayControls
import FlowingDayPreferences
import SwiftUI
import XCTest

@MainActor
final class PreferencesPublicAPITests: XCTestCase {
  func testPreferencesComposeFromTheDocumentedPublicBoundary() {
    let configuration = PreferencesViewConfiguration(
      applicationName: "Example",
      defaultAccent: .petal,
      metrics: PreferencesMetrics(
        controls: FlowingMetrics(cardRadius: 12),
        contentWidth: 680
      ),
      typography: PreferencesTypography(
        controls: FlowingTypography(rowTitle: FlowingTextStyle(size: 14))
      ),
      surfaces: PreferencesSurfaces(
        controls: FlowingSurfaces(card: .white),
        sidebar: .gray
      )
    )
    let page = PreferencesPage(
      id: "general",
      title: "General",
      icon: .system("gearshape")
    ) {
      PreferencesSection("Behavior") {
        PreferencesSwitchRow(title: "Enabled", isOn: .constant(true))
      }
    }
    let view = PreferencesView(
      selection: .constant("general"),
      configuration: configuration,
      groups: [PreferencesPageGroup(id: "application", pages: [page])]
    )
    let imageRow = PreferencesRow(
      icon: .image(NSImage(size: NSSize(width: 20, height: 20))),
      title: "Image"
    )
    let templateRow = PreferencesRow(
      icon: .template(NSImage(size: NSSize(width: 20, height: 20))),
      title: "Template"
    )
    let accentSystemRow = PreferencesRow(
      icon: .accentSystem("desktopcomputer"),
      title: "Accent system"
    )
    let mutedTemplateRow = PreferencesRow(
      icon: .mutedTemplate(NSImage(size: NSSize(width: 20, height: 20))),
      title: "Muted template"
    )

    XCTAssertNotNil(AnyView(view))
    XCTAssertNotNil(AnyView(imageRow))
    XCTAssertNotNil(AnyView(templateRow))
    XCTAssertNotNil(AnyView(accentSystemRow))
    XCTAssertNotNil(AnyView(mutedTemplateRow))
  }
}
