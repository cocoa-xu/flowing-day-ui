import SwiftUI

public enum FlowingCheckboxContentAlignment: String, CaseIterable, Hashable, Sendable {
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

  var horizontalAlignment: HorizontalAlignment {
    switch self {
    case .leading: .leading
    case .center: .center
    case .trailing: .trailing
    }
  }
}

public enum FlowingCheckboxIndicatorPlacement: String, CaseIterable, Hashable, Sendable {
  case leading
  case trailing
}

public enum FlowingCheckboxWidthPolicy: Equatable, Sendable {
  case fill
  case fitContent(maximumWidth: CGFloat? = nil)

  var maximumWidth: CGFloat? {
    guard case .fitContent(let maximumWidth) = self,
      let maximumWidth,
      maximumWidth.isFinite,
      maximumWidth > 0
    else {
      return nil
    }
    return maximumWidth
  }
}

enum FlowingCheckboxIconMetrics {
  static let height: CGFloat = 31
  static let horizontalInset: CGFloat = 10
  static let contentSpacing: CGFloat = 9
  static let iconSize: CGFloat = 9
  static let iconWidth: CGFloat = 14
  static let indicatorSize: CGFloat = 15
}

private enum FlowingCheckboxVisualStyle {
  case standard
  case icon
}

private struct FlowingCheckboxIconState {
  let accent: FlowingAccent
  let isOn: Bool
}

private struct FlowingCheckboxIconStateKey: EnvironmentKey {
  static let defaultValue: FlowingCheckboxIconState? = nil
}

extension EnvironmentValues {
  fileprivate var flowingCheckboxIconState: FlowingCheckboxIconState? {
    get { self[FlowingCheckboxIconStateKey.self] }
    set { self[FlowingCheckboxIconStateKey.self] = newValue }
  }
}

public struct FlowingCheckbox<Label: View>: View {
  @Binding private var isOn: Bool
  let accent: FlowingAccent?
  let contentAlignment: FlowingCheckboxContentAlignment
  let indicatorPlacement: FlowingCheckboxIndicatorPlacement
  let widthPolicy: FlowingCheckboxWidthPolicy
  let truncationMode: Text.TruncationMode
  private let label: Label
  private let visualStyle: FlowingCheckboxVisualStyle

  public init(
    isOn: Binding<Bool>,
    accent: FlowingAccent? = nil,
    contentAlignment: FlowingCheckboxContentAlignment = .leading,
    indicatorPlacement: FlowingCheckboxIndicatorPlacement = .leading,
    widthPolicy: FlowingCheckboxWidthPolicy = .fill,
    truncationMode: Text.TruncationMode = .tail,
    @ViewBuilder label: () -> Label
  ) {
    _isOn = isOn
    self.accent = accent
    self.contentAlignment = contentAlignment
    self.indicatorPlacement = indicatorPlacement
    self.widthPolicy = widthPolicy
    self.truncationMode = truncationMode
    self.label = label()
    visualStyle = .standard
  }

  private init(
    isOn: Binding<Bool>,
    accent: FlowingAccent?,
    contentAlignment: FlowingCheckboxContentAlignment,
    indicatorPlacement: FlowingCheckboxIndicatorPlacement,
    widthPolicy: FlowingCheckboxWidthPolicy,
    truncationMode: Text.TruncationMode,
    visualStyle: FlowingCheckboxVisualStyle,
    label: Label
  ) {
    _isOn = isOn
    self.accent = accent
    self.contentAlignment = contentAlignment
    self.indicatorPlacement = indicatorPlacement
    self.widthPolicy = widthPolicy
    self.truncationMode = truncationMode
    self.visualStyle = visualStyle
    self.label = label
  }

  public var body: some View {
    Toggle(isOn: $isOn) {
      label
    }
    .toggleStyle(
      FlowingCheckboxToggleStyle(
        accentOverride: accent,
        contentAlignment: contentAlignment,
        indicatorPlacement: indicatorPlacement,
        widthPolicy: widthPolicy,
        truncationMode: truncationMode,
        visualStyle: visualStyle
      )
    )
  }

  func toggle() {
    isOn.toggle()
  }
}

private struct FlowingCheckboxToggleStyle: ToggleStyle {
  @Environment(\.flowingAccent) private var inheritedAccent
  @Environment(\.flowingStrings) private var strings
  @Environment(\.flowingMetrics) private var metrics
  @Environment(\.flowingTypography) private var typography
  @Environment(\.flowingSurfaces) private var surfaces

  let accentOverride: FlowingAccent?
  let contentAlignment: FlowingCheckboxContentAlignment
  let indicatorPlacement: FlowingCheckboxIndicatorPlacement
  let widthPolicy: FlowingCheckboxWidthPolicy
  let truncationMode: Text.TruncationMode
  let visualStyle: FlowingCheckboxVisualStyle

  private var accent: FlowingAccent {
    accentOverride ?? inheritedAccent
  }

  func makeBody(configuration: Configuration) -> some View {
    Button {
      configuration.isOn.toggle()
    } label: {
      sizedContent(configuration)
        .background(
          selectedBackground(isOn: configuration.isOn),
          in: controlShape
        )
        .overlay {
          controlShape.strokeBorder(borderColor(isOn: configuration.isOn))
        }
    }
    .buttonStyle(.plain)
    .animation(.default, value: configuration.isOn)
    .accessibilityValue(configuration.isOn ? strings.selected : strings.notSelected)
  }

  @ViewBuilder
  private func sizedContent(_ configuration: Configuration) -> some View {
    let content = HStack(spacing: contentSpacing) {
      if indicatorPlacement == .leading {
        indicator(isOn: configuration.isOn)
      }
      checkboxLabel(configuration)
      if indicatorPlacement == .trailing {
        indicator(isOn: configuration.isOn)
      }
    }
    .foregroundStyle(standardForeground(isOn: configuration.isOn))
    .padding(.horizontal, horizontalInset)
    .modifier(FlowingCheckboxHeightModifier(visualStyle: visualStyle))

    switch widthPolicy {
    case .fill:
      content.frame(maxWidth: .infinity, alignment: contentAlignment.frameAlignment)
    case .fitContent:
      FlowingFitContentLayout(maximumWidth: widthPolicy.maximumWidth) {
        content
      }
    }
  }

  @ViewBuilder
  private func checkboxLabel(_ configuration: Configuration) -> some View {
    let label = configuration.label
      .font(typography.selectionLabel.font)
      .lineLimit(1)
      .truncationMode(truncationMode)

    let styledLabel = label.environment(
      \.flowingCheckboxIconState,
      visualStyle == .icon
        ? FlowingCheckboxIconState(accent: accent, isOn: configuration.isOn)
        : nil
    )

    if indicatorPlacement == .trailing && widthPolicy == .fill {
      styledLabel.frame(maxWidth: .infinity, alignment: contentAlignment.frameAlignment)
    } else {
      styledLabel
    }
  }

  @ViewBuilder
  private func indicator(isOn: Bool) -> some View {
    if visualStyle == .icon {
      ZStack {
        Circle()
          .fill(isOn ? accent.fill : Color.clear)
        Circle()
          .stroke(isOn ? accent.fill : FlowingPalette.edge)
        Image(systemName: "checkmark")
          .font(.system(size: 7, weight: .bold))
          .foregroundStyle(.white)
          .opacity(isOn ? 1 : 0)
      }
      .frame(
        width: FlowingCheckboxIconMetrics.indicatorSize,
        height: FlowingCheckboxIconMetrics.indicatorSize
      )
    } else {
      Image(systemName: isOn ? "checkmark.circle.fill" : "circle")
        .font(.system(size: 11, weight: .semibold))
    }
  }

  private var contentSpacing: CGFloat {
    visualStyle == .icon ? FlowingCheckboxIconMetrics.contentSpacing : 6
  }

  private var horizontalInset: CGFloat {
    visualStyle == .icon ? FlowingCheckboxIconMetrics.horizontalInset : 9
  }

  private var controlShape: RoundedRectangle {
    RoundedRectangle(cornerRadius: metrics.controlRadius, style: .continuous)
  }

  private func selectedBackground(isOn: Bool) -> Color {
    guard isOn else { return surfaces.control }
    return visualStyle == .icon ? accent.fill.opacity(0.065) : accent.wash
  }

  private func borderColor(isOn: Bool) -> Color {
    guard isOn else { return FlowingPalette.hairline }
    return visualStyle == .icon
      ? accent.fill.opacity(0.15)
      : accent.foreground.opacity(0.22)
  }

  private func standardForeground(isOn: Bool) -> Color {
    guard visualStyle == .standard else { return FlowingPalette.ink }
    return isOn ? accent.foreground : FlowingPalette.muted
  }
}

private struct FlowingCheckboxHeightModifier: ViewModifier {
  let visualStyle: FlowingCheckboxVisualStyle

  func body(content: Content) -> some View {
    if visualStyle == .icon {
      content.frame(height: FlowingCheckboxIconMetrics.height)
    } else {
      content.padding(.vertical, 7)
    }
  }
}

private struct FlowingFitContentLayout: Layout {
  let maximumWidth: CGFloat?

  func sizeThatFits(
    proposal: ProposedViewSize,
    subviews: Subviews,
    cache: inout ()
  ) -> CGSize {
    guard let subview = subviews.first else { return .zero }

    let intrinsicSize = subview.sizeThatFits(.unspecified)
    let availableWidth = proposal.width.flatMap { width in
      width.isFinite ? max(0, width) : nil
    }
    let width = min(
      intrinsicSize.width,
      min(maximumWidth ?? .infinity, availableWidth ?? .infinity)
    )
    let constrainedSize = subview.sizeThatFits(
      ProposedViewSize(width: width, height: proposal.height)
    )
    return CGSize(width: width, height: constrainedSize.height)
  }

  func placeSubviews(
    in bounds: CGRect,
    proposal: ProposedViewSize,
    subviews: Subviews,
    cache: inout ()
  ) {
    guard let subview = subviews.first else { return }
    subview.place(
      at: bounds.origin,
      anchor: .topLeading,
      proposal: ProposedViewSize(width: bounds.width, height: bounds.height)
    )
  }
}

extension FlowingCheckbox where Label == Text {
  public init(
    _ title: String,
    isOn: Binding<Bool>,
    accent: FlowingAccent? = nil,
    contentAlignment: FlowingCheckboxContentAlignment = .leading,
    indicatorPlacement: FlowingCheckboxIndicatorPlacement = .leading,
    widthPolicy: FlowingCheckboxWidthPolicy = .fill,
    truncationMode: Text.TruncationMode = .tail
  ) {
    self.init(
      isOn: isOn,
      accent: accent,
      contentAlignment: contentAlignment,
      indicatorPlacement: indicatorPlacement,
      widthPolicy: widthPolicy,
      truncationMode: truncationMode
    ) {
      Text(title)
    }
  }
}

public struct FlowingCheckboxIconLabel: View {
  @Environment(\.flowingCheckboxIconState) private var state
  private let title: String
  private let systemImage: String

  public init(_ title: String, systemImage: String) {
    self.title = title
    self.systemImage = systemImage
  }

  public var body: some View {
    HStack(spacing: FlowingCheckboxIconMetrics.contentSpacing) {
      Image(systemName: systemImage)
        .font(.system(size: FlowingCheckboxIconMetrics.iconSize, weight: .medium))
        .foregroundStyle(iconColor)
        .frame(width: FlowingCheckboxIconMetrics.iconWidth)
      Text(title)
        .foregroundStyle(state?.isOn == false ? FlowingPalette.faint : FlowingPalette.ink)
    }
    .font(.system(size: 11, weight: .medium))
  }

  private var iconColor: Color {
    guard let state else { return FlowingPalette.muted }
    return state.accent.fill.opacity(state.isOn ? 1 : 0.3)
  }
}

extension FlowingCheckbox where Label == FlowingCheckboxIconLabel {
  public init(
    _ title: String,
    systemImage: String,
    isOn: Binding<Bool>,
    accent: FlowingAccent? = nil,
    contentAlignment: FlowingCheckboxContentAlignment = .leading,
    indicatorPlacement: FlowingCheckboxIndicatorPlacement = .leading,
    widthPolicy: FlowingCheckboxWidthPolicy = .fill,
    truncationMode: Text.TruncationMode = .tail
  ) {
    self.init(
      isOn: isOn,
      accent: accent,
      contentAlignment: contentAlignment,
      indicatorPlacement: indicatorPlacement,
      widthPolicy: widthPolicy,
      truncationMode: truncationMode,
      visualStyle: .icon,
      label: FlowingCheckboxIconLabel(title, systemImage: systemImage)
    )
  }
}
