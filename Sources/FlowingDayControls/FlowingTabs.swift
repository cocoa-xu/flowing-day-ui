import SwiftUI

public struct FlowingTabOption<Value: Hashable>: Identifiable {
  public let value: Value
  public let label: String
  public let systemImage: String?
  public let isEnabled: Bool
  public var id: Value { value }

  public init(
    _ value: Value,
    label: String,
    systemImage: String? = nil,
    isEnabled: Bool = true
  ) {
    self.value = value
    self.label = label
    self.systemImage = systemImage
    self.isEnabled = isEnabled
  }
}

public enum FlowingTabsStyle: String, CaseIterable, Hashable, Sendable {
  case underline
  case softSurface
}

public enum FlowingTabsSizing: String, CaseIterable, Hashable, Sendable {
  case equal
  case fitContent
}

public enum FlowingTabsOverflowBehavior: String, CaseIterable, Hashable, Sendable {
  case compress
  case scroll
}

public enum FlowingTabLabelContent: String, CaseIterable, Hashable, Sendable {
  case text
  case icon
  case iconAndText
}

public enum FlowingTabsAlignment: String, CaseIterable, Hashable, Sendable {
  case leading
  case center
  case trailing

  var frameAlignment: Alignment {
    switch self {
    case .leading: .leading
    case .center: .center
    case .trailing: .trailing
    }
  }
}

enum FlowingTabsMetrics {
  static let underlineHorizontalInset: CGFloat = 7
  static let underlineItemHorizontalInset: CGFloat = 10
  static let underlineItemTopInset: CGFloat = 10
  static let underlineLabelSpacing: CGFloat = 8
  static let underlineHeight: CGFloat = 2
  static let softSurfaceOuterInset: CGFloat = 8
  static let softSurfaceBottomAdjustment: CGFloat = 1
  static let softSurfaceContainerInset: CGFloat = 4
  static let softSurfaceItemSpacing: CGFloat = 4
  static let softSurfaceItemHeight: CGFloat = 30
  static let itemHorizontalInset: CGFloat = 10
  static let disabledOpacity = 0.42
}

enum FlowingTabsNavigation {
  static func destination<Value: Hashable>(
    in options: [FlowingTabOption<Value>],
    from selection: Value,
    offset: Int
  ) -> Value? {
    FlowingSegmentedControlNavigation.destination(
      in: options.filter(\.isEnabled).map(\.value),
      from: selection,
      offset: offset
    )
  }
}

enum FlowingTabsLayoutMetrics {
  static func widths(
    idealWidths: [CGFloat],
    spacing: CGFloat,
    sizing: FlowingTabsSizing,
    availableWidth: CGFloat?
  ) -> [CGFloat] {
    guard !idealWidths.isEmpty else { return [] }
    let normalizedWidths = idealWidths.map { max(0, $0.isFinite ? $0 : 0) }
    let totalSpacing = spacing * CGFloat(max(0, normalizedWidths.count - 1))

    switch sizing {
    case .equal:
      let naturalWidth = normalizedWidths.max() ?? 0
      guard let availableWidth, availableWidth.isFinite else {
        return Array(repeating: naturalWidth, count: normalizedWidths.count)
      }
      let itemWidth = max(0, (availableWidth - totalSpacing) / CGFloat(normalizedWidths.count))
      return Array(repeating: itemWidth, count: normalizedWidths.count)
    case .fitContent:
      guard let availableWidth, availableWidth.isFinite else { return normalizedWidths }
      let availableContentWidth = max(0, availableWidth - totalSpacing)
      let naturalContentWidth = normalizedWidths.reduce(0, +)
      guard naturalContentWidth > availableContentWidth, naturalContentWidth > 0 else {
        return normalizedWidths
      }
      let scale = availableContentWidth / naturalContentWidth
      return normalizedWidths.map { $0 * scale }
    }
  }
}

private struct FlowingTabsLayout: Layout {
  let layoutDirection: LayoutDirection
  let sizing: FlowingTabsSizing
  let spacing: CGFloat
  let fillsAvailableWidth: Bool

  func sizeThatFits(
    proposal: ProposedViewSize,
    subviews: Subviews,
    cache: inout ()
  ) -> CGSize {
    let idealSizes = subviews.map { $0.sizeThatFits(.unspecified) }
    let widths = resolvedWidths(
      idealSizes: idealSizes,
      availableWidth: fillsAvailableWidth ? proposal.width : nil
    )
    return CGSize(
      width: widths.reduce(0, +) + totalSpacing(for: widths.count),
      height: idealSizes.map(\.height).max() ?? 0
    )
  }

  func placeSubviews(
    in bounds: CGRect,
    proposal: ProposedViewSize,
    subviews: Subviews,
    cache: inout ()
  ) {
    let idealSizes = subviews.map { $0.sizeThatFits(.unspecified) }
    let widths = resolvedWidths(
      idealSizes: idealSizes,
      availableWidth: fillsAvailableWidth ? bounds.width : nil
    )
    let direction: CGFloat = layoutDirection == .leftToRight ? 1 : -1
    var x = layoutDirection == .leftToRight ? bounds.minX : bounds.maxX
    for (index, subview) in subviews.enumerated() {
      let width = widths[index]
      subview.place(
        at: CGPoint(x: x + direction * width / 2, y: bounds.midY),
        anchor: .center,
        proposal: ProposedViewSize(width: width, height: bounds.height)
      )
      x += direction * (width + spacing)
    }
  }

  private func resolvedWidths(
    idealSizes: [CGSize],
    availableWidth: CGFloat?
  ) -> [CGFloat] {
    FlowingTabsLayoutMetrics.widths(
      idealWidths: idealSizes.map(\.width),
      spacing: spacing,
      sizing: sizing,
      availableWidth: availableWidth
    )
  }

  private func totalSpacing(for count: Int) -> CGFloat {
    spacing * CGFloat(max(0, count - 1))
  }
}

public struct FlowingTabs<Value: Hashable>: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.layoutDirection) private var layoutDirection
  @Environment(\.flowingMetrics) private var metrics
  @Environment(\.flowingSurfaces) private var surfaces
  @FocusState private var hasKeyboardFocus: Bool
  @Namespace private var selectionNamespace
  private let label: String
  private let labelContent: FlowingTabLabelContent
  private let itemAlignment: FlowingTabsAlignment
  private let options: [FlowingTabOption<Value>]
  private let overflowBehavior: FlowingTabsOverflowBehavior
  @Binding private var selection: Value
  private let sizing: FlowingTabsSizing
  private let stripAlignment: FlowingTabsAlignment
  private let style: FlowingTabsStyle

  public init(
    label: String,
    selection: Binding<Value>,
    options: [FlowingTabOption<Value>],
    style: FlowingTabsStyle = .underline,
    sizing: FlowingTabsSizing = .equal,
    overflowBehavior: FlowingTabsOverflowBehavior = .compress,
    labelContent: FlowingTabLabelContent = .iconAndText,
    stripAlignment: FlowingTabsAlignment = .leading,
    itemAlignment: FlowingTabsAlignment = .center
  ) {
    precondition(!options.isEmpty)
    precondition(Set(options.map(\.id)).count == options.count)
    self.label = label
    _selection = selection
    self.options = options
    self.style = style
    self.sizing = sizing
    self.overflowBehavior = overflowBehavior
    self.labelContent = labelContent
    self.stripAlignment = stripAlignment
    self.itemAlignment = itemAlignment
  }

  public var body: some View {
    styledTabs
      .opacity(isEnabled ? 1 : FlowingTabsMetrics.disabledOpacity)
      .focusable()
      .modifier(FlowingFocusEffectDisabledModifier())
      .focused($hasKeyboardFocus)
      .onMoveCommand(perform: moveSelection)
      .accessibilityElement(children: .contain)
      .accessibilityLabel(label)
      .accessibilityAdjustableAction { direction in
        switch direction {
        case .increment:
          select(offset: 1)
        case .decrement:
          select(offset: -1)
        @unknown default:
          break
        }
      }
      .animation(
        reduceMotion ? nil : .easeOut(duration: FlowingMotion.selection),
        value: selection
      )
  }

  @ViewBuilder
  private var styledTabs: some View {
    switch style {
    case .underline:
      tabStrip(spacing: 0)
        .padding(.horizontal, FlowingTabsMetrics.underlineHorizontalInset)
    case .softSurface:
      tabStrip(spacing: FlowingTabsMetrics.softSurfaceItemSpacing)
        .padding(FlowingTabsMetrics.softSurfaceContainerInset)
        .background(surfaces.canvas, in: softSurfaceContainerShape)
        .overlay {
          softSurfaceContainerShape.strokeBorder(FlowingPalette.edge)
        }
        .padding(FlowingTabsMetrics.softSurfaceOuterInset)
        .padding(.bottom, FlowingTabsMetrics.softSurfaceBottomAdjustment)
    }
  }

  @ViewBuilder
  private func tabStrip(spacing: CGFloat) -> some View {
    if overflowBehavior == .scroll {
      ScrollView(.horizontal) {
        tabLayout(spacing: spacing, fillsAvailableWidth: false)
      }
      .scrollIndicators(.never)
    } else {
      tabLayout(spacing: spacing, fillsAvailableWidth: true)
        .frame(maxWidth: .infinity, alignment: stripAlignment.frameAlignment)
    }
  }

  private func tabLayout(spacing: CGFloat, fillsAvailableWidth: Bool) -> some View {
    FlowingTabsLayout(
      layoutDirection: layoutDirection,
      sizing: sizing,
      spacing: spacing,
      fillsAvailableWidth: fillsAvailableWidth
    ) {
      ForEach(options) { option in
        FlowingTabButton(
          option: option,
          isSelected: selection == option.value,
          labelContent: labelContent,
          itemAlignment: itemAlignment,
          style: style,
          selectionNamespace: selectionNamespace
        ) {
          selection = option.value
          hasKeyboardFocus = true
        }
      }
    }
  }

  private var softSurfaceContainerShape: RoundedRectangle {
    RoundedRectangle(cornerRadius: metrics.controlRadius + 2, style: .continuous)
  }

  private func moveSelection(_ direction: MoveCommandDirection) {
    let forwardOffset = layoutDirection == .leftToRight ? 1 : -1
    switch direction {
    case .left:
      select(offset: -forwardOffset)
    case .right:
      select(offset: forwardOffset)
    case .up:
      select(offset: -1)
    case .down:
      select(offset: 1)
    default:
      break
    }
  }

  private func select(offset: Int) {
    guard isEnabled,
      let destination = FlowingTabsNavigation.destination(
        in: options,
        from: selection,
        offset: offset
      )
    else {
      return
    }
    selection = destination
  }
}

private struct FlowingTabButton<Value: Hashable>: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.flowingAccent) private var accent
  @Environment(\.flowingMetrics) private var metrics
  @Environment(\.flowingStrings) private var strings
  @Environment(\.flowingTypography) private var typography
  @State private var isHovering = false
  let option: FlowingTabOption<Value>
  let isSelected: Bool
  let labelContent: FlowingTabLabelContent
  let itemAlignment: FlowingTabsAlignment
  let style: FlowingTabsStyle
  let selectionNamespace: Namespace.ID
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      switch style {
      case .underline: underlineLabel
      case .softSurface: softSurfaceLabel
      }
    }
    .buttonStyle(.plain)
    .disabled(!option.isEnabled)
    .opacity(option.isEnabled ? 1 : FlowingTabsMetrics.disabledOpacity)
    .help(option.label)
    .onHover { isHovering = $0 }
    .accessibilityLabel(option.label)
    .accessibilityValue(isSelected ? strings.selected : strings.notSelected)
    .accessibilityAddTraits(isSelected ? .isSelected : [])
    .animation(
      reduceMotion ? nil : .easeOut(duration: FlowingMotion.hover),
      value: isHovering
    )
  }

  private var underlineLabel: some View {
    VStack(spacing: FlowingTabsMetrics.underlineLabelSpacing) {
      tabLabel
        .foregroundStyle(labelColor)
        .lineLimit(1)
        .frame(maxWidth: .infinity, alignment: itemAlignment.frameAlignment)
      ZStack {
        Color.clear
        if isSelected {
          Capsule(style: .continuous)
            .fill(accent.fill)
            .matchedGeometryEffect(id: "underline", in: selectionNamespace)
        }
      }
      .frame(height: FlowingTabsMetrics.underlineHeight)
    }
    .padding(.horizontal, FlowingTabsMetrics.underlineItemHorizontalInset)
    .padding(.top, FlowingTabsMetrics.underlineItemTopInset)
    .frame(maxWidth: .infinity)
    .contentShape(Rectangle())
  }

  private var softSurfaceLabel: some View {
    ZStack {
      if isSelected {
        softSurfaceShape
          .fill(accent.veil)
          .overlay {
            softSurfaceShape.strokeBorder(accent.fill.opacity(0.13))
          }
          .matchedGeometryEffect(id: "soft-surface", in: selectionNamespace)
      } else if isHovering && isEnabled && option.isEnabled {
        softSurfaceShape.fill(accent.veil.opacity(0.56))
      }
      tabLabel
        .foregroundStyle(labelColor)
        .lineLimit(1)
        .frame(maxWidth: .infinity, alignment: itemAlignment.frameAlignment)
        .padding(.horizontal, FlowingTabsMetrics.itemHorizontalInset)
    }
    .frame(maxWidth: .infinity)
    .frame(height: FlowingTabsMetrics.softSurfaceItemHeight)
    .contentShape(Rectangle())
  }

  @ViewBuilder
  private var tabLabel: some View {
    switch labelContent {
    case .text:
      Text(option.label)
        .font(typography.selectionLabel.font)
    case .icon:
      if let systemImage = option.systemImage {
        Image(systemName: systemImage)
          .font(.system(size: 11, weight: .medium))
      } else {
        Text(option.label)
          .font(typography.selectionLabel.font)
      }
    case .iconAndText:
      if let systemImage = option.systemImage {
        Label(option.label, systemImage: systemImage)
          .font(typography.selectionLabel.font)
      } else {
        Text(option.label)
          .font(typography.selectionLabel.font)
      }
    }
  }

  private var softSurfaceShape: RoundedRectangle {
    RoundedRectangle(cornerRadius: metrics.controlRadius, style: .continuous)
  }

  private var labelColor: Color {
    if isSelected || (isHovering && isEnabled && option.isEnabled) {
      return accent.foreground
    }
    return FlowingPalette.muted
  }
}
