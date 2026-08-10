import FlowingDayPreferences
import SwiftUI

struct ControlsShowcase: View {
  @Environment(\.preferencesTypography) private var typography
  @State private var checkboxValue = true
  @State private var checkboxAlignment = FlowingCheckboxContentAlignment.leading
  @State private var checkboxIndicator = FlowingCheckboxIndicatorPlacement.leading
  @State private var checkboxWidth = ExampleControlWidth.fill
  @State private var switchValue = true
  @State private var sliderValue = 0.62
  @State private var selectValue = ExampleSelection.second
  @State private var searchValue = "Dublin"
  @State private var disclosureExpanded = true
  @State private var multiSelectSelection = ExampleMultiSelectSelection()
  @State private var multiSelectAxis = ExampleControlAxis.horizontal
  @State private var multiSelectWidth = ExampleControlWidth.fill
  @State private var multiSelectIndicator = FlowingCheckboxIndicatorPlacement.leading
  @State private var eyeSelected = true
  @State private var boltSelected = false
  @State private var hareSelected = true
  @State private var segmentSelection = ExampleSelection.second
  @State private var segmentPresentation = ExampleSegmentPresentation.separated
  @State private var segmentContent = ExampleSegmentContent.text
  @State private var selectedTag = "foreground"
  @State private var buttonPressCount = 0
  @State private var textFieldValue = "Flowing Day"
  @State private var colorValue = Color.pink
  @State private var secureFieldValue = "gentle-morning"
  @State private var textAreaValue = "A quiet place for longer thoughts."
  @State private var inputKind = ExampleInputKind.text
  @State private var inputEmphasis = FlowingTextFieldEmphasis.standard
  @State private var inputValidation = ExampleInputValidation.helper
  @State private var inputHasIcon = true
  @State private var dateValue = Date.now
  @State private var dateComponents = FlowingDatePickerComponents.dateAndTime
  @State private var iconButtonSelected = true
  @State private var iconButtonEnabled = true
  @State private var iconButtonEmphasis = FlowingIconButtonEmphasis.quiet
  @State private var progressKind = ExampleProgressKind.determinate
  @State private var progressValue = 0.62
  @State private var radioSelection = ExampleRadioSelection.balanced
  @State private var radioAxis = ExampleControlAxis.horizontal
  @State private var stepperValue = 3
  @State private var statusTone = FlowingStatusTone.informational
  @State private var badgeEmphasis = FlowingBadgeEmphasis.subtle
  @State private var calloutPresentation = FlowingCalloutPresentation.card
  @State private var lastMenuAction = "None"

  private let controlTags = [
    ExampleLabel("FlowingCheckbox"),
    ExampleLabel("FlowingSwitch"),
    ExampleLabel("FlowingSlider"),
    ExampleLabel("FlowingSelect"),
    ExampleLabel("FlowingSearchPicker"),
    ExampleLabel("FlowingTextField"),
    ExampleLabel("FlowingSecureField"),
    ExampleLabel("FlowingTextArea"),
    ExampleLabel("FlowingDatePicker"),
    ExampleLabel("FlowingColorPicker"),
    ExampleLabel("FlowingValueText"),
    ExampleLabel("FlowingEmptyState"),
    ExampleLabel("FlowingIconButton"),
    ExampleLabel("FlowingProgress"),
    ExampleLabel("FlowingDisclosure"),
    ExampleLabel("FlowingMultiSelect"),
    ExampleLabel("FlowingSegmentedControl"),
    ExampleLabel("FlowingConnectedSegmentedControl"),
    ExampleLabel("FlowingChip"),
    ExampleLabel("FlowingTag"),
    ExampleLabel("FlowingSelectableTag"),
    ExampleLabel("FlowingSoftButtonStyle"),
    ExampleLabel("FlowingRadio"),
    ExampleLabel("FlowingRadioGroup"),
    ExampleLabel("FlowingStepper"),
    ExampleLabel("FlowingSeparator"),
    ExampleLabel("FlowingBadge"),
    ExampleLabel("FlowingCallout"),
    ExampleLabel("FlowingMenu"),
    ExampleLabel("FlowingCard"),
    ExampleLabel("FlowingSection"),
  ]

  private let selectableTags = ["fill", "foreground", "wash", "veil", "hairline"]

  var body: some View {
    PreferencesPaneStack {
      switchAndSliderComponents
      selectComponents
      fieldAndValueComponents
      dateAndTimeComponents
      iconButtonComponents
      progressComponents
      radioAndStepperComponents
      statusComponents
      containerComponents
      menuAndSeparatorComponents
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

  private var radioAndStepperComponents: some View {
    PreferencesSection(
      "Radio & Stepper",
      footer: "Radio groups preserve exclusive selection while steppers clamp values "
        + "to their range."
    ) {
      componentPlayground {
        HStack(spacing: 24) {
          FlowingRadioGroup(
            label: "Rendering priority",
            selection: $radioSelection,
            options: ExampleRadioSelection.allCases.map {
              FlowingRadioOption($0, label: $0.title, systemImage: $0.systemImage)
            },
            axis: radioAxis.axis
          )
          Spacer(minLength: 12)
          FlowingStepper(
            "Preview count",
            value: $stepperValue,
            in: 1...8,
            step: 1
          ) { "\($0) previews" }
        }
      } options: {
        playgroundOption("Radio axis") {
          FlowingConnectedSegmentedControl(
            label: "Radio axis",
            selection: $radioAxis,
            options: ExampleControlAxis.allCases.map {
              FlowingSegmentOption($0, label: $0.title)
            }
          )
        }
      }
    }
  }

  private var statusComponents: some View {
    PreferencesSection(
      "Status & Feedback",
      footer: "Badges and callouts share semantic tones without fixing application-specific copy."
    ) {
      componentPlayground {
        VStack(alignment: .leading, spacing: 12) {
          FlowingWrappingGrid(items: FlowingStatusTone.allCases.map(ExampleStatusTone.init)) {
            FlowingBadge(
              $0.title,
              systemImage: $0.value.defaultBadgeSystemImage,
              tone: $0.value,
              emphasis: badgeEmphasis
            )
          }
          FlowingCallout(
            "The preview updates immediately while the document remains unchanged.",
            title: "Preview Ready",
            tone: statusTone,
            presentation: calloutPresentation
          )
        }
      } options: {
        playgroundOption("Tone") {
          FlowingConnectedSegmentedControl(
            label: "Status tone",
            selection: $statusTone,
            options: FlowingStatusTone.allCases.map {
              FlowingSegmentOption($0, label: $0.title)
            }
          )
        }
        HStack(spacing: 10) {
          playgroundOption("Badge") {
            FlowingConnectedSegmentedControl(
              label: "Badge emphasis",
              selection: $badgeEmphasis,
              options: FlowingBadgeEmphasis.allCases.map {
                FlowingSegmentOption($0, label: $0.title)
              }
            )
          }
          playgroundOption("Callout") {
            FlowingConnectedSegmentedControl(
              label: "Callout presentation",
              selection: $calloutPresentation,
              options: FlowingCalloutPresentation.allCases.map {
                FlowingSegmentOption($0, label: $0.title)
              }
            )
          }
        }
      }
    }
  }

  private var menuAndSeparatorComponents: some View {
    PreferencesSection(
      "Menu & Separator",
      footer: "Action menus retain native menu behavior while separators remain layout-neutral."
    ) {
      VStack(alignment: .leading, spacing: 13) {
        HStack(spacing: 12) {
          FlowingMenu("Actions", systemImage: "ellipsis.circle", minimumWidth: 112) {
            Button("Duplicate") { lastMenuAction = "Duplicate" }
            Button("Archive") { lastMenuAction = "Archive" }
            Divider()
            Button("Remove", role: .destructive) { lastMenuAction = "Remove" }
          }
          FlowingSeparator(axis: .vertical)
            .frame(height: 24)
          FlowingValueText(lastMenuAction)
        }
        FlowingSeparator()
        Text("Separators can divide either axis without inheriting Preferences row insets.")
          .font(typography.body.font)
          .foregroundStyle(.secondary)
      }
      .padding(13)
    }
  }

  private var fieldAndValueComponents: some View {
    PreferencesSection(
      "Fields & Values",
      footer: "Choose an input type and emphasis to inspect the same field family in place."
    ) {
      componentPlayground {
        inputPreview
      } options: {
        playgroundOption("Input type") {
          FlowingConnectedSegmentedControl(
            label: "Input type",
            selection: $inputKind,
            options: ExampleInputKind.allCases.map {
              FlowingSegmentOption($0, label: $0.title)
            }
          )
        }
        playgroundOption("Emphasis") {
          FlowingConnectedSegmentedControl(
            label: "Emphasis",
            selection: $inputEmphasis,
            options: FlowingTextFieldEmphasis.allCases.map {
              FlowingSegmentOption($0, label: $0.title)
            }
          )
        }
        playgroundOption("Validation") {
          FlowingConnectedSegmentedControl(
            label: "Validation",
            selection: $inputValidation,
            options: ExampleInputValidation.allCases.map {
              FlowingSegmentOption($0, label: $0.title)
            }
          )
        }
        FlowingCheckbox(
          "Leading icon",
          isOn: $inputHasIcon,
          widthPolicy: .fitContent()
        )
        HStack(spacing: 16) {
          FlowingColorPicker("Color", selection: $colorValue)
          Spacer(minLength: 12)
          FlowingValueText("cocoa@flowing.day")
        }
      }
    }
  }

  private var dateAndTimeComponents: some View {
    PreferencesSection(
      "Date & Time",
      footer: "The wrapper preserves native date editing, locale formatting, and keyboard behavior."
    ) {
      componentPlayground {
        FlowingDatePicker(
          "Scheduled for",
          selection: $dateValue,
          components: dateComponents
        )
      } options: {
        playgroundOption("Components") {
          FlowingConnectedSegmentedControl(
            label: "Date components",
            selection: $dateComponents,
            options: FlowingDatePickerComponents.allCases.map {
              FlowingSegmentOption($0, label: $0.title)
            }
          )
        }
      }
    }
  }

  private var containerComponents: some View {
    FlowingSection(
      "Cards & Sections",
      footer: "Both containers work independently from Preferences pages and rows.",
      contentInsets: EdgeInsets(top: 13, leading: 13, bottom: 13, trailing: 13)
    ) {
      HStack(spacing: 11) {
        Image(systemName: "square.stack.3d.up")
          .font(.system(size: 16, weight: .medium))
          .foregroundStyle(.secondary)
          .frame(width: 28, height: 28)
        VStack(alignment: .leading, spacing: 2) {
          Text("Composable surfaces")
            .font(typography.rowTitle.font)
          Text("Cards provide the surface; sections add hierarchy and supporting copy.")
            .font(typography.rowCaption.font)
            .foregroundStyle(.secondary)
        }
      }
    }
  }

  private var iconButtonComponents: some View {
    PreferencesSection(
      "Icon Buttons",
      footer: "Every icon-only action retains a tooltip and accessibility label."
    ) {
      componentPlayground {
        FlowingIconButton(
          "Pin",
          systemImage: "pin",
          emphasis: iconButtonEmphasis,
          isSelected: iconButtonSelected
        ) {
          iconButtonSelected.toggle()
        }
        .disabled(!iconButtonEnabled)
      } options: {
        playgroundOption("Emphasis") {
          FlowingConnectedSegmentedControl(
            label: "Emphasis",
            selection: $iconButtonEmphasis,
            options: FlowingIconButtonEmphasis.allCases.map {
              FlowingSegmentOption($0, label: $0.title)
            }
          )
        }
        HStack(spacing: 8) {
          FlowingCheckbox(
            "Selected",
            isOn: $iconButtonSelected,
            widthPolicy: .fitContent()
          )
          FlowingCheckbox(
            "Enabled",
            isOn: $iconButtonEnabled,
            widthPolicy: .fitContent()
          )
        }
      }
    }
  }

  private var progressComponents: some View {
    PreferencesSection(
      "Progress",
      footer: "The custom value track keeps its accent even when the window becomes inactive."
    ) {
      componentPlayground {
        if progressKind == .determinate {
          FlowingProgress("Preparing preview", value: progressValue)
        } else {
          FlowingProgress("Waiting for changes")
        }
      } options: {
        playgroundOption("Progress type") {
          FlowingConnectedSegmentedControl(
            label: "Progress type",
            selection: $progressKind,
            options: ExampleProgressKind.allCases.map {
              FlowingSegmentOption($0, label: $0.title)
            }
          )
        }
        FlowingDisclosureContent(isExpanded: progressKind == .determinate) {
          HStack(spacing: 12) {
            FlowingSlider(value: $progressValue, in: 0...1, step: 0.01)
            Text(progressValue, format: .percent.precision(.fractionLength(0)))
              .font(typography.value.font)
              .foregroundStyle(.secondary)
              .frame(width: 36, alignment: .trailing)
          }
        }
      }
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
      footer: "Alignment, indicator placement, and width policy are independent choices."
    ) {
      componentPlayground {
        FlowingCheckbox(
          "Notifications",
          isOn: $checkboxValue,
          contentAlignment: checkboxAlignment,
          indicatorPlacement: checkboxIndicator,
          widthPolicy: checkboxWidth.checkboxPolicy
        )
      } options: {
        playgroundOption("Content alignment") {
          FlowingConnectedSegmentedControl(
            label: "Content alignment",
            selection: $checkboxAlignment,
            options: FlowingCheckboxContentAlignment.allCases.map {
              FlowingSegmentOption($0, label: $0.title)
            }
          )
        }
        HStack(spacing: 10) {
          playgroundOption("Indicator") {
            FlowingConnectedSegmentedControl(
              label: "Indicator placement",
              selection: $checkboxIndicator,
              options: FlowingCheckboxIndicatorPlacement.allCases.map {
                FlowingSegmentOption($0, label: $0.title)
              }
            )
          }
          playgroundOption("Width") {
            FlowingConnectedSegmentedControl(
              label: "Width policy",
              selection: $checkboxWidth,
              options: ExampleControlWidth.allCases.map {
                FlowingSegmentOption($0, label: $0.title)
              }
            )
          }
        }
      }
    }
  }

  private var multiSelectComponents: some View {
    PreferencesSection(
      "Multi-select",
      footer: "One option model supports both axes, width policies, and indicator edges."
    ) {
      componentPlayground {
        FlowingMultiSelect(
          axis: multiSelectAxis.axis,
          itemWidthPolicy: multiSelectWidth.multiSelectPolicy,
          contentAlignment: .leading,
          indicatorPlacement: multiSelectIndicator,
          truncationMode: .middle,
          options: multiSelectOptions(selection: $multiSelectSelection)
        )
      } options: {
        HStack(spacing: 10) {
          playgroundOption("Axis") {
            FlowingConnectedSegmentedControl(
              label: "Axis",
              selection: $multiSelectAxis,
              options: ExampleControlAxis.allCases.map {
                FlowingSegmentOption($0, label: $0.title)
              }
            )
          }
          playgroundOption("Width") {
            FlowingConnectedSegmentedControl(
              label: "Width policy",
              selection: $multiSelectWidth,
              options: ExampleControlWidth.allCases.map {
                FlowingSegmentOption($0, label: $0.title)
              }
            )
          }
        }
        playgroundOption("Indicator") {
          FlowingConnectedSegmentedControl(
            label: "Indicator placement",
            selection: $multiSelectIndicator,
            options: FlowingCheckboxIndicatorPlacement.allCases.map {
              FlowingSegmentOption($0, label: $0.title)
            }
          )
        }
      }
    }
  }

  private var iconCheckboxComponents: some View {
    PreferencesSection(
      "Icon Checkbox",
      footer: "Each icon option can provide its own accent and place the indicator "
        + "at either semantic edge."
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
      footer: "Connected and separated presentations share the same option model and selection."
    ) {
      componentPlayground {
        if segmentPresentation == .connected {
          FlowingConnectedSegmentedControl(
            label: "Preview",
            selection: $segmentSelection,
            options: segmentOptions
          )
        } else {
          FlowingSegmentedControl(
            label: "Preview",
            selection: $segmentSelection,
            options: segmentOptions
          )
        }
      } options: {
        HStack(spacing: 10) {
          playgroundOption("Presentation") {
            FlowingConnectedSegmentedControl(
              label: "Presentation",
              selection: $segmentPresentation,
              options: ExampleSegmentPresentation.allCases.map {
                FlowingSegmentOption($0, label: $0.title)
              }
            )
          }
          playgroundOption("Content") {
            FlowingConnectedSegmentedControl(
              label: "Content",
              selection: $segmentContent,
              options: ExampleSegmentContent.allCases.map {
                FlowingSegmentOption($0, label: $0.title)
              }
            )
          }
        }
      }
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
      footer: "Wrapping and adaptive grids contain no Preferences-specific padding "
        + "or row assumptions."
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

  @ViewBuilder
  private var inputPreview: some View {
    switch inputKind {
    case .text:
      FlowingTextField(
        "Project name",
        text: $textFieldValue,
        systemImage: inputHasIcon ? "text.cursor" : nil,
        emphasis: inputEmphasis,
        supportingText: inputValidation.supportingText,
        validation: inputValidation.validation
      )
    case .secure:
      FlowingSecureField(
        "Password",
        text: $secureFieldValue,
        systemImage: inputHasIcon ? "lock" : nil,
        emphasis: inputEmphasis,
        supportingText: inputValidation.supportingText,
        validation: inputValidation.validation
      )
    case .multiline:
      FlowingTextArea(
        "Notes",
        text: $textAreaValue,
        systemImage: inputHasIcon ? "text.alignleft" : nil,
        emphasis: inputEmphasis,
        supportingText: inputValidation.supportingText,
        validation: inputValidation.validation
      )
    }
  }

  private var segmentOptions: [FlowingSegmentOption<ExampleSelection>] {
    switch segmentContent {
    case .text:
      [
        FlowingSegmentOption(.first, label: "Small"),
        FlowingSegmentOption(.second, label: "Medium"),
        FlowingSegmentOption(.third, label: "Large"),
      ]
    case .symbols:
      [
        FlowingSegmentOption(.first, label: "List", systemImage: "list.bullet"),
        FlowingSegmentOption(.second, label: "Grid", systemImage: "square.grid.2x2"),
        FlowingSegmentOption(.third, label: "Columns", systemImage: "rectangle.split.3x1"),
      ]
    }
  }

  private func componentPlayground<Preview: View, Options: View>(
    @ViewBuilder preview: () -> Preview,
    @ViewBuilder options: () -> Options
  ) -> some View {
    VStack(alignment: .leading, spacing: 14) {
      componentMode("Preview") {
        preview()
      }
      Rectangle()
        .fill(PreferencesPalette.hairline)
        .frame(height: 1)
      componentMode("Options") {
        VStack(alignment: .leading, spacing: 10) {
          options()
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(13)
  }

  private func playgroundOption<Content: View>(
    _ title: String,
    @ViewBuilder content: () -> Content
  ) -> some View {
    VStack(alignment: .leading, spacing: 5) {
      Text(title)
        .font(typography.rowCaption.font)
        .foregroundStyle(.secondary)
      content()
    }
    .frame(maxWidth: .infinity, alignment: .leading)
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

enum ExampleInputKind: String, CaseIterable, Hashable {
  case text
  case secure
  case multiline

  var title: String {
    switch self {
    case .text: "Text"
    case .secure: "Secure"
    case .multiline: "Multiline"
    }
  }
}

enum ExampleInputValidation: String, CaseIterable, Hashable {
  case helper
  case success
  case warning
  case error

  var title: String { rawValue.capitalized }

  var supportingText: String? {
    self == .helper ? "Use a short, memorable name." : nil
  }

  var validation: FlowingFieldValidation {
    switch self {
    case .helper: .none
    case .success: .success("Ready to use.")
    case .warning: .warning("This value may be difficult to recognize.")
    case .error: .error("Enter a value before continuing.")
    }
  }
}

enum ExampleControlWidth: String, CaseIterable, Hashable {
  case fill
  case fit

  var title: String {
    switch self {
    case .fill: "Fill"
    case .fit: "Fit"
    }
  }

  var checkboxPolicy: FlowingCheckboxWidthPolicy {
    switch self {
    case .fill: .fill
    case .fit: .fitContent(maximumWidth: 160)
    }
  }

  var multiSelectPolicy: FlowingMultiSelectItemWidthPolicy {
    switch self {
    case .fill: .equal
    case .fit: .fitContent(maximumWidth: 112)
    }
  }
}

enum ExampleControlAxis: String, CaseIterable, Hashable {
  case horizontal
  case vertical

  var title: String { rawValue.capitalized }

  var axis: Axis {
    switch self {
    case .horizontal: .horizontal
    case .vertical: .vertical
    }
  }
}

enum ExampleSegmentPresentation: String, CaseIterable, Hashable {
  case separated
  case connected

  var title: String { rawValue.capitalized }
}

enum ExampleSegmentContent: String, CaseIterable, Hashable {
  case text
  case symbols

  var title: String { rawValue.capitalized }
}

enum ExampleProgressKind: String, CaseIterable, Hashable {
  case determinate
  case ongoing

  var title: String { rawValue.capitalized }
}

enum ExampleRadioSelection: String, CaseIterable, Hashable {
  case quiet
  case balanced
  case vivid

  var title: String { rawValue.capitalized }

  var systemImage: String {
    switch self {
    case .quiet: "moon"
    case .balanced: "circle.lefthalf.filled"
    case .vivid: "sun.max"
    }
  }
}

struct ExampleStatusTone: Identifiable {
  let value: FlowingStatusTone
  var id: FlowingStatusTone { value }
  var title: String { value.title }

  init(_ value: FlowingStatusTone) {
    self.value = value
  }
}

extension FlowingStatusTone {
  fileprivate var title: String { rawValue.capitalized }

  fileprivate var defaultBadgeSystemImage: String {
    switch self {
    case .neutral: "circle"
    case .accent: "sparkles"
    case .informational: "info.circle"
    case .success: "checkmark.circle"
    case .warning: "exclamationmark.triangle"
    case .critical: "xmark.octagon"
    }
  }
}

extension FlowingBadgeEmphasis {
  fileprivate var title: String { rawValue.capitalized }
}

extension FlowingCalloutPresentation {
  fileprivate var title: String { rawValue.capitalized }
}

extension FlowingTextFieldEmphasis {
  fileprivate var title: String { rawValue.capitalized }
}

extension FlowingDatePickerComponents {
  fileprivate var title: String {
    switch self {
    case .date: "Date"
    case .time: "Time"
    case .dateAndTime: "Both"
    }
  }
}

extension FlowingIconButtonEmphasis {
  fileprivate var title: String { rawValue.capitalized }
}

extension FlowingCheckboxContentAlignment {
  fileprivate var title: String { rawValue.capitalized }
}

extension FlowingCheckboxIndicatorPlacement {
  fileprivate var title: String { rawValue.capitalized }
}
