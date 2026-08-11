# Getting Started with Preferences

Describe pages as application-owned values and present them through the native Preferences window lifecycle.

```swift
import FlowingDayPreferences
import SwiftUI

private enum PreferencesPageID: Hashable {
    case general
}

struct ApplicationPreferences: View {
    @State private var selection = PreferencesPageID.general
    @AppStorage("launchAtLogin") private var launchAtLogin = false

    var body: some View {
        PreferencesView(
            selection: $selection,
            configuration: PreferencesViewConfiguration(
                applicationName: "Example",
                defaultAccent: .petal
            ),
            groups: [
                PreferencesPageGroup(
                    id: "application",
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

Keep one ``PreferencesWindowPresenter`` alive for as long as the application may show the window.

```swift
@MainActor
let preferencesWindow = PreferencesWindowPresenter(
    rootView: ApplicationPreferences()
)

preferencesWindow.show()
```

Use ``PreferencesWindowConfiguration`` to choose the initial, minimum, and maximum sizes. The view remains a normal SwiftUI hierarchy and does not own application persistence or commands.
