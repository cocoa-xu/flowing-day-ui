# FlowingDayUI

[![CI](https://github.com/cocoa-xu/flowing-day-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/cocoa-xu/flowing-day-ui/actions/workflows/ci.yml)

FlowingDayUI is a desktop-grade interface toolkit for SwiftUI and the web. It provides reusable controls, a composed Preferences experience, and a high-performance infinite canvas without taking ownership of application state or product semantics.

The package requires macOS 13 or later.

## Installation

Add FlowingDayUI to your package dependencies:

```swift
.package(
    url: "https://github.com/cocoa-xu/flowing-day-ui",
    from: "2.2.0"
)
```

Add the products needed by the application target and import their modules:

```swift
import FlowingDayControls
import FlowingDayPreferences
import FlowingDayCanvas
```

Choose only the products the target uses:

| Product | Purpose |
| --- | --- |
| `FlowingDayControls` | Reusable controls, fields, status views, overlays, layout, and shared theme semantics |
| `FlowingDayPreferences` | Preferences pages, rows, navigation, and native window presentation |
| `FlowingDayCanvas` | Precise infinite viewport transforms, gestures, overlays, and render coverage |
| `FlowingDayGraphCanvas` | Virtualized graph presentation, editing, navigation, accessibility, and minimap |

## Controls quick start

Controls use ordinary SwiftUI bindings. Interactive controls require a meaningful label so keyboard and assistive behavior stays correct when they are composed outside Preferences rows:

```swift
import FlowingDayControls
import SwiftUI

struct ReadingControls: View {
    @State private var quietMode = false
    @State private var intensity = 0.6

    var body: some View {
        FlowingCard {
            VStack(alignment: .leading, spacing: 14) {
                FlowingSwitch("Quiet mode", isOn: $quietMode)
                FlowingSlider(
                    "Intensity",
                    value: $intensity,
                    in: 0...1,
                    step: 0.05,
                    formatValue: { "\(Int($0 * 100)) percent" }
                )
            }
        }
        .flowingAccent(.petal)
    }
}
```

Open the package documentation in Xcode for focused guides to controls, theming, accessibility, and Preferences composition.

## Local development

Add the package by local path while developing applications alongside it:

```swift
.package(path: "../flowing-day-ui")
```

Design values are authored only in
`web/packages/core/src/tokens/tokens.json`. Regenerate the committed Swift theme with
`cd web && corepack pnpm tokens:swift`; the committed `FlowingTheme.swift`,
`FlowingAccentPalette.swift`, and `PreferencesTheme.swift` files are generated output.

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
                defaultAccent: FlowingAccent(
                    fill: FlowingPalette.dynamic(light: 0x6D9EA5, dark: 0x93C8CF),
                    foreground: FlowingPalette.dynamic(light: 0x4E7B82, dark: 0x9FD1D8)
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
    nodeResizing: .standard,
    connectionEditing: .standard,
    snapping: FlowingGraphCanvasSnappingConfiguration(
        isEnabled: true,
        targets: [.alignment, .grid, .equalSpacing, .equalSize],
        gridCellSize: CGSize(width: 24, height: 24)
    ),
    keyboardNavigation: .standard,
    accessibility: .standard
)
```

Snapping is disabled by default so adopting the graph canvas does not change placement
behavior. Keyboard navigation and basic node accessibility are enabled by default and
can be disabled independently. Alignment, grid, equal-spacing, and equal-size targets
can be selected independently. Snap tolerance and guide offsets are specified in
rendered points and remain visually stable across zoom levels.

For semantic accessibility across nodes, ports, and edges, the consumer supplies labels,
values, hints, roles, and available actions while the canvas owns focus, navigation,
selection forwarding, viewport focus, and platform accessibility objects:

```swift
let accessibility = try content.accessibilitySnapshot(
    canvasDescription: .init(label: "Workflow"),
    node: { node in
        .element(
            .init(
                label: String(describing: node.value),
                roleDescription: "workflow node"
            )
        )
    },
    port: { _ in .hidden },
    edge: { _ in .hidden }
)

FlowingGraphCanvas(
    content: content,
    sessionID: sessionID,
    session: $session,
    accessibilitySnapshot: accessibility
) { context in
    background(context)
} node: { node, context in
    nodeView(node, context: context)
} edge: { edge, context in
    edgeView(edge, context: context)
}
```

Hidden intermediary elements remain part of relationship navigation without appearing
in the accessibility tree. The AppKit bridge exposes a bounded window around stable
focus, so a graph with one hundred thousand elements does not create one hundred thousand
accessibility objects. Capabilities for selection, movement, connection workflows, and
custom element actions can be enabled independently.

Node builders can place `FlowingGraphCanvasResizeHandle` around their own node design.
Resize gestures use transient node, port, and incident-edge geometry, then emit one
snapshot-pinned resize intent when the gesture ends. Align and equal-gap distribute
operations arrive through the session command channel and use the same intent boundary.

Connection editing follows the same boundary. The canvas owns pointer and accessible
interaction, previews, candidate feedback, and endpoint reconnection handles. A consumer
validates candidates through `FlowingGraphCanvasConnectionPolicy`, then applies or rejects
the emitted snapshot-pinned operation in its document reducer.

For large graphs, build a `FlowingGraphCanvasSearchIndex` away from the main actor and
present the results with the default panel or a custom row. Search results remain ordinary
element identities; jumping is an explicit session command with configurable selection and
zoom behavior:

```swift
let index = try FlowingGraphCanvasSearchIndex(
    items: presentation.nodes.map {
        FlowingGraphCanvasSearchItem(id: $0.id, title: String(describing: $0.value))
    }
)

let results = index.search(query)
if let result = results.first {
    command = FlowingGraphCanvasNavigation.jumpCommand(
        to: result.id,
        in: sessionID,
        selection: .replace,
        zoom: 1.2
    )
}
```

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
        FlowingMultiSelectOption("Activity", isOn: $showNetwork),
        FlowingMultiSelectOption(
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

`FlowingDayControls` owns the shared typography, spacing, accent, and surface hierarchy.
`FlowingDayPreferences` adds only the window-specific roles. Applications can customize both
layers without rebuilding the components:

```swift
let configuration = PreferencesViewConfiguration(
    applicationName: "Example",
    defaultAccent: accent,
    typography: PreferencesTypography(
        controls: FlowingTypography(
            rowTitle: FlowingTextStyle(
                size: 14,
                weight: .medium,
                fontName: "Avenir Next Medium"
            )
        )
    ),
    surfaces: PreferencesSurfaces(
        controls: FlowingSurfaces(
            card: Color(nsColor: .controlBackgroundColor),
            field: Color(nsColor: .textBackgroundColor)
        )
    )
)
```

The standard surface hierarchy keeps the window canvas, sidebar, content cards, controls, and fields independently configurable. The default content cards use the light Afloat surface rather than the sidebar gray.

Each typography role can set its size, weight, system design, numeral treatment, or an exact installed font name. When `fontName` is present, it identifies the complete font face for that role.

## License

FlowingDayUI is available under the Apache License 2.0.
