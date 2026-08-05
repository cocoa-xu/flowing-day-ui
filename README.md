# FlowingDayUI

[![CI](https://github.com/cocoa-xu/flowing-day-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/cocoa-xu/flowing-day-ui/actions/workflows/ci.yml)

FlowingDayUI is a personal SwiftUI design toolkit for macOS applications. Its first module, `FlowingDaySettings`, provides an integrated settings window, sidebar navigation, adaptive themes, and a focused set of settings controls.

The package requires macOS 13 or later.

## Installation

Add FlowingDayUI to your package dependencies:

```swift
.package(
    url: "https://github.com/cocoa-xu/flowing-day-ui",
    from: "1.4.0"
)
```

Then add `FlowingDaySettings` to the application target and import it:

```swift
import FlowingDaySettings
```

## Local development

Add the package by local path while developing applications alongside it:

```swift
.package(path: "../flowing-day-ui")
```

## Settings window

Define application-owned pages and pass their state through ordinary SwiftUI bindings:

```swift
private enum Page: Hashable {
    case general
    case about
}

struct AppSettingsView: View {
    @State private var selection = Page.general
    @AppStorage("launchAtLogin") private var launchAtLogin = false

    var body: some View {
        SettingsView(
            selection: $selection,
            configuration: SettingsViewConfiguration(
                applicationName: "Example",
                defaultAccent: SettingsAccent(
                    fill: SettingsPalette.dynamic(light: 0x6D9EA5, dark: 0x93C8CF),
                    foreground: SettingsPalette.dynamic(light: 0x4E7B82, dark: 0x9FD1D8)
                )
            ),
            groups: [
                SettingsPageGroup(
                    id: "primary",
                    pages: [
                        SettingsPage(
                            id: .general,
                            title: "General",
                            subtitle: "Application behavior",
                            icon: .system("gearshape")
                        ) {
                            SettingsPaneStack {
                                SettingsSection("Startup") {
                                    SettingsSwitchRow(
                                        title: "Launch at login",
                                        isOn: $launchAtLogin
                                    )
                                }
                            }
                        }
                    ]
                )
            ]
        )
    }
}
```

Present it with the reusable AppKit window lifecycle:

```swift
@MainActor
let settingsWindow = SettingsWindowPresenter(rootView: AppSettingsView())

settingsWindow.show()
```

Applications own their settings, persistence, localization, and business logic. The package owns presentation, navigation, interaction behavior, accessibility, and visual consistency.

Section footers align with the title and caption text inside their rows by default.

Pages can use distinct navigation and header artwork when the larger page heading needs more visual identity:

```swift
SettingsPage(
    id: .about,
    title: "About",
    subtitle: "Version and project information",
    icon: .system("info.circle"),
    headerIcon: .application
) {
    AboutSettingsView()
}
```

## Multi-select rows

Group related independent options into one settings row while preserving individual bindings and disabled states:

```swift
SettingsMultiSelectRow(
    symbol: "network",
    title: "Network",
    caption: "Choose which network content appears.",
    controlWidth: 260,
    options: [
        SettingsMultiSelectOption("Activity", isOn: $showNetwork),
        SettingsMultiSelectOption(
            "Chart",
            isOn: $showNetworkChart,
            isEnabled: showNetwork
        )
    ]
)
```

## Dependent rows

Associate a master switch with rows that appear only while it is enabled. The group
provides the separator, transition, animation, and Reduce Motion behavior:

```swift
SettingsSwitchGroup(
    symbol: "cable.connector",
    title: "Show USB devices",
    isOn: $showUSBDevices
) {
    SettingsMultiSelectRow(
        title: "Device fields",
        options: deviceFieldOptions
    )
    SettingsRowSeparator(isIndented: true)
    SettingsSwitchRow(
        title: "Copy identifiers on click",
        isOn: $copyIdentifiers
    )
}
```

Use `SettingsDependentRows` when the controlling value belongs to another control:

```swift
SettingsMultiSelectRow(title: "Network", options: networkOptions)
SettingsDependentRows(isVisible: showNetwork) {
    SettingsSegmentedRow(
        title: "Network layout",
        selection: $networkLayout,
        options: layoutOptions
    )
}
```

## Theming

`FlowingDaySettings` ships with the typography, spacing, and surface hierarchy used by Afloat. Applications can replace any semantic font or background without rebuilding the components:

```swift
let configuration = SettingsViewConfiguration(
    applicationName: "Example",
    defaultAccent: accent,
    typography: SettingsTypography(
        rowTitle: SettingsTextStyle(
            size: 14,
            weight: .medium,
            fontName: "Avenir Next Medium"
        )
    ),
    surfaces: SettingsSurfaces(
        card: Color(nsColor: .controlBackgroundColor),
        field: Color(nsColor: .textBackgroundColor)
    )
)
```

The standard surface hierarchy keeps the window canvas, sidebar, content cards, controls, and fields independently configurable. The default content cards use the light Afloat surface rather than the sidebar gray.

Each typography role can set its size, weight, system design, numeral treatment, or an exact installed font name. When `fontName` is present, it identifies the complete font face for that role.

## License

FlowingDayUI is available under the Apache License 2.0.
