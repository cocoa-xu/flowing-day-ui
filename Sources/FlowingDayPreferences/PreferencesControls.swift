import AppKit
import FlowingDayControls
import SwiftUI

enum PreferencesRowLayout {
  static let compactVerticalPadding: CGFloat = 6
  static let detailedVerticalPadding: CGFloat = 11
  static let minimumHeight: CGFloat = 42
  static let symbolWidth: CGFloat = 20
  static let symbolSpacing: CGFloat = 14
  static let iconTextLeadingOffset = symbolWidth + symbolSpacing

  static func verticalPadding(hasCaption: Bool) -> CGFloat {
    hasCaption ? detailedVerticalPadding : compactVerticalPadding
  }
}

public enum PreferencesRowSeparatorLeadingEdge: Equatable, Sendable {
  case content
  case iconText
}

private struct PreferencesRowSeparatorLeadingEdgeKey: EnvironmentKey {
  static let defaultValue = PreferencesRowSeparatorLeadingEdge.content
}

extension EnvironmentValues {
  fileprivate var preferencesRowSeparatorLeadingEdge: PreferencesRowSeparatorLeadingEdge {
    get { self[PreferencesRowSeparatorLeadingEdgeKey.self] }
    set { self[PreferencesRowSeparatorLeadingEdgeKey.self] = newValue }
  }
}

private struct PreferencesRowIconPresenceKey: PreferenceKey {
  static let defaultValue: Set<Bool> = []

  static func reduce(value: inout Set<Bool>, nextValue: () -> Set<Bool>) {
    value.formUnion(nextValue())
  }
}

enum PreferencesSectionSeparatorResolver {
  static func resolve(
    iconPresence: Set<Bool>,
    mixedRows: PreferencesRowSeparatorLeadingEdge
  ) -> PreferencesRowSeparatorLeadingEdge {
    if iconPresence == Set([true]) {
      return .iconText
    }
    if iconPresence == Set([false]) {
      return .content
    }
    return mixedRows
  }
}

public enum PreferencesRowIcon {
  case system(String)
  case image(NSImage)
  case template(NSImage)
}

private struct PreferencesRowIconView: View {
  @Environment(\.flowingAccent) private var accent
  let icon: PreferencesRowIcon

  @ViewBuilder
  var body: some View {
    switch icon {
    case .system(let symbol):
      Image(systemName: symbol)
        .font(.system(size: 13, weight: .medium))
        .foregroundStyle(FlowingPalette.muted)
        .frame(width: PreferencesRowLayout.symbolWidth)
    case .image(let image):
      Image(nsImage: image)
        .resizable()
        .scaledToFit()
        .frame(
          width: PreferencesRowLayout.symbolWidth,
          height: PreferencesRowLayout.symbolWidth
        )
    case .template(let image):
      Image(nsImage: image)
        .renderingMode(.template)
        .resizable()
        .scaledToFit()
        .foregroundStyle(accent.foreground)
        .frame(
          width: PreferencesRowLayout.symbolWidth,
          height: PreferencesRowLayout.symbolWidth
        )
    }
  }
}

public struct PreferencesSectionHeader: View {
  @Environment(\.flowingTypography) private var typography
  private let title: String

  public init(_ title: String) {
    self.title = title
  }

  public var body: some View {
    Text(title.uppercased())
      .font(typography.sectionHeader.font)
      .tracking(0.7)
      .foregroundStyle(FlowingPalette.faint)
      .padding(.leading, 4)
      .padding(.bottom, 7)
  }
}

public struct PreferencesCard<Content: View>: View {
  private let content: Content

  public init(@ViewBuilder content: () -> Content) {
    self.content = content()
  }

  public var body: some View {
    FlowingCard {
      content
    }
  }
}

public struct PreferencesRowSeparator: View {
  @Environment(\.flowingMetrics) private var metrics
  @Environment(\.preferencesRowSeparatorLeadingEdge) private var sectionLeadingEdge
  private let leadingEdge: PreferencesRowSeparatorLeadingEdge?

  public init(leadingEdge: PreferencesRowSeparatorLeadingEdge? = nil) {
    self.leadingEdge = leadingEdge
  }

  public var body: some View {
    Rectangle()
      .fill(FlowingPalette.hairline)
      .frame(height: 1)
      .padding(.leading, metrics.rowInset + additionalLeadingInset)
  }

  private var additionalLeadingInset: CGFloat {
    switch leadingEdge ?? sectionLeadingEdge {
    case .content: 0
    case .iconText: PreferencesRowLayout.iconTextLeadingOffset
    }
  }
}

public struct PreferencesPaneStack<Content: View>: View {
  @Environment(\.preferencesMetrics) private var metrics
  private let content: Content

  public init(@ViewBuilder content: () -> Content) {
    self.content = content()
  }

  public var body: some View {
    VStack(alignment: .leading, spacing: metrics.sectionSpacing) {
      content
    }
  }
}

public struct PreferencesSection<Content: View>: View {
  @State private var rowIconPresence: Set<Bool> = []
  private let title: String
  private let footer: String?
  private let mixedRowSeparatorLeadingEdge: PreferencesRowSeparatorLeadingEdge
  private let content: Content

  public init(
    _ title: String,
    footer: String? = nil,
    mixedRowSeparatorLeadingEdge: PreferencesRowSeparatorLeadingEdge = .content,
    @ViewBuilder content: () -> Content
  ) {
    self.title = title
    self.footer = footer
    self.mixedRowSeparatorLeadingEdge = mixedRowSeparatorLeadingEdge
    self.content = content()
  }

  public var body: some View {
    FlowingSection(title, footer: footer) {
      content
        .environment(\.preferencesRowSeparatorLeadingEdge, separatorLeadingEdge)
        .onPreferenceChange(PreferencesRowIconPresenceKey.self) {
          rowIconPresence = $0
        }
    }
  }

  private var separatorLeadingEdge: PreferencesRowSeparatorLeadingEdge {
    PreferencesSectionSeparatorResolver.resolve(
      iconPresence: rowIconPresence,
      mixedRows: mixedRowSeparatorLeadingEdge
    )
  }
}

public struct PreferencesRow<Trailing: View>: View {
  @Environment(\.flowingMetrics) private var metrics
  @Environment(\.flowingTypography) private var typography
  private let icon: PreferencesRowIcon?
  private let title: String
  private let caption: String?
  private let trailing: Trailing

  public init(
    symbol: String? = nil,
    title: String,
    caption: String? = nil,
    @ViewBuilder trailing: () -> Trailing
  ) {
    icon = symbol.map(PreferencesRowIcon.system)
    self.title = title
    self.caption = caption
    self.trailing = trailing()
  }

  public init(
    icon: PreferencesRowIcon,
    title: String,
    caption: String? = nil,
    @ViewBuilder trailing: () -> Trailing
  ) {
    self.icon = icon
    self.title = title
    self.caption = caption
    self.trailing = trailing()
  }

  public var body: some View {
    HStack(alignment: .center, spacing: PreferencesRowLayout.symbolSpacing) {
      if let icon {
        PreferencesRowIconView(icon: icon)
      }
      VStack(alignment: .leading, spacing: 2) {
        Text(title)
          .font(typography.rowTitle.font)
          .foregroundStyle(FlowingPalette.ink)
        if let caption {
          Text(caption)
            .font(typography.rowCaption.font)
            .foregroundStyle(FlowingPalette.faint)
            .fixedSize(horizontal: false, vertical: true)
        }
      }
      Spacer(minLength: 10)
      trailing
    }
    .padding(.horizontal, metrics.rowInset)
    .padding(.vertical, PreferencesRowLayout.verticalPadding(hasCaption: caption != nil))
    .frame(minHeight: PreferencesRowLayout.minimumHeight)
    .preference(key: PreferencesRowIconPresenceKey.self, value: Set([icon != nil]))
  }
}

extension PreferencesRow where Trailing == EmptyView {
  public init(symbol: String? = nil, title: String, caption: String? = nil) {
    self.init(symbol: symbol, title: title, caption: caption) { EmptyView() }
  }

  public init(icon: PreferencesRowIcon, title: String, caption: String? = nil) {
    self.init(icon: icon, title: title, caption: caption) { EmptyView() }
  }
}

public struct PreferencesSwitchRow: View {
  private let symbol: String?
  private let title: String
  private let caption: String?
  @Binding private var isOn: Bool

  public init(
    symbol: String? = nil,
    title: String,
    caption: String? = nil,
    isOn: Binding<Bool>
  ) {
    self.symbol = symbol
    self.title = title
    self.caption = caption
    _isOn = isOn
  }

  public var body: some View {
    PreferencesRow(symbol: symbol, title: title, caption: caption) {
      FlowingSwitch(title, isOn: $isOn)
        .labelsHidden()
    }
  }
}

public struct PreferencesDependentRows<Content: View>: View {
  private let isVisible: Bool
  private let showsSeparator: Bool
  private let separatorLeadingEdge: PreferencesRowSeparatorLeadingEdge?
  private let content: Content

  public init(
    isVisible: Bool,
    showsSeparator: Bool = true,
    separatorLeadingEdge: PreferencesRowSeparatorLeadingEdge? = nil,
    @ViewBuilder content: () -> Content
  ) {
    self.isVisible = isVisible
    self.showsSeparator = showsSeparator
    self.separatorLeadingEdge = separatorLeadingEdge
    self.content = content()
  }

  public var body: some View {
    FlowingDisclosureContent(isExpanded: isVisible) {
      VStack(spacing: 0) {
        if showsSeparator {
          PreferencesRowSeparator(leadingEdge: separatorLeadingEdge)
        }
        content
      }
    }
  }
}

public struct PreferencesSwitchGroup<Content: View>: View {
  private let symbol: String?
  private let title: String
  private let caption: String?
  private let showsSeparator: Bool
  private let separatorLeadingEdge: PreferencesRowSeparatorLeadingEdge?
  @Binding private var isOn: Bool
  private let content: Content

  public init(
    symbol: String? = nil,
    title: String,
    caption: String? = nil,
    isOn: Binding<Bool>,
    showsSeparator: Bool = true,
    separatorLeadingEdge: PreferencesRowSeparatorLeadingEdge? = nil,
    @ViewBuilder content: () -> Content
  ) {
    self.symbol = symbol
    self.title = title
    self.caption = caption
    _isOn = isOn
    self.showsSeparator = showsSeparator
    self.separatorLeadingEdge = separatorLeadingEdge
    self.content = content()
  }

  public var body: some View {
    VStack(spacing: 0) {
      PreferencesSwitchRow(
        symbol: symbol,
        title: title,
        caption: caption,
        isOn: $isOn
      )
      PreferencesDependentRows(
        isVisible: isOn,
        showsSeparator: showsSeparator,
        separatorLeadingEdge: separatorLeadingEdge
      ) {
        content
      }
    }
  }
}

public struct PreferencesSliderRow: View {
  @Environment(\.flowingMetrics) private var metrics
  @Environment(\.preferencesTypography) private var preferencesTypography
  @Environment(\.flowingTypography) private var typography
  private let symbol: String?
  private let title: String
  private let caption: String?
  @Binding private var value: Double
  private let range: ClosedRange<Double>
  private let step: Double?
  private let format: (Double) -> String

  public init(
    symbol: String? = nil,
    title: String,
    caption: String? = nil,
    value: Binding<Double>,
    in range: ClosedRange<Double>,
    step: Double? = nil,
    format: @escaping (Double) -> String
  ) {
    self.symbol = symbol
    self.title = title
    self.caption = caption
    _value = value
    self.range = range
    self.step = step
    self.format = format
  }

  public var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      HStack(spacing: 10) {
        if let symbol {
          Image(systemName: symbol)
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(FlowingPalette.muted)
            .frame(width: 20)
        }
        Text(title)
          .font(typography.rowTitle.font)
          .foregroundStyle(FlowingPalette.ink)
        Spacer(minLength: 10)
        Text(format(value))
          .font(preferencesTypography.sliderValue.font)
          .foregroundStyle(FlowingPalette.muted)
      }
      FlowingSlider(title, value: $value, in: range, step: step, formatValue: format)
      if let caption {
        Text(caption)
          .font(typography.rowCaption.font)
          .foregroundStyle(FlowingPalette.faint)
          .fixedSize(horizontal: false, vertical: true)
      }
    }
    .padding(.horizontal, metrics.rowInset)
    .padding(.vertical, 11)
  }
}

public struct PreferencesPopupRow<Value: Hashable>: View {
  private let symbol: String?
  private let title: String
  private let caption: String?
  private let minimumControlWidth: CGFloat?
  @Binding private var selection: Value
  private let options: [FlowingSelectOption<Value>]

  public init(
    symbol: String? = nil,
    title: String,
    caption: String? = nil,
    minimumControlWidth: CGFloat? = nil,
    selection: Binding<Value>,
    options: [FlowingSelectOption<Value>]
  ) {
    self.symbol = symbol
    self.title = title
    self.caption = caption
    self.minimumControlWidth = minimumControlWidth
    _selection = selection
    self.options = options
  }

  public var body: some View {
    PreferencesRow(symbol: symbol, title: title, caption: caption) {
      FlowingSelect(
        label: title,
        selection: $selection,
        options: options,
        minimumWidth: minimumControlWidth ?? 0
      )
      .fixedSize()
    }
  }
}

public struct PreferencesSearchPickerRow<Value: Hashable>: View {
  @Environment(\.flowingAccent) private var accent
  @Environment(\.flowingMetrics) private var metrics
  @Environment(\.flowingStrings) private var strings
  @Environment(\.flowingTypography) private var typography
  @State private var isExpanded = false
  @State private var query = ""
  private let symbol: String?
  private let title: String
  private let caption: String?
  private let maximumVisibleOptions: Int
  @Binding private var selection: Value
  private let options: [FlowingSelectOption<Value>]

  public init(
    symbol: String? = nil,
    title: String,
    caption: String? = nil,
    maximumVisibleOptions: Int = 6,
    selection: Binding<Value>,
    options: [FlowingSelectOption<Value>]
  ) {
    self.symbol = symbol
    self.title = title
    self.caption = caption
    self.maximumVisibleOptions = max(maximumVisibleOptions, 1)
    _selection = selection
    self.options = options
  }

  public var body: some View {
    FlowingDisclosure(
      isExpanded: $isExpanded,
      minimumHeaderHeight: PreferencesRowLayout.minimumHeight,
      contentInsets: EdgeInsets(
        top: PreferencesRowLayout.verticalPadding(hasCaption: caption != nil),
        leading: metrics.rowInset,
        bottom: PreferencesRowLayout.verticalPadding(hasCaption: caption != nil),
        trailing: metrics.rowInset
      )
    ) {
      HStack(spacing: PreferencesRowLayout.symbolSpacing) {
        if let symbol {
          Image(systemName: symbol)
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(FlowingPalette.muted)
            .frame(width: PreferencesRowLayout.symbolWidth)
        }
        VStack(alignment: .leading, spacing: 2) {
          Text(title)
            .font(typography.rowTitle.font)
            .foregroundStyle(FlowingPalette.ink)
          if let caption {
            Text(caption)
              .font(typography.rowCaption.font)
              .foregroundStyle(FlowingPalette.faint)
              .fixedSize(horizontal: false, vertical: true)
          }
        }
        Spacer(minLength: 10)
        Text(selectedLabel)
          .font(typography.value.font)
          .foregroundStyle(accent.foreground)
          .lineLimit(1)
          .truncationMode(.middle)
      }
    } content: {
      VStack(spacing: 0) {
        PreferencesRowSeparator()
        FlowingSearchPicker(
          label: title,
          selection: $selection,
          options: options,
          query: $query,
          maximumVisibleOptions: maximumVisibleOptions
        ) { _ in
          isExpanded = false
        }
        .padding(.horizontal, metrics.rowInset)
        .padding(.vertical, 12)
      }
    }
    .onChange(of: isExpanded) { expanded in
      if !expanded {
        query = ""
      }
    }
    .accessibilityValue(
      Text("\(selectedLabel), \(isExpanded ? strings.expanded : strings.collapsed)")
    )
    .preference(key: PreferencesRowIconPresenceKey.self, value: Set([symbol != nil]))
  }

  private var selectedLabel: String {
    options.first { $0.value == selection }?.label ?? "—"
  }
}

public struct PreferencesColorPickerRow: View {
  private let symbol: String?
  private let title: String
  private let caption: String?
  private let supportsOpacity: Bool
  @Binding private var selection: Color

  public init(
    symbol: String? = nil,
    title: String,
    caption: String? = nil,
    selection: Binding<Color>,
    supportsOpacity: Bool = false
  ) {
    self.symbol = symbol
    self.title = title
    self.caption = caption
    self.supportsOpacity = supportsOpacity
    _selection = selection
  }

  public var body: some View {
    PreferencesRow(symbol: symbol, title: title, caption: caption) {
      FlowingColorPicker(
        title,
        selection: $selection,
        supportsOpacity: supportsOpacity
      )
      .labelsHidden()
    }
  }
}

public struct PreferencesSegmentedRow<Value: Hashable>: View {
  private let symbol: String?
  private let title: String
  private let caption: String?
  private let controlWidth: CGFloat
  @Binding private var selection: Value
  private let options: [FlowingSegmentOption<Value>]

  public init(
    symbol: String? = nil,
    title: String,
    caption: String? = nil,
    controlWidth: CGFloat = 300,
    selection: Binding<Value>,
    options: [FlowingSegmentOption<Value>]
  ) {
    precondition(controlWidth > 0 && controlWidth.isFinite)
    self.symbol = symbol
    self.title = title
    self.caption = caption
    self.controlWidth = controlWidth
    _selection = selection
    self.options = options
  }

  public var body: some View {
    PreferencesRow(symbol: symbol, title: title, caption: caption) {
      FlowingSegmentedControl(
        label: title,
        selection: $selection,
        options: options
      )
      .frame(width: controlWidth)
    }
  }
}

public struct PreferencesConnectedSegmentedRow<Value: Hashable>: View {
  private let symbol: String?
  private let title: String
  private let caption: String?
  private let controlWidth: CGFloat
  @Binding private var selection: Value
  private let options: [FlowingSegmentOption<Value>]

  public init(
    symbol: String? = nil,
    title: String,
    caption: String? = nil,
    controlWidth: CGFloat = 300,
    selection: Binding<Value>,
    options: [FlowingSegmentOption<Value>]
  ) {
    precondition(controlWidth > 0 && controlWidth.isFinite)
    self.symbol = symbol
    self.title = title
    self.caption = caption
    self.controlWidth = controlWidth
    _selection = selection
    self.options = options
  }

  public var body: some View {
    PreferencesRow(symbol: symbol, title: title, caption: caption) {
      FlowingConnectedSegmentedControl(
        label: title,
        selection: $selection,
        options: options
      )
      .frame(width: controlWidth)
    }
  }
}

public struct PreferencesMultiSelectRow: View {
  private let symbol: String?
  private let title: String
  private let caption: String?
  private let controlWidth: CGFloat
  private let axis: Axis
  private let itemWidthPolicy: FlowingMultiSelectItemWidthPolicy
  private let contentAlignment: FlowingCheckboxContentAlignment
  private let indicatorPlacement: FlowingCheckboxIndicatorPlacement
  private let spacing: CGFloat
  private let truncationMode: Text.TruncationMode
  private let options: [FlowingMultiSelectOption]

  public init(
    symbol: String? = nil,
    title: String,
    caption: String? = nil,
    controlWidth: CGFloat = 300,
    axis: Axis = .horizontal,
    itemWidthPolicy: FlowingMultiSelectItemWidthPolicy = .equal,
    contentAlignment: FlowingCheckboxContentAlignment = .center,
    indicatorPlacement: FlowingCheckboxIndicatorPlacement = .leading,
    spacing: CGFloat = 6,
    truncationMode: Text.TruncationMode = .tail,
    options: [FlowingMultiSelectOption]
  ) {
    self.symbol = symbol
    self.title = title
    self.caption = caption
    self.controlWidth = controlWidth
    self.axis = axis
    self.itemWidthPolicy = itemWidthPolicy
    self.contentAlignment = contentAlignment
    self.indicatorPlacement = indicatorPlacement
    self.spacing = spacing
    self.truncationMode = truncationMode
    self.options = options
  }

  public var body: some View {
    PreferencesRow(symbol: symbol, title: title, caption: caption) {
      FlowingMultiSelect(
        axis: axis,
        itemWidthPolicy: itemWidthPolicy,
        contentAlignment: contentAlignment,
        indicatorPlacement: indicatorPlacement,
        spacing: spacing,
        truncationMode: truncationMode,
        options: options
      )
      .frame(width: controlWidth)
    }
  }
}

public struct PreferencesCheckToggle: View {
  private let title: String
  let contentAlignment: FlowingCheckboxContentAlignment
  let indicatorPlacement: FlowingCheckboxIndicatorPlacement
  let widthPolicy: FlowingCheckboxWidthPolicy
  let truncationMode: Text.TruncationMode
  @Binding private var isOn: Bool

  public init(
    _ title: String,
    isOn: Binding<Bool>,
    contentAlignment: FlowingCheckboxContentAlignment = .center,
    indicatorPlacement: FlowingCheckboxIndicatorPlacement = .leading,
    widthPolicy: FlowingCheckboxWidthPolicy = .fill,
    truncationMode: Text.TruncationMode = .tail
  ) {
    self.title = title
    _isOn = isOn
    self.contentAlignment = contentAlignment
    self.indicatorPlacement = indicatorPlacement
    self.widthPolicy = widthPolicy
    self.truncationMode = truncationMode
  }

  public var body: some View {
    FlowingCheckbox(
      title,
      isOn: $isOn,
      contentAlignment: contentAlignment,
      indicatorPlacement: indicatorPlacement,
      widthPolicy: widthPolicy,
      truncationMode: truncationMode
    )
  }
}

public struct PreferencesButtonRow: View {
  private let symbol: String?
  private let title: String
  private let caption: String?
  private let buttonTitle: String
  private let action: () -> Void

  public init(
    symbol: String? = nil,
    title: String,
    caption: String? = nil,
    buttonTitle: String,
    action: @escaping () -> Void
  ) {
    self.symbol = symbol
    self.title = title
    self.caption = caption
    self.buttonTitle = buttonTitle
    self.action = action
  }

  public var body: some View {
    PreferencesRow(symbol: symbol, title: title, caption: caption) {
      Button(buttonTitle, action: action)
        .buttonStyle(FlowingSoftButtonStyle())
    }
  }
}

public struct PreferencesLinkRow: View {
  private let symbol: String?
  private let title: String
  private let caption: String?
  private let buttonTitle: String
  private let destination: URL
  private let help: String

  public init(
    symbol: String? = nil,
    title: String,
    caption: String? = nil,
    buttonTitle: String,
    destination: URL,
    help: String
  ) {
    self.symbol = symbol
    self.title = title
    self.caption = caption
    self.buttonTitle = buttonTitle
    self.destination = destination
    self.help = help
  }

  public var body: some View {
    PreferencesRow(symbol: symbol, title: title, caption: caption) {
      Link(buttonTitle, destination: destination)
        .buttonStyle(FlowingSoftButtonStyle())
        .help(help)
    }
  }
}

public struct PreferencesExpandableRow: View {
  @Environment(\.flowingMetrics) private var metrics
  @Environment(\.flowingTypography) private var typography
  private let symbol: String?
  private let title: String
  private let caption: String?
  @Binding private var isExpanded: Bool

  public init(
    symbol: String? = nil,
    title: String,
    caption: String? = nil,
    isExpanded: Binding<Bool>
  ) {
    self.symbol = symbol
    self.title = title
    self.caption = caption
    _isExpanded = isExpanded
  }

  public var body: some View {
    FlowingDisclosure(
      isExpanded: $isExpanded,
      minimumHeaderHeight: PreferencesRowLayout.minimumHeight,
      contentInsets: EdgeInsets(
        top: PreferencesRowLayout.verticalPadding(hasCaption: caption != nil),
        leading: metrics.rowInset,
        bottom: PreferencesRowLayout.verticalPadding(hasCaption: caption != nil),
        trailing: metrics.rowInset
      )
    ) {
      HStack(alignment: .center, spacing: PreferencesRowLayout.symbolSpacing) {
        if let symbol {
          Image(systemName: symbol)
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(FlowingPalette.muted)
            .frame(width: PreferencesRowLayout.symbolWidth)
        }
        VStack(alignment: .leading, spacing: 2) {
          Text(title)
            .font(typography.rowTitle.font)
            .foregroundStyle(FlowingPalette.ink)
          if let caption {
            Text(caption)
              .font(typography.rowCaption.font)
              .foregroundStyle(FlowingPalette.faint)
              .fixedSize(horizontal: false, vertical: true)
          }
        }
      }
    } content: {
      EmptyView()
    }
    .preference(key: PreferencesRowIconPresenceKey.self, value: Set([symbol != nil]))
  }
}

public struct PreferencesValueRow<Trailing: View>: View {
  private let symbol: String?
  private let title: String
  private let value: String
  private let trailing: Trailing

  public init(
    symbol: String? = nil,
    title: String,
    value: String,
    @ViewBuilder trailing: () -> Trailing
  ) {
    self.symbol = symbol
    self.title = title
    self.value = value
    self.trailing = trailing()
  }

  public var body: some View {
    PreferencesRow(symbol: symbol, title: title) {
      HStack(spacing: 10) {
        FlowingValueText(value)
        trailing
      }
    }
  }
}

extension PreferencesValueRow where Trailing == EmptyView {
  public init(symbol: String? = nil, title: String, value: String) {
    self.init(symbol: symbol, title: title, value: value) { EmptyView() }
  }
}

public struct PreferencesEmptyRow: View {
  @Environment(\.flowingMetrics) private var metrics
  private let message: String
  private let symbol: String?

  public init(_ message: String, symbol: String? = nil) {
    self.message = message
    self.symbol = symbol
  }

  public var body: some View {
    FlowingEmptyState(
      message,
      systemImage: symbol,
      layout: .inline
    )
    .padding(.horizontal, metrics.rowInset)
    .padding(.vertical, 14)
    .frame(maxWidth: .infinity, alignment: .leading)
    .preference(key: PreferencesRowIconPresenceKey.self, value: Set([symbol != nil]))
  }
}

public struct PreferencesFlowGrid<Item: Identifiable, Label: View>: View {
  @Environment(\.flowingMetrics) private var metrics
  private let items: [Item]
  private let spacing: CGFloat
  private let label: (Item) -> Label

  public init(
    items: [Item],
    spacing: CGFloat = 7,
    @ViewBuilder label: @escaping (Item) -> Label
  ) {
    self.items = items
    self.spacing = spacing
    self.label = label
  }

  public var body: some View {
    FlowingWrappingGrid(items: items, spacing: spacing, label: label)
      .padding(.horizontal, metrics.rowInset)
      .padding(.vertical, 13)
  }
}

public struct PreferencesGrid<Item: Identifiable, Label: View>: View {
  @Environment(\.flowingMetrics) private var metrics
  private let items: [Item]
  private let minimumWidth: CGFloat
  private let label: (Item) -> Label

  public init(
    items: [Item],
    minimumWidth: CGFloat = 96,
    @ViewBuilder label: @escaping (Item) -> Label
  ) {
    self.items = items
    self.minimumWidth = minimumWidth
    self.label = label
  }

  public var body: some View {
    FlowingAdaptiveGrid(items: items, minimumWidth: minimumWidth, label: label)
      .padding(.horizontal, metrics.rowInset)
      .padding(.vertical, 13)
  }
}
