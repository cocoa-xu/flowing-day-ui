import FlowingDayPreferences
import SwiftUI

struct ControlsShowcase: View {
  @Environment(\.preferencesTypography) private var typography
  @State private var leadingCheckbox = true
  @State private var centeredCheckbox = true
  @State private var trailingCheckbox = true
  @State private var alphaSelected = true
  @State private var betaSelected = false
  @State private var lockedSelected = false
  @State private var eyeSelected = true
  @State private var boltSelected = false
  @State private var hareSelected = true
  @State private var segmentSelection = ExampleSelection.second
  @State private var selectedTag = "foreground"
  @State private var buttonPressCount = 0

  private let controlTags = [
    ExampleLabel("FlowingCheckbox"),
    ExampleLabel("FlowingMultiSelect"),
    ExampleLabel("FlowingConnectedSegmentedControl"),
    ExampleLabel("FlowingChip"),
    ExampleLabel("FlowingTag"),
    ExampleLabel("FlowingSelectableTag"),
    ExampleLabel("FlowingSoftButtonStyle"),
  ]

  private let selectableTags = ["fill", "foreground", "wash", "veil", "hairline"]

  var body: some View {
    PreferencesPaneStack {
      checkboxComponents
      multiSelectComponents
      iconCheckboxComponents
      segmentedControlComponents
      pillComponents
      layoutComponents
      buttonStyleComponents
    }
  }

  private var checkboxComponents: some View {
    PreferencesSection(
      "Checkbox",
      footer: "Checkboxes can share available width or fit their content up to a configurable limit."
    ) {
      VStack(alignment: .leading, spacing: 14) {
        componentMode("Equal width") {
          HStack(spacing: 8) {
            FlowingCheckbox(
              "Leading",
              isOn: $leadingCheckbox,
              contentAlignment: .leading
            )
            FlowingCheckbox(
              "Center",
              isOn: $centeredCheckbox,
              contentAlignment: .center
            )
            FlowingCheckbox(
              "Trailing",
              isOn: $trailingCheckbox,
              contentAlignment: .trailing
            )
          }
        }

        componentMode("Fit content · Middle truncation") {
          HStack(spacing: 8) {
            FlowingCheckbox(
              "Auto",
              isOn: $leadingCheckbox,
              widthPolicy: .fitContent()
            )
            FlowingCheckbox(
              "Quiet",
              isOn: $centeredCheckbox,
              widthPolicy: .fitContent()
            )
            FlowingCheckbox(
              "A very long option",
              isOn: $trailingCheckbox,
              widthPolicy: .fitContent(maximumWidth: 116),
              truncationMode: .middle
            )
          }
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(13)
    }
  }

  private var multiSelectComponents: some View {
    PreferencesSection(
      "Multi-select",
      footer: "The standalone component supports horizontal or vertical layout with equal or content-sized items."
    ) {
      VStack(alignment: .leading, spacing: 14) {
        componentMode("Horizontal · Equal width") {
          FlowingMultiSelect(options: multiSelectOptions)
        }

        componentMode("Horizontal · Fit content") {
          FlowingMultiSelect(
            itemWidthPolicy: .fitContent(maximumWidth: 112),
            truncationMode: .middle,
            options: multiSelectOptions
          )
        }

        componentMode("Vertical · Equal width") {
          FlowingMultiSelect(
            axis: .vertical,
            contentAlignment: .leading,
            options: multiSelectOptions
          )
        }

        componentMode("Vertical · Fit content") {
          FlowingMultiSelect(
            axis: .vertical,
            itemWidthPolicy: .fitContent(maximumWidth: 112),
            contentAlignment: .leading,
            truncationMode: .middle,
            options: multiSelectOptions
          )
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(13)
    }
  }

  private var iconCheckboxComponents: some View {
    PreferencesSection(
      "Icon Checkbox",
      footer: "Each icon option can provide its own accent and place the indicator at either semantic edge."
    ) {
      FlowingMultiSelect(
        indicatorPlacement: .trailing,
        options: [
          FlowingMultiSelectOption(
            "Eye",
            systemImage: "eye",
            accent: .seafoam,
            isOn: $eyeSelected
          ),
          FlowingMultiSelectOption(
            "Bolt",
            systemImage: "bolt",
            accent: .honey,
            isOn: $boltSelected
          ),
          FlowingMultiSelectOption(
            "Hare",
            systemImage: "hare",
            accent: .wisteria,
            isOn: $hareSelected
          ),
        ]
      )
      .padding(13)
    }
  }

  private var multiSelectOptions: [FlowingMultiSelectOption] {
    [
      FlowingMultiSelectOption("Alpha", isOn: $alphaSelected),
      FlowingMultiSelectOption("Beta", isOn: $betaSelected),
      FlowingMultiSelectOption(
        "Locked",
        isOn: $lockedSelected,
        isEnabled: false
      ),
    ]
  }

  private var segmentedControlComponents: some View {
    PreferencesSection(
      "Connected Segmented Control",
      footer: "The standalone control supports keyboard navigation, RTL layout, and accessibility adjustment."
    ) {
      FlowingConnectedSegmentedControl(
        label: "Preview size",
        selection: $segmentSelection,
        options: [
          FlowingSegmentOption(.first, label: "Small"),
          FlowingSegmentOption(.second, label: "Medium"),
          FlowingSegmentOption(.third, label: "Large"),
        ]
      )
      .frame(maxWidth: 320)
      .padding(13)
    }
  }

  private var pillComponents: some View {
    PreferencesSection(
      "Pills",
      footer: "Tags and selectable tags can be placed directly or composed inside a wrapping grid."
    ) {
      VStack(alignment: .leading, spacing: 12) {
        FlowingWrappingGrid(items: controlTags) { item in
          FlowingTag(item.id)
        }
        FlowingWrappingGrid(items: selectableTags.map(ExampleLabel.init)) { item in
          FlowingSelectableTag(
            item.id,
            isSelected: selectedTag == item.id
          ) {
            selectedTag = item.id
          }
        }
      }
      .padding(13)
    }
  }

  private var layoutComponents: some View {
    PreferencesSection(
      "Grids",
      footer: "Wrapping and adaptive grids contain no Preferences-specific padding or row assumptions."
    ) {
      VStack(alignment: .leading, spacing: 14) {
        componentMode("Wrapping") {
          FlowingWrappingGrid(items: selectableTags.map(ExampleLabel.init)) { item in
            FlowingTag(item.id)
          }
        }
        componentMode("Adaptive") {
          FlowingAdaptiveGrid(
            items: selectableTags.map(ExampleLabel.init),
            minimumWidth: 88
          ) { item in
            FlowingChip(item.id.capitalized) {
              selectedTag = item.id
            }
          }
        }
      }
      .padding(13)
    }
  }

  private var buttonStyleComponents: some View {
    PreferencesSection(
      "Button Style",
      footer: "FlowingSoftButtonStyle works with any SwiftUI Button label."
    ) {
      HStack(spacing: 8) {
        Button("Quiet · \(buttonPressCount)") {
          buttonPressCount += 1
        }
        .buttonStyle(FlowingSoftButtonStyle())

        Button("Prominent") {
          buttonPressCount += 1
        }
        .buttonStyle(FlowingSoftButtonStyle(isProminent: true))
      }
      .padding(13)
    }
  }

  private func componentMode<Content: View>(
    _ title: String,
    @ViewBuilder content: () -> Content
  ) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(title.uppercased())
        .font(typography.sectionHeader.font)
        .foregroundStyle(.secondary)
      content()
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}
