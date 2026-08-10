import SwiftUI

public enum FlowingEmptyStateLayout: String, CaseIterable, Sendable {
  case inline
  case stacked
}

private enum FlowingEmptyStateMetrics {
  static let inlineSpacing: CGFloat = 10
  static let inlineIconWidth: CGFloat = 18
  static let stackedSpacing: CGFloat = 10
  static let stackedIconSize: CGFloat = 22
}

public struct FlowingEmptyState<Content: View>: View {
  @Environment(\.preferencesTypography) private var typography
  private let content: Content
  private let layout: FlowingEmptyStateLayout
  private let systemImage: String?

  public init(
    systemImage: String? = nil,
    layout: FlowingEmptyStateLayout = .stacked,
    @ViewBuilder content: () -> Content
  ) {
    self.systemImage = systemImage
    self.layout = layout
    self.content = content()
  }

  public var body: some View {
    Group {
      switch layout {
      case .inline:
        HStack(
          alignment: .firstTextBaseline,
          spacing: FlowingEmptyStateMetrics.inlineSpacing
        ) {
          icon
          content.fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      case .stacked:
        VStack(spacing: FlowingEmptyStateMetrics.stackedSpacing) {
          icon
          content.fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .center)
      }
    }
    .font(typography.value.font)
    .foregroundStyle(PreferencesPalette.faint)
    .accessibilityElement(children: .combine)
  }

  @ViewBuilder
  private var icon: some View {
    if let systemImage {
      Image(systemName: systemImage)
        .font(iconFont)
        .frame(width: iconWidth)
    }
  }

  private var iconFont: Font {
    switch layout {
    case .inline: typography.value.font
    case .stacked:
      .system(size: FlowingEmptyStateMetrics.stackedIconSize, weight: .medium)
    }
  }

  private var iconWidth: CGFloat? {
    switch layout {
    case .inline: FlowingEmptyStateMetrics.inlineIconWidth
    case .stacked: nil
    }
  }
}

extension FlowingEmptyState where Content == Text {
  public init(
    _ message: String,
    systemImage: String? = nil,
    layout: FlowingEmptyStateLayout = .stacked
  ) {
    self.init(systemImage: systemImage, layout: layout) {
      Text(message)
    }
  }
}
