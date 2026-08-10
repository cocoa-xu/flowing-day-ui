import SwiftUI

public enum FlowingCheckboxContentAlignment: String, CaseIterable, Sendable {
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

public struct FlowingCheckbox<Label: View>: View {
  @Binding private var isOn: Bool
  let contentAlignment: FlowingCheckboxContentAlignment
  private let label: Label

  public init(
    isOn: Binding<Bool>,
    contentAlignment: FlowingCheckboxContentAlignment = .leading,
    @ViewBuilder label: () -> Label
  ) {
    _isOn = isOn
    self.contentAlignment = contentAlignment
    self.label = label()
  }

  public var body: some View {
    Toggle(isOn: $isOn) {
      label
    }
    .toggleStyle(
      FlowingCheckboxToggleStyle(contentAlignment: contentAlignment)
    )
  }

  func toggle() {
    isOn.toggle()
  }
}

private struct FlowingCheckboxToggleStyle: ToggleStyle {
  @Environment(\.preferencesAccent) private var accent
  @Environment(\.preferencesStrings) private var strings
  @Environment(\.preferencesMetrics) private var metrics
  @Environment(\.preferencesTypography) private var typography
  @Environment(\.preferencesSurfaces) private var surfaces

  let contentAlignment: FlowingCheckboxContentAlignment

  func makeBody(configuration: Configuration) -> some View {
    Button {
      configuration.isOn.toggle()
    } label: {
      HStack(spacing: 6) {
        Image(systemName: configuration.isOn ? "checkmark.circle.fill" : "circle")
          .font(.system(size: 11, weight: .semibold))
        configuration.label
          .font(typography.selectionLabel.font)
          .lineLimit(1)
      }
      .foregroundStyle(configuration.isOn ? accent.foreground : PreferencesPalette.muted)
      .frame(maxWidth: .infinity, alignment: contentAlignment.frameAlignment)
      .padding(.horizontal, 9)
      .padding(.vertical, 7)
      .background(
        configuration.isOn ? accent.wash : surfaces.control,
        in: RoundedRectangle(cornerRadius: metrics.controlRadius, style: .continuous)
      )
      .overlay {
        RoundedRectangle(cornerRadius: metrics.controlRadius, style: .continuous)
          .strokeBorder(
            configuration.isOn
              ? accent.foreground.opacity(0.22)
              : PreferencesPalette.hairline
          )
      }
    }
    .buttonStyle(.plain)
    .animation(.default, value: configuration.isOn)
    .accessibilityValue(configuration.isOn ? strings.selected : strings.notSelected)
  }
}

extension FlowingCheckbox where Label == Text {
  public init(
    _ title: String,
    isOn: Binding<Bool>,
    contentAlignment: FlowingCheckboxContentAlignment = .leading
  ) {
    self.init(isOn: isOn, contentAlignment: contentAlignment) {
      Text(title)
    }
  }
}
