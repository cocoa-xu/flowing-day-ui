import SwiftUI

public struct FlowingSoftButtonStyle: ButtonStyle {
  @Environment(\.flowingAccent) private var accent
  @Environment(\.flowingMetrics) private var metrics
  @Environment(\.flowingTypography) private var typography
  private let isProminent: Bool

  public init(isProminent: Bool = false) {
    self.isProminent = isProminent
  }

  public func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(typography.buttonLabel.font)
      .foregroundStyle(
        isProminent
          ? AnyShapeStyle(Color.white)
          : AnyShapeStyle(accent.foreground)
      )
      .padding(.horizontal, 12)
      .padding(.vertical, 5)
      .background {
        RoundedRectangle(cornerRadius: metrics.controlRadius, style: .continuous)
          .fill(
            isProminent
              ? AnyShapeStyle(accent.fill)
              : AnyShapeStyle(accent.veil)
          )
      }
      .overlay {
        RoundedRectangle(cornerRadius: metrics.controlRadius, style: .continuous)
          .strokeBorder(isProminent ? Color.clear : FlowingPalette.hairline)
      }
      .opacity(configuration.isPressed ? 0.6 : 1)
  }
}
