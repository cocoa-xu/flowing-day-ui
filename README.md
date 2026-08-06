# FlowingDayUI

[![CI](https://github.com/cocoa-xu/flowing-day-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/cocoa-xu/flowing-day-ui/actions/workflows/ci.yml)

FlowingDayUI is a personal SwiftUI design toolkit for macOS applications. `FlowingDayPreferences` provides an integrated preferences window, and `FlowingDayCanvas` provides a composable, virtualized infinite viewport.

The package requires macOS 13 or later.

## Installation

Add FlowingDayUI to your package dependencies:

```swift
.package(
    url: "https://github.com/cocoa-xu/flowing-day-ui",
    from: "2.0.0"
)
```

Add the products needed by the application target and import their modules:

```swift
import FlowingDayPreferences
import FlowingDayCanvas
```

## Local development

Add the package by local path while developing applications alongside it:

```swift
.package(path: "../flowing-day-ui")
```

Design values are authored only in
`web/packages/core/src/tokens/tokens.json`. Regenerate the committed Swift theme with
`cd web && corepack pnpm tokens:swift`; `PreferencesTheme.swift` is generated output.

Run the dogfooding example as a native macOS executable:

```sh
swift run FlowingDayPreferencesExample
```

It opens only the Preferences window and exercises the package's own navigation,
controls, live appearance changes, and AppKit presenter.

## Preferences window

Define application-owned pages and pass their state through ordinary SwiftUI bindings:

```swift
private enum Page: Hashable {
    case general
    case about
}

struct AppPreferencesView: View {
    @State private var selection = Page.general
    @AppStorage("launchAtLogin") private var launchAtLogin = false

    var body: some View {
        PreferencesView(
            selection: $selection,
            configuration: PreferencesViewConfiguration(
                applicationName: "Example",
                defaultAccent: PreferencesAccent(
                    fill: PreferencesPalette.dynamic(light: 0x6D9EA5, dark: 0x93C8CF),
                    foreground: PreferencesPalette.dynamic(light: 0x4E7B82, dark: 0x9FD1D8)
                )
            ),
            groups: [
                PreferencesPageGroup(
                    id: "primary",
                    pages: [
                        PreferencesPage(
                            id: .general,
                            title: "General",
                            subtitle: "Application behavior",
                            icon: .system("gearshape")
                        ) {
                            PreferencesPaneStack {
                                PreferencesSection("Startup") {
                                    PreferencesSwitchRow(
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
let preferencesWindow = PreferencesWindowPresenter(rootView: AppPreferencesView())

preferencesWindow.show()
```

The default `900 × 640` size is also the default minimum; the default maximum is
`1160 × 860`. Applications can choose a different range:

```swift
let windowConfiguration = PreferencesWindowConfiguration(
    size: CGSize(width: 980, height: 700),
    minimumSize: CGSize(width: 840, height: 600),
    maximumSize: CGSize(width: 1080, height: 760)
)
```

Applications own their preferences, persistence, localization, and business logic. The package owns presentation, navigation, interaction behavior, accessibility, and visual consistency.

## Infinite canvas

`FlowingCanvas` owns viewport transforms, mouse and trackpad input, focus requests,
and retained render coverage. The application owns its world model and draws only the
content intersecting `renderWorldRect`:

```swift
@State private var viewport = FlowingCanvasViewport()

FlowingCanvas(
    viewport: $viewport,
    contentRect: worldBounds,
    contentID: worldRevision
) { _ in
    Color.white
} world: { context in
    FlowingCanvasWorldLayer(context: context) { surface in
        DiagramNodes(
            worldRect: context.renderWorldRect,
            transform: surface.localTransform
        )
    }
} overlays: { proxy in
    FlowingCanvasViewportOverlay(alignment: .bottomTrailing) {
        Button("Fit") {
            proxy.fit(worldBounds, padding: 40)
        }
    }
}
```

World content, floating panels, and viewport tools remain independent view builders.
The canvas does not own graph layout, selection semantics, node design, or export.

## Graph canvas interaction

`FlowingGraphCanvas` combines a graph presentation, an exact layout result, and
session-owned interaction state without mutating the application document. Node drag
and arrangement results are emitted as intents pinned to both presentation and layout
identity; the consumer validates and commits them.

Node movement has three independent policy layers:

- `FlowingGraphCanvasNodeDraggingMode` controls whether dragging is disabled, single-node,
  or multi-node.
- `FlowingGraphCanvasNodeCapabilityMap` supplies defaults plus sparse per-node overrides.
- `admitNodeDrag` receives one stable batch at gesture start and can allow all candidates,
  deny the gesture, or admit a subset.

The callback is not evaluated from `body` or on each drag frame. Snapping queries the
spatial index around the moving bounds and has an explicit candidate budget.

```swift
let configuration = FlowingGraphCanvasConfiguration(
    nodeDraggingMode: .multiple,
    snapping: .standard,
    keyboardNavigation: .standard,
    accessibility: .standard
)
```

Snapping is disabled by default so adopting the graph canvas does not change placement
behavior. Keyboard navigation and node accessibility are enabled by default and can be
disabled independently. Align and distribute operations arrive through the session
command channel and emit translations through the same intent boundary.

Section footers align with the title and caption text inside their rows by default.

Pages can use distinct navigation and header artwork when the larger page heading needs more visual identity:

```swift
PreferencesPage(
    id: .about,
    title: "About",
    subtitle: "Version and project information",
    icon: .system("info.circle"),
    headerIcon: .application
) {
    AboutPreferencesView()
}
```

## Multi-select rows

Group related independent options into one preferences row while preserving individual bindings and disabled states:

```swift
PreferencesMultiSelectRow(
    symbol: "network",
    title: "Network",
    caption: "Choose which network content appears.",
    controlWidth: 260,
    options: [
        PreferencesMultiSelectOption("Activity", isOn: $showNetwork),
        PreferencesMultiSelectOption(
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
PreferencesSwitchGroup(
    symbol: "cable.connector",
    title: "Show USB devices",
    isOn: $showUSBDevices
) {
    PreferencesMultiSelectRow(
        title: "Device fields",
        options: deviceFieldOptions
    )
    PreferencesRowSeparator(isIndented: true)
    PreferencesSwitchRow(
        title: "Copy identifiers on click",
        isOn: $copyIdentifiers
    )
}
```

Use `PreferencesDependentRows` when the controlling value belongs to another control:

```swift
PreferencesMultiSelectRow(title: "Network", options: networkOptions)
PreferencesDependentRows(isVisible: showNetwork) {
    PreferencesSegmentedRow(
        title: "Network layout",
        selection: $networkLayout,
        options: layoutOptions
    )
}
```

## Theming

`FlowingDayPreferences` ships with the typography, spacing, and surface hierarchy used by Afloat. Applications can replace any semantic font or background without rebuilding the components:

```swift
let configuration = PreferencesViewConfiguration(
    applicationName: "Example",
    defaultAccent: accent,
    typography: PreferencesTypography(
        rowTitle: PreferencesTextStyle(
            size: 14,
            weight: .medium,
            fontName: "Avenir Next Medium"
        )
    ),
    surfaces: PreferencesSurfaces(
        card: Color(nsColor: .controlBackgroundColor),
        field: Color(nsColor: .textBackgroundColor)
    )
)
```

The standard surface hierarchy keeps the window canvas, sidebar, content cards, controls, and fields independently configurable. The default content cards use the light Afloat surface rather than the sidebar gray.

Each typography role can set its size, weight, system design, numeral treatment, or an exact installed font name. When `fontName` is present, it identifies the complete font face for that role.

## License

FlowingDayUI is available under the Apache License 2.0.
