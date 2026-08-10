import FlowingDayPreferences
import SwiftUI

struct ControlsShowcase: View {
  @Environment(\.preferencesTypography) private var typography
  @State private var leadingCheckbox = true
  @State private var centeredCheckbox = true
  @State private var trailingCheckbox = true
  @State private var switchValue = true
  @State private var sliderValue = 0.62
  @State private var selectValue = ExampleSelection.second
  @State private var searchValue = "Dublin"
  @State private var disclosureExpanded = true
  @State private var horizontalEqualSelection = ExampleMultiSelectSelection()
  @State private var horizontalFitSelection = ExampleMultiSelectSelection()
  @State private var verticalEqualSelection = ExampleMultiSelectSelection()
  @State private var verticalFitSelection = ExampleMultiSelectSelection()
  @State private var eyeSelected = true
  @State private var boltSelected = false
  @State private var hareSelected = true
  @State private var textSegmentSelection = ExampleSelection.second
  @State private var symbolSegmentSelection = ExampleSelection.second
  @State private var connectedSegmentSelection = ExampleSelection.second
  @State private var selectedTag = "foreground"
  @State private var buttonPressCount = 0
  @State private var textFieldValue = "Flowing Day"
  @State private var colorValue = Color.pink

  private let controlTags = [
    ExampleLabel("FlowingCheckbox"),
    ExampleLabel("FlowingSwitch"),
    ExampleLabel("FlowingSlider"),
    ExampleLabel("FlowingSelect"),
    ExampleLabel("FlowingSearchPicker"),
    ExampleLabel("FlowingTextField"),
    ExampleLabel("FlowingColorPicker"),
    ExampleLabel("FlowingValueText"),
    ExampleLabel("FlowingEmptyState"),
    ExampleLabel("FlowingDisclosure"),
    ExampleLabel("FlowingMultiSelect"),
    ExampleLabel("FlowingSegmentedControl"),
    ExampleLabel("FlowingConnectedSegmentedControl"),
    ExampleLabel("FlowingChip"),
    ExampleLabel("FlowingTag"),
    ExampleLabel("FlowingSelectableTag"),
    ExampleLabel("FlowingSoftButtonStyle"),
  ]

  private let selectableTags = ["fill", "foreground", "wash", "veil", "hairline"]

  var body: some View {
    PreferencesPaneStack {
      switchAndSliderComponents
      selectComponents
      fieldAndValueComponents
      emptyStateComponents
      disclosureComponents
      checkboxComponents
      multiSelectComponents
      iconCheckboxComponents
      segmentedControlComponents
      pillComponents
      layoutComponents
      buttonStyleComponents
    }
  }

  private var fieldAndValueComponents: some View {
    PreferencesSection(
      "Fields & Values",
      footer: "Fields, color selection, and read-only values compose without Preferences row assumptions."
    ) {
      VStack(alignment: .leading, spacing: 14) {
        componentMode("Standard") {
          FlowingTextField(
            "Project name",
            text: $textFieldValue,
            systemImage: "text.cursor"
          )
        }
        componentMode("Accented") {
          FlowingTextField(
            "Search",
            text: $textFieldValue,
            systemImage: "magnifyingglass",
            emphasis: .accented
          )
        }
        HStack(spacing: 16) {
          FlowingColorPicker("Color", selection: $colorValue)
          Spacer(minLength: 12)
          FlowingValueText("cocoa@flowing.day")
        }
      }
      .padding(13)
    }
  }

  private var emptyStateComponents: some View {
    PreferencesSection(
      "Empty State",
      footer: "Use the inline layout inside rows and the stacked layout for an empty surface."
    ) {
      VStack(alignment: .leading, spacing: 18) {
        componentMode("Inline") {
          FlowingEmptyState(
            "No recent items",
            systemImage: "tray",
            layout: .inline
          )
        }
        componentMode("Stacked") {
          FlowingEmptyState(
            "No matching results",
            systemImage: "magnifyingglass",
            layout: .stacked
          )
          .padding(.vertical, 8)
        }
      }
      .padding(13)
    }
  }

  private var disclosureComponents: some View {
    PreferencesSection(
      "Disclosure",
      footer: "The label and expanded content are ordinary SwiftUI views."
    ) {
      FlowingDisclosure("Rendering details", isExpanded: $disclosureExpanded) {
        Text("Reduced motion automatically replaces the offset transition with opacity.")
          .font(typography.value.font)
          .foregroundStyle(.secondary)
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.horizontal, 10)
          .padding(.bottom, 10)
      }
      .padding(3)
    }
  }

  private var selectComponents: some View {
    PreferencesSection(
      "Select",
      footer: "Use the compact select for short lists and the search picker for larger collections."
    ) {
      VStack(alignment: .leading, spacing: 16) {
        FlowingSelect(
          label: "Preview size",
          selection: $selectValue,
          options: [
            FlowingSelectOption(.first, label: "Small"),
            FlowingSelectOption(.second, label: "Medium"),
            FlowingSelectOption(.third, label: "Large"),
          ],
          minimumWidth: 150
        )
        .fixedSize()

        FlowingSearchPicker(
          label: "City",
          selection: $searchValue,
          options: [
            FlowingSelectOption("Amsterdam", label: "Amsterdam"),
            FlowingSelectOption("Berlin", label: "Berlin"),
            FlowingSelectOption("Copenhagen", label: "Copenhagen"),
            FlowingSelectOption("Dublin", label: "Dublin"),
            FlowingSelectOption("Edinburgh", label: "Edinburgh"),
          ],
          maximumVisibleOptions: 3
        )
      }
      .padding(13)
    }
  }

  private var switchAndSliderComponents: some View {
    PreferencesSection(
      "Switch & Slider",
      footer: "Both controls can be composed without a Preferences row."
    ) {
      VStack(alignment: .leading, spacing: 16) {
        FlowingSwitch("Quiet animations", isOn: $switchValue)
        HStack(spacing: 12) {
          FlowingSlider(value: $sliderValue, in: 0...1, step: 0.01)
          Text(sliderValue, format: .percent.precision(.fractionLength(0)))
            .font(typography.value.font)
            .foregroundStyle(.secondary)
            .frame(width: 36, alignment: .trailing)
        }
      }
      .padding(13)
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
          FlowingMultiSelect(
            options: multiSelectOptions(selection: $horizontalEqualSelection)
          )
        }

        componentMode("Horizontal · Fit content") {
          FlowingMultiSelect(
            itemWidthPolicy: .fitContent(maximumWidth: 112),
            truncationMode: .middle,
            options: multiSelectOptions(selection: $horizontalFitSelection)
          )
        }

        componentMode("Vertical · Equal width") {
          FlowingMultiSelect(
            axis: .vertical,
            contentAlignment: .leading,
            options: multiSelectOptions(selection: $verticalEqualSelection)
          )
        }

        componentMode("Vertical · Fit content") {
          FlowingMultiSelect(
            axis: .vertical,
            itemWidthPolicy: .fitContent(maximumWidth: 112),
            contentAlignment: .leading,
            truncationMode: .middle,
            options: multiSelectOptions(selection: $verticalFitSelection)
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
        contentAlignment: .leading,
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

  private func multiSelectOptions(
    selection: Binding<ExampleMultiSelectSelection>
  ) -> [FlowingMultiSelectOption] {
    [
      FlowingMultiSelectOption("Alpha", isOn: selection.alpha),
      FlowingMultiSelectOption("Beta", isOn: selection.beta),
      FlowingMultiSelectOption(
        "Locked",
        isOn: selection.locked,
        isEnabled: false
      ),
    ]
  }

  private var segmentedControlComponents: some View {
    PreferencesSection(
      "Segmented Controls",
      footer: "Connected and separated controls share one option model, keyboard navigation, and accessibility behavior."
    ) {
      VStack(spacing: 12) {
        FlowingSegmentedControl(
          label: "Preview size",
          selection: $textSegmentSelection,
          options: [
            FlowingSegmentOption(.first, label: "Small"),
            FlowingSegmentOption(.second, label: "Medium"),
            FlowingSegmentOption(.third, label: "Large"),
          ]
        )
        FlowingSegmentedControl(
          label: "Preview mode",
          selection: $symbolSegmentSelection,
          options: [
            FlowingSegmentOption(.first, label: "List", systemImage: "list.bullet"),
            FlowingSegmentOption(.second, label: "Grid", systemImage: "square.grid.2x2"),
            FlowingSegmentOption(.third, label: "Canvas", systemImage: "point.3.connected.trianglepath.dotted"),
          ]
        )
        FlowingConnectedSegmentedControl(
          label: "Preview size",
          selection: $connectedSegmentSelection,
          options: [
            FlowingSegmentOption(.first, label: "Small"),
            FlowingSegmentOption(.second, label: "Medium"),
            FlowingSegmentOption(.third, label: "Large"),
          ]
        )
      }
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

struct ExampleMultiSelectSelection: Equatable {
  var alpha = true
  var beta = false
  var locked = false
}
