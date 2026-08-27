import SwiftUI

public enum FlowingSwitchTrackStyle: Sendable {
  case system
  case exactAccent
}

public struct FlowingSwitch: View {
  @Environment(\.flowingAccent) private var accent
  @Environment(\.flowingTypography) private var typography
  @Binding private var isOn: Bool
  private let title: String
  private let trackStyle: FlowingSwitchTrackStyle

  public init(
    _ title: String,
    isOn: Binding<Bool>,
    trackStyle: FlowingSwitchTrackStyle = .system
  ) {
    self.title = title
    _isOn = isOn
    self.trackStyle = trackStyle
  }

  @ViewBuilder
  public var body: some View {
    switch trackStyle {
    case .system:
      toggle
        .toggleStyle(.switch)
        .controlSize(.small)
        .tint(accent.fill)
    case .exactAccent:
      toggle
        .toggleStyle(
          ExactAccentSwitchToggleStyle(
            trackColor: accent.fill,
            accessibilityTitle: title
          ))
    }
  }

  private var toggle: some View {
    Toggle(isOn: $isOn) {
      Text(title)
        .font(typography.rowTitle.font)
        .foregroundStyle(FlowingPalette.ink)
    }
  }
}

private struct ExactAccentSwitchToggleStyle: ToggleStyle {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.isEnabled) private var isEnabled
  let trackColor: Color
  let accessibilityTitle: String

  func makeBody(configuration: Configuration) -> some View {
    Button {
      configuration.isOn.toggle()
    } label: {
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(configuration.isOn ? trackColor : FlowingPalette.faint.opacity(0.28))
        .frame(width: 34, height: 20)
        .overlay {
          Circle()
            .fill(.white)
            .frame(width: 16, height: 16)
            .offset(x: configuration.isOn ? 7 : -7)
        }
    }
    .buttonStyle(.plain)
    .disabled(!isEnabled)
    .opacity(isEnabled ? 1 : 0.55)
    .animation(reduceMotion ? nil : .easeInOut(duration: 0.14), value: configuration.isOn)
    .accessibilityLabel(accessibilityTitle)
    .accessibilityValue(configuration.isOn ? "On" : "Off")
  }
}
