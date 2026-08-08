import FlowingDayPreferences
import SwiftUI

struct AppearanceShowcase: View {
  @Binding var appearance: ExampleAppearance
  @Binding var accent: ExampleAccent
  @Binding var customAccent: Color
  @Binding var corners: ExampleCorners
  @Binding var showsSeparators: Bool

  var body: some View {
    PreferencesPaneStack {
      PreferencesSection(
        "Theme",
        footer:
          "These controls update PreferencesViewConfiguration for the window that contains them."
      ) {
        PreferencesSegmentedRow(
          symbol: "circle.lefthalf.filled",
          title: "Appearance",
          controlWidth: 240,
          selection: $appearance,
          options: [
            PreferencesPopupOption(.system, label: "System"),
            PreferencesPopupOption(.light, label: "Light"),
            PreferencesPopupOption(.dark, label: "Dark"),
          ]
        )
        separator
        PreferencesPopupRow(
          symbol: "swatchpalette",
          title: "Accent",
          selection: $accent,
          options: ExampleAccent.allCases.map {
            PreferencesPopupOption($0, label: $0.title)
          }
        )
        separator
        PreferencesColorPickerRow(
          symbol: "eyedropper",
          title: "Custom Accent",
          caption: "Choosing a color selects the Custom accent preset.",
          selection: $customAccent
        )
      }

      PreferencesSection(
        "Surfaces",
        footer:
          "Window, card, and control radii come from PreferencesViewConfiguration and PreferencesMetrics."
      ) {
        PreferencesSegmentedRow(
          title: "Corners",
          controlWidth: 260,
          selection: $corners,
          options: [
            PreferencesPopupOption(.soft, label: "Soft"),
            PreferencesPopupOption(.medium, label: "Medium"),
            PreferencesPopupOption(.sharp, label: "Sharp"),
          ]
        )
        separator
        PreferencesSwitchRow(
          title: "Row Separators",
          caption: "Hairlines between the rows in this page.",
          isOn: $showsSeparators
        )
      }
    }
  }

  @ViewBuilder
  private var separator: some View {
    if showsSeparators {
      PreferencesRowSeparator(isIndented: true)
    }
  }
}

struct LayoutShowcase: View {
  @Binding var density: ExampleDensity
  @Binding var contentWidth: ExampleContentWidth
  @Binding var sidebarWidth: Double

  var body: some View {
    PreferencesPaneStack {
      PreferencesSection(
        "Density",
        footer: "Row insets and section spacing are live PreferencesMetrics values."
      ) {
        PreferencesSegmentedRow(
          title: "Row Density",
          controlWidth: 260,
          selection: $density,
          options: [
            PreferencesPopupOption(.compact, label: "Compact"),
            PreferencesPopupOption(.standard, label: "Default"),
            PreferencesPopupOption(.roomy, label: "Roomy"),
          ]
        )
      }

      PreferencesSection(
        "Measure",
        footer: "Both controls resize the Preferences view while you interact with them."
      ) {
        PreferencesSegmentedRow(
          symbol: "arrow.left.and.right",
          title: "Content Width",
          controlWidth: 240,
          selection: $contentWidth,
          options: [
            PreferencesPopupOption(.narrow, label: "560"),
            PreferencesPopupOption(.standard, label: "720"),
            PreferencesPopupOption(.wide, label: "860"),
          ]
        )
        PreferencesRowSeparator()
        PreferencesSliderRow(
          title: "Sidebar Width",
          caption: "PreferencesViewConfiguration.sidebarWidth follows the slider.",
          value: $sidebarWidth,
          in: 180...320,
          step: 1
        ) { "\(Int($0)) pt" }
      }
    }
  }
}

struct TypographyShowcase: View {
  @Binding var textScale: ExampleTextScale
  @Binding var headingFace: PreferencesFontDesign

  var body: some View {
    PreferencesPaneStack {
      PreferencesSection(
        "Scale",
        footer: "PreferencesTypography exposes a semantic text style for each role in the window."
      ) {
        PreferencesSegmentedRow(
          title: "Type Scale",
          controlWidth: 260,
          selection: $textScale,
          options: [
            PreferencesPopupOption(.small, label: "Small"),
            PreferencesPopupOption(.standard, label: "Default"),
            PreferencesPopupOption(.large, label: "Large"),
          ]
        )
        PreferencesRowSeparator()
        PreferencesSegmentedRow(
          title: "Heading Face",
          caption: "Applies to the page title and brand block.",
          controlWidth: 300,
          selection: $headingFace,
          options: [
            PreferencesPopupOption(.standard, label: "System"),
            PreferencesPopupOption(.rounded, label: "Rounded"),
            PreferencesPopupOption(.serif, label: "Serif"),
            PreferencesPopupOption(.monospaced, label: "Mono"),
          ]
        )
      }
    }
  }
}

struct MotionShowcase: View {
  @State private var showsGroup = true
  @State private var isExpanded = false
  @State private var fades = true
  @State private var offsets = true
  @State private var clips = false

  var body: some View {
    PreferencesPaneStack {
      PreferencesSection(
        "Switch Group",
        footer: "PreferencesSwitchGroup coordinates its switch with PreferencesDependentRows."
      ) {
        PreferencesSwitchGroup(
          symbol: "hare",
          title: "PreferencesSwitchGroup",
          caption: "Toggle the component to reveal or collapse its rows.",
          isOn: $showsGroup
        ) {
          PreferencesRow(
            title: "PreferencesDependentRows",
            caption: "Height, opacity, and offset animate together."
          )
          PreferencesRowSeparator(isIndented: true)
          PreferencesMultiSelectRow(
            title: "Transition",
            controlWidth: 300,
            options: [
              PreferencesMultiSelectOption("Fade", isOn: $fades),
              PreferencesMultiSelectOption("Offset", isOn: $offsets),
              PreferencesMultiSelectOption("Clip", isOn: $clips),
            ]
          )
        }
      }

      PreferencesSection(
        "Expandable Row",
        footer: "Reduce Motion removes nonessential movement while preserving state changes."
      ) {
        PreferencesExpandableRow(
          symbol: "bolt",
          title: "PreferencesExpandableRow",
          caption: "The complete row is the disclosure target.",
          isExpanded: $isExpanded
        )
        PreferencesDependentRows(isVisible: isExpanded) {
          PreferencesEmptyRow(
            "PreferencesDependentRows owns this reveal.",
            symbol: "list.bullet"
          )
        }
      }
    }
  }
}

struct IconsShowcase: View {
  var body: some View {
    PreferencesPaneStack {
      PreferencesSection(
        "SF Symbols",
        footer:
          "Rows accept SF Symbol names directly; pages can also use app or custom NSImage artwork."
      ) {
        PreferencesRow(
          symbol: "sparkles",
          title: "Symbol Gutter",
          caption: "Pass symbol: to any component that supports a leading icon."
        )
        PreferencesRowSeparator(isIndented: true)
        PreferencesRow(
          symbol: "app.dashed",
          title: "Page Icons",
          caption: "PreferencesPageIcon supports system, application, image, and template artwork."
        )
      }

      PreferencesSection(
        "Accent Scope",
        footer: "This page declares its own PreferencesAccent without changing the other pages."
      ) {
        PreferencesRow(
          symbol: "swatchpalette",
          title: "PreferencesPage(accent:)",
          caption: "The sidebar item, page header, and controls share the scoped accent."
        )
      }
    }
  }
}

struct ComponentsShowcase: View {
  @Binding var accent: ExampleAccent
  @State private var switchValue = true
  @State private var popupValue = ExampleSelection.second
  @State private var sliderValue = 64.0
  @State private var colorValue = ExampleAccent.celadon.color
  @State private var searchValue = "Dublin"
  @State private var segmentedValue = ExampleSelection.second
  @State private var symbolValue = ExampleSymbol.eye
  @State private var alphaSelected = true
  @State private var betaSelected = false
  @State private var lockedSelected = false
  @State private var eyeSelected = true
  @State private var boltSelected = false
  @State private var hareSelected = true
  @State private var expanded = false
  @State private var selectedTag = "fill"
  @State private var pressCount = 0

  private let componentTags = [
    ExampleLabel("PreferencesRow"),
    ExampleLabel("PreferencesSlider"),
    ExampleLabel("PreferencesChip"),
    ExampleLabel("PreferencesTag"),
    ExampleLabel("PreferencesGrid"),
    ExampleLabel("PreferencesFlowGrid"),
    ExampleLabel("PreferencesEmptyRow"),
    ExampleLabel("PreferencesValueRow"),
    ExampleLabel("PreferencesLinkRow"),
    ExampleLabel("PreferencesButtonRow"),
    ExampleLabel("PreferencesExpandableRow"),
    ExampleLabel("PreferencesSelectableTag"),
    ExampleLabel("PreferencesColorPickerRow"),
    ExampleLabel("PreferencesSearchPickerRow"),
    ExampleLabel("PreferencesSoftButtonStyle"),
  ]

  private let selectableTags = ["fill", "foreground", "wash", "veil", "hairline"]

  var body: some View {
    PreferencesPaneStack {
      rowComponents
      disclosureComponents
      searchComponent
      selectionComponents
      iconSelectionComponents
      pillComponents
      gridComponents
    }
  }

  private var rowComponents: some View {
    PreferencesSection("Rows") {
      PreferencesRow(
        symbol: "list.bullet",
        title: "PreferencesRow",
        caption: "Symbol gutter, title, caption, and a trailing view."
      )
      PreferencesRowSeparator(isIndented: true)
      PreferencesSwitchRow(title: "PreferencesSwitchRow", isOn: $switchValue)
      PreferencesRowSeparator()
      PreferencesPopupRow(
        title: "PreferencesPopupRow",
        minimumControlWidth: 180,
        selection: $popupValue,
        options: selectionOptions
      )
      PreferencesRowSeparator()
      PreferencesSliderRow(
        title: "PreferencesSliderRow",
        caption: "Formatted value above the native slider.",
        value: $sliderValue,
        in: 0...100,
        step: 1
      ) { "\(Int($0))" }
      PreferencesRowSeparator()
      PreferencesValueRow(
        symbol: "number",
        title: "PreferencesValueRow",
        value: "Pressed \(pressCount) times"
      )
      PreferencesRowSeparator(isIndented: true)
      PreferencesButtonRow(
        title: "PreferencesButtonRow",
        caption: "Invokes the action supplied by its owner.",
        buttonTitle: "Press"
      ) {
        pressCount += 1
      }
      PreferencesRowSeparator()
      PreferencesLinkRow(
        title: "PreferencesLinkRow",
        caption: "Opens a URL with a tooltip.",
        buttonTitle: "Source",
        destination: ExampleLinks.repository,
        help: "Open FlowingDayUI on GitHub"
      )
      PreferencesRowSeparator()
      PreferencesColorPickerRow(
        title: "PreferencesColorPickerRow",
        caption: "Uses the native platform color picker.",
        selection: $colorValue
      )
    }
  }

  private var disclosureComponents: some View {
    PreferencesSection(
      "Disclosure",
      footer: "PreferencesEmptyRow provides the empty state for a section."
    ) {
      PreferencesExpandableRow(
        title: "PreferencesExpandableRow",
        caption: "Pair it with PreferencesDependentRows.",
        isExpanded: $expanded
      )
      PreferencesDependentRows(isVisible: expanded) {
        PreferencesEmptyRow(
          "PreferencesEmptyRow — nothing here yet.",
          symbol: "list.bullet"
        )
      }
    }
  }

  private var searchComponent: some View {
    PreferencesSection(
      "Search",
      footer: "PreferencesSearchPickerRow is designed for a list too long for a popup menu."
    ) {
      PreferencesSearchPickerRow(
        title: "PreferencesSearchPickerRow",
        maximumVisibleOptions: 4,
        selection: $searchValue,
        options: [
          PreferencesPopupOption("Amsterdam", label: "Amsterdam"),
          PreferencesPopupOption("Berlin", label: "Berlin"),
          PreferencesPopupOption("Copenhagen", label: "Copenhagen"),
          PreferencesPopupOption("Dublin", label: "Dublin"),
          PreferencesPopupOption("Edinburgh", label: "Edinburgh"),
          PreferencesPopupOption("Florence", label: "Florence"),
          PreferencesPopupOption("Geneva", label: "Geneva"),
          PreferencesPopupOption("Helsinki", label: "Helsinki"),
        ]
      )
    }
  }

  private var selectionComponents: some View {
    PreferencesSection("Selection") {
      PreferencesSegmentedRow(
        title: "PreferencesSegmentedRow",
        controlWidth: 240,
        selection: $segmentedValue,
        options: selectionOptions
      )
      PreferencesRowSeparator()
      PreferencesSymbolSegmentedRow(
        title: "PreferencesSymbolSegmentedRow",
        controlWidth: 180,
        selection: $symbolValue,
        options: [
          PreferencesSymbolSegmentOption(.eye, label: "Eye", symbol: "eye"),
          PreferencesSymbolSegmentOption(.bolt, label: "Bolt", symbol: "bolt"),
          PreferencesSymbolSegmentOption(.hare, label: "Hare", symbol: "hare"),
        ]
      )
      PreferencesRowSeparator()
      PreferencesMultiSelectRow(
        title: "PreferencesMultiSelectRow",
        controlWidth: 300,
        options: [
          PreferencesMultiSelectOption("Alpha", isOn: $alphaSelected),
          PreferencesMultiSelectOption("Beta", isOn: $betaSelected),
          PreferencesMultiSelectOption("Locked", isOn: $lockedSelected, isEnabled: false),
        ]
      )
    }
  }

  private var iconSelectionComponents: some View {
    PreferencesSection(
      "Icon Selection",
      footer: "PreferencesIconSelectionButton combines an icon, label, and check indicator."
    ) {
      HStack(spacing: 8) {
        PreferencesIconSelectionButton(
          symbol: "eye",
          title: "Eye",
          tint: ExampleAccent.celadon.color,
          isSelected: $eyeSelected
        )
        PreferencesIconSelectionButton(
          symbol: "bolt",
          title: "Bolt",
          tint: ExampleAccent.plum.color,
          isSelected: $boltSelected
        )
        PreferencesIconSelectionButton(
          symbol: "hare",
          title: "Hare",
          tint: ExampleAccent.sage.color,
          isSelected: $hareSelected
        )
      }
      .padding(13)
    }
  }

  private var pillComponents: some View {
    PreferencesSection(
      "Pills",
      footer: "PreferencesFlowGrid wraps static and selectable tags at the available width."
    ) {
      PreferencesRow(
        title: "PreferencesTag",
        caption: "Static, monospaced labels in a PreferencesFlowGrid."
      )
      PreferencesFlowGrid(items: componentTags) {
        PreferencesTag($0.id)
      }
      PreferencesRowSeparator()
      PreferencesRow(
        title: "PreferencesSelectableTag",
        caption: "The owner keeps selection state."
      )
      PreferencesFlowGrid(items: selectableTags.map(ExampleLabel.init)) { item in
        PreferencesSelectableTag(
          item.id,
          isSelected: selectedTag == item.id
        ) {
          selectedTag = item.id
        }
      }
    }
  }

  private var gridComponents: some View {
    PreferencesSection(
      "Grid",
      footer:
        "Named accents are arranged in seven color families with room for five accents in each family."
    ) {
      VStack(spacing: 0) {
        ForEach(ExampleAccentFamily.allCases) { family in
          ExampleAccentFamilyGrid(
            family: family,
            selection: $accent,
            customColor: colorValue
          )
        }
      }
    }
  }

  private var selectionOptions: [PreferencesPopupOption<ExampleSelection>] {
    [
      PreferencesPopupOption(.first, label: "One"),
      PreferencesPopupOption(.second, label: "Two"),
      PreferencesPopupOption(.third, label: "Three"),
    ]
  }
}

private struct ExampleAccentFamilyGrid: View {
  @Environment(\.preferencesMetrics) private var metrics
  @Environment(\.preferencesTypography) private var typography
  let family: ExampleAccentFamily
  @Binding var selection: ExampleAccent
  let customColor: Color

  private let columns = Array(
    repeating: GridItem(.flexible(), spacing: 7),
    count: ExampleAccentFamily.capacity
  )

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text(family.title.uppercased())
        .font(typography.sectionHeader.font)
        .foregroundStyle(PreferencesPalette.faint)
        .padding(.horizontal, metrics.rowInset)
        .padding(.top, 11)

      LazyVGrid(columns: columns, spacing: 7) {
        ForEach(0..<ExampleAccentFamily.capacity, id: \.self) { index in
          if family.accents.indices.contains(index) {
            let accent = family.accents[index]
            PreferencesChip(accent.title) {
              selection = accent
            }
            .preferencesAccent(accent.value(customColor: customColor))
          } else {
            Color.clear
              .frame(height: 30)
              .accessibilityHidden(true)
          }
        }
      }
      .padding(.horizontal, metrics.rowInset)
      .padding(.vertical, 13)
    }
  }
}

struct AboutShowcase: View {
  var body: some View {
    PreferencesPaneStack {
      PreferencesSection("FlowingDayUI") {
        PreferencesValueRow(
          symbol: "shippingbox",
          title: "Package",
          value: "FlowingDayPreferences"
        )
        PreferencesRowSeparator(isIndented: true)
        PreferencesValueRow(title: "License", value: "Apache-2.0")
        PreferencesRowSeparator()
        PreferencesValueRow(title: "Built With", value: "SwiftUI + AppKit")
      }

      PreferencesSection("Source") {
        PreferencesLinkRow(
          symbol: "chevron.left.forwardslash.chevron.right",
          title: "Repository",
          buttonTitle: "GitHub",
          destination: ExampleLinks.repository,
          help: "Open FlowingDayUI on GitHub"
        )
      }
    }
  }
}

enum ExampleLinks {
  static let repository = URL(string: "https://github.com/cocoa-xu/flowing-day-ui")!
}
