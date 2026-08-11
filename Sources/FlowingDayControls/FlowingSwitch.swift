import SwiftUI

public struct FlowingSwitch: View {
  @Environment(\.flowingAccent) private var accent
  @Environment(\.flowingTypography) private var typography
  @Binding private var isOn: Bool
  private let title: String?

  public init(isOn: Binding<Bool>) {
    title = nil
    _isOn = isOn
  }

  public init(_ title: String, isOn: Binding<Bool>) {
    self.title = title
    _isOn = isOn
  }

  public var body: some View {
    Toggle(isOn: $isOn) {
      if let title {
        Text(title)
          .font(typography.rowTitle.font)
          .foregroundStyle(FlowingPalette.ink)
      }
    }
    .toggleStyle(.switch)
    .controlSize(.small)
    .tint(accent.fill)
  }
}
