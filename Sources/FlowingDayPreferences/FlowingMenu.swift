import SwiftUI

enum FlowingMenuMetrics {
  static let controlHeight: CGFloat = 29
  static let horizontalInset: CGFloat = 10
  static let contentSpacing: CGFloat = 7
  static let disabledOpacity = 0.42
}

public struct FlowingMenu<Content: View>: View {
  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.preferencesAccent) private var accent
  @Environment(\.preferencesMetrics) private var metrics
  @Environment(\.preferencesTypography) private var typography
  @State private var isHovering = false
  private let title: String
  private let systemImage: String?
  private let minimumWidth: CGFloat
  private let fillsAvailableWidth: Bool
  private let content: Content

  public init(
    _ title: String,
    systemImage: String? = nil,
    minimumWidth: CGFloat = 0,
    fillsAvailableWidth: Bool = false,
    @ViewBuilder content: () -> Content
  ) {
    precondition(minimumWidth.isFinite && minimumWidth >= 0)
    self.title = title
    self.systemImage = systemImage
    self.minimumWidth = minimumWidth
    self.fillsAvailableWidth = fillsAvailableWidth
    self.content = content()
  }

  public var body: some View {
    Menu {
      content
    } label: {
      HStack(spacing: FlowingMenuMetrics.contentSpacing) {
        if let systemImage {
          Image(systemName: systemImage)
            .font(.system(size: 11, weight: .semibold))
        }
        Text(title)
          .font(typography.buttonLabel.font)
          .lineLimit(1)
        Spacer(minLength: 4)
        Image(systemName: "chevron.down")
          .font(.system(size: 8, weight: .bold))
      }
      .foregroundStyle(accent.foreground)
      .padding(.horizontal, FlowingMenuMetrics.horizontalInset)
      .frame(
        minWidth: minimumWidth,
        maxWidth: fillsAvailableWidth ? .infinity : nil
      )
      .frame(height: FlowingMenuMetrics.controlHeight)
      .background(
        isHovering && isEnabled ? accent.wash : accent.veil,
        in: controlShape
      )
      .overlay {
        controlShape.strokeBorder(accent.foreground.opacity(0.16))
      }
      .contentShape(Rectangle())
    }
    .menuStyle(.borderlessButton)
    .menuIndicator(.hidden)
    .fixedSize(horizontal: !fillsAvailableWidth, vertical: false)
    .opacity(isEnabled ? 1 : FlowingMenuMetrics.disabledOpacity)
    .onHover { isHovering = $0 }
    .help(title)
    .accessibilityLabel(title)
  }

  private var controlShape: RoundedRectangle {
    RoundedRectangle(cornerRadius: metrics.controlRadius, style: .continuous)
  }
}
