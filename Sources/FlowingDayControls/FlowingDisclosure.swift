import SwiftUI

enum FlowingDisclosureMotion {
  static let standardDuration = FlowingMotion.disclosure
  static let reducedMotionDuration = FlowingMotion.reducedDisclosure
  static let detailOffset = FlowingMotion.disclosureOffset

  static func duration(reduceMotion: Bool) -> TimeInterval {
    reduceMotion ? reducedMotionDuration : standardDuration
  }

  static func offset(reduceMotion: Bool) -> CGFloat {
    reduceMotion ? FlowingMotion.reducedDisclosureOffset : detailOffset
  }

  static func animation(reduceMotion: Bool) -> Animation {
    let duration = duration(reduceMotion: reduceMotion)
    return reduceMotion
      ? .linear(duration: duration)
      : .easeOut(duration: duration)
  }

  static func transition(reduceMotion: Bool) -> AnyTransition {
    let offset = offset(reduceMotion: reduceMotion)
    return offset == 0
      ? .opacity
      : .opacity.combined(with: .offset(y: offset))
  }
}

enum FlowingDisclosureMetrics {
  static let defaultContentInsets = EdgeInsets(
    top: 8,
    leading: 10,
    bottom: 8,
    trailing: 10
  )
}

public struct FlowingDisclosureContent<Content: View>: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  private let isExpanded: Bool
  private let content: Content

  public init(
    isExpanded: Bool,
    @ViewBuilder content: () -> Content
  ) {
    self.isExpanded = isExpanded
    self.content = content()
  }

  public var body: some View {
    VStack(spacing: 0) {
      if isExpanded {
        content
          .transition(FlowingDisclosureMotion.transition(reduceMotion: reduceMotion))
      }
    }
    .clipped()
    .animation(
      FlowingDisclosureMotion.animation(reduceMotion: reduceMotion),
      value: isExpanded
    )
  }
}

public struct FlowingDisclosure<Label: View, Content: View>: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.flowingAccent) private var accent
  @Environment(\.flowingStrings) private var strings
  @Environment(\.flowingTypography) private var typography
  @Binding private var isExpanded: Bool
  private let minimumHeaderHeight: CGFloat?
  private let contentInsets: EdgeInsets?
  private let label: Label
  private let content: Content

  public init(
    isExpanded: Binding<Bool>,
    minimumHeaderHeight: CGFloat? = nil,
    contentInsets: EdgeInsets? = nil,
    @ViewBuilder label: () -> Label,
    @ViewBuilder content: () -> Content
  ) {
    if let minimumHeaderHeight {
      precondition(minimumHeaderHeight >= 0 && minimumHeaderHeight.isFinite)
    }
    _isExpanded = isExpanded
    self.minimumHeaderHeight = minimumHeaderHeight
    self.contentInsets = contentInsets
    self.label = label()
    self.content = content()
  }

  public var body: some View {
    VStack(spacing: 0) {
      Button {
        isExpanded.toggle()
      } label: {
        HStack(spacing: 10) {
          label
            .font(typography.selectionLabel.font)
            .foregroundStyle(FlowingPalette.ink)
          Spacer(minLength: 10)
          Image(systemName: "chevron.down")
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(accent.foreground)
            .rotationEffect(.degrees(isExpanded ? 180 : 0))
        }
        .padding(contentInsets ?? FlowingDisclosureMetrics.defaultContentInsets)
        .frame(minHeight: minimumHeaderHeight)
        .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      .modifier(FlowingFocusEffectDisabledModifier())
      .accessibilityValue(isExpanded ? strings.expanded : strings.collapsed)

      FlowingDisclosureContent(isExpanded: isExpanded) {
        content
      }
    }
    .animation(
      reduceMotion ? nil : .easeOut(duration: FlowingMotion.expand),
      value: isExpanded
    )
  }
}

extension FlowingDisclosure where Label == Text {
  public init(
    _ title: String,
    isExpanded: Binding<Bool>,
    minimumHeaderHeight: CGFloat? = nil,
    contentInsets: EdgeInsets? = nil,
    @ViewBuilder content: () -> Content
  ) {
    self.init(
      isExpanded: isExpanded,
      minimumHeaderHeight: minimumHeaderHeight,
      contentInsets: contentInsets,
      label: { Text(title) },
      content: content
    )
  }
}
