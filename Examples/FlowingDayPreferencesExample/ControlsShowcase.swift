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

  var body: some View {
    PreferencesPaneStack {
      checkboxComponents
      multiSelectComponents
      iconCheckboxComponents
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
      footer: "FlowingCheckbox accepts an SF Symbol and can place its indicator at either semantic edge."
    ) {
      FlowingMultiSelect(
        indicatorPlacement: .trailing,
        options: [
          FlowingMultiSelectOption(
            "Eye",
            systemImage: "eye",
            isOn: $eyeSelected
          ),
          FlowingMultiSelectOption(
            "Bolt",
            systemImage: "bolt",
            isOn: $boltSelected
          ),
          FlowingMultiSelectOption(
            "Hare",
            systemImage: "hare",
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
