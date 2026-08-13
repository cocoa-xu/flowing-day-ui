# Getting Started with Controls

Compose a control directly in any SwiftUI hierarchy and keep its state in the application.

## Add the product

Add the package dependency, then include `FlowingDayControls` in the dependencies of your application target.

```swift
.package(
    url: "https://github.com/cocoa-xu/flowing-day-ui",
    from: "2.4.0"
)
```

## Build a small interface

Every interactive control requires a meaningful label. Hide the visible label only when nearby content already communicates the same purpose; the semantic label remains available to assistive technologies.

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

Use ``FlowingSection`` when a title and supporting footer belong to a collection of controls. Use ``FlowingCard`` when the surrounding application already supplies that context.
