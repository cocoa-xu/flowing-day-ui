import FlowingDayPreferences
import SwiftUI

enum ExampleTab: String, CaseIterable, Hashable {
  case overview
  case components
  case accessibility

  var title: String { rawValue.capitalized }

  var systemImage: String {
    switch self {
    case .overview: "sparkles"
    case .components: "square.grid.2x2"
    case .accessibility: "accessibility"
    }
  }

  var detail: String {
    switch self {
    case .overview: "A calm foundation for native interfaces."
    case .components: "Composable controls with shared visual language."
    case .accessibility: "Keyboard and assistive technology remain first-class."
    }
  }
}

struct ExampleTabsPreview: View {
  @Environment(\.preferencesAccent) private var accent
  @Environment(\.preferencesTypography) private var typography
  @Binding var selection: ExampleTab
  let style: FlowingTabsStyle
  let sizing: FlowingTabsSizing
  let overflowBehavior: FlowingTabsOverflowBehavior
  let labelContent: FlowingTabLabelContent

  var body: some View {
    FlowingCard {
      FlowingTabs(
        label: "Library areas",
        selection: $selection,
        options: ExampleTab.allCases.map {
          FlowingTabOption($0, label: $0.title, systemImage: $0.systemImage)
        },
        style: style,
        sizing: sizing,
        overflowBehavior: overflowBehavior,
        labelContent: labelContent
      )
      FlowingSeparator()
      HStack(spacing: 11) {
        Image(systemName: selection.systemImage)
          .font(.system(size: 15, weight: .medium))
          .foregroundStyle(accent.foreground)
          .frame(width: 26, height: 26)
        VStack(alignment: .leading, spacing: 2) {
          Text(selection.title)
            .font(typography.rowTitle.font)
            .foregroundStyle(PreferencesPalette.ink)
          Text(selection.detail)
            .font(typography.rowCaption.font)
            .foregroundStyle(PreferencesPalette.muted)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(13)
    }
  }
}
