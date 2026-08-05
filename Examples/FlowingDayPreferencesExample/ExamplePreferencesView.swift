import FlowingDayPreferences
import SwiftUI

private enum ExamplePage: Hashable {
  case general
  case appearance
  case devices
  case about
}

private enum UpdateChannel: Hashable {
  case stable
  case preview
}

private enum AppearanceMode: Hashable {
  case system
  case light
  case dark
}

struct ExamplePreferencesView: View {
  @State private var selection = ExamplePage.general
  @State private var launchesAtLogin = true
  @State private var updateChannel = UpdateChannel.stable
  @State private var appearance = AppearanceMode.system
  @State private var contentWidth = 720.0
  @State private var detectsDisplays = true
  @State private var detectsStorage = true
  @State private var detectsAudio = false
  @State private var advancedDevices = false
  @State private var deviceScope = "Connected"

  var body: some View {
    PreferencesView(
      selection: $selection,
      configuration: configuration,
      groups: pageGroups
    )
    .preferredColorScheme(preferredColorScheme)
  }

  private var configuration: PreferencesViewConfiguration {
    var metrics = PreferencesMetrics.standard
    metrics.contentWidth = contentWidth
    return PreferencesViewConfiguration(
      applicationName: "FlowingDayUI",
      sidebarFooter: "Preferences example",
      metrics: metrics
    )
  }

  private var preferredColorScheme: ColorScheme? {
    switch appearance {
    case .system: nil
    case .light: .light
    case .dark: .dark
    }
  }

  private var pageGroups: [PreferencesPageGroup<ExamplePage>] {
    [
      PreferencesPageGroup(
        id: "application",
        title: "Application",
        pages: [generalPage, appearancePage]
      ),
      PreferencesPageGroup(
        id: "hardware",
        title: "Hardware",
        pages: [devicesPage]
      ),
      PreferencesPageGroup(
        id: "information",
        pages: [aboutPage]
      ),
    ]
  }

  private var generalPage: PreferencesPage<ExamplePage> {
    PreferencesPage(
      id: .general,
      title: "General",
      subtitle: "Everyday application behavior",
      icon: .system("gearshape")
    ) {
      PreferencesPaneStack {
        PreferencesSection("Startup") {
          PreferencesSwitchRow(
            symbol: "power",
            title: "Launch at Login",
            caption: "Open the example when you sign in.",
            isOn: $launchesAtLogin
          )
          PreferencesRowSeparator(isIndented: true)
          PreferencesPopupRow(
            symbol: "arrow.triangle.2.circlepath",
            title: "Update Channel",
            selection: $updateChannel,
            options: [
              PreferencesPopupOption(.stable, label: "Stable"),
              PreferencesPopupOption(.preview, label: "Preview"),
            ]
          )
        }
      }
    }
  }

  private var appearancePage: PreferencesPage<ExamplePage> {
    PreferencesPage(
      id: .appearance,
      title: "Appearance",
      subtitle: "Live preferences for this window",
      icon: .system("paintpalette")
    ) {
      PreferencesPaneStack {
        PreferencesSection("Window") {
          PreferencesSegmentedRow(
            symbol: "circle.lefthalf.filled",
            title: "Appearance",
            selection: $appearance,
            options: [
              PreferencesPopupOption(.system, label: "System"),
              PreferencesPopupOption(.light, label: "Light"),
              PreferencesPopupOption(.dark, label: "Dark"),
            ]
          )
          PreferencesRowSeparator(isIndented: true)
          PreferencesSliderRow(
            symbol: "rectangle.expand.vertical",
            title: "Content Width",
            value: $contentWidth,
            in: 560...760,
            step: 20
          ) { "\(Int($0)) pt" }
        }
      }
    }
  }

  private var devicesPage: PreferencesPage<ExamplePage> {
    PreferencesPage(
      id: .devices,
      title: "Devices",
      subtitle: "A compact example of dependent controls",
      icon: .system("externaldrive.connected.to.line.below")
    ) {
      PreferencesPaneStack {
        PreferencesSection("Discovery") {
          PreferencesMultiSelectRow(
            symbol: "sensor",
            title: "Device Types",
            options: [
              PreferencesMultiSelectOption("Displays", isOn: $detectsDisplays),
              PreferencesMultiSelectOption("Storage", isOn: $detectsStorage),
              PreferencesMultiSelectOption("Audio", isOn: $detectsAudio),
            ]
          )
          PreferencesRowSeparator(isIndented: true)
          PreferencesSwitchGroup(
            symbol: "slider.horizontal.3",
            title: "Advanced Discovery",
            isOn: $advancedDevices
          ) {
            PreferencesPopupRow(
              title: "Device Scope",
              selection: $deviceScope,
              options: [
                PreferencesPopupOption("Connected", label: "Connected"),
                PreferencesPopupOption("All", label: "All Known"),
              ]
            )
          }
        }
      }
    }
  }

  private var aboutPage: PreferencesPage<ExamplePage> {
    PreferencesPage(
      id: .about,
      title: "About",
      subtitle: "FlowingDayUI 2.0 development example",
      icon: .system("info.circle"),
      headerIcon: .application
    ) {
      PreferencesPaneStack {
        PreferencesSection("FlowingDayUI") {
          PreferencesValueRow(
            symbol: "shippingbox",
            title: "Module",
            value: "FlowingDayPreferences"
          )
          PreferencesRowSeparator(isIndented: true)
          PreferencesLinkRow(
            symbol: "chevron.left.forwardslash.chevron.right",
            title: "Source Code",
            buttonTitle: "GitHub",
            destination: URL(string: "https://github.com/cocoa-xu/flowing-day-ui")!,
            help: "Open FlowingDayUI on GitHub"
          )
        }
      }
    }
  }
}
