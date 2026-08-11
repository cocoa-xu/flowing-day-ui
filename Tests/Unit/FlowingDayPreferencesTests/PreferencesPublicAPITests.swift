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

    XCTAssertNotNil(AnyView(view))
  }
}
