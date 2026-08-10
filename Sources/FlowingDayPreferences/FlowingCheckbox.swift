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

  var horizontalAlignment: HorizontalAlignment {
    switch self {
    case .leading: .leading
    case .center: .center
    case .trailing: .trailing
    }
  }
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

public struct FlowingCheckbox<Label: View>: View {
  @Binding private var isOn: Bool
  let contentAlignment: FlowingCheckboxContentAlignment
  let widthPolicy: FlowingCheckboxWidthPolicy
  let truncationMode: Text.TruncationMode
  private let label: Label

  public init(
    isOn: Binding<Bool>,
    contentAlignment: FlowingCheckboxContentAlignment = .leading,
    widthPolicy: FlowingCheckboxWidthPolicy = .fill,
    truncationMode: Text.TruncationMode = .tail,
    @ViewBuilder label: () -> Label
  ) {
    _isOn = isOn
    self.contentAlignment = contentAlignment
    self.widthPolicy = widthPolicy
    self.truncationMode = truncationMode
    self.label = label()
  }

  public var body: some View {
    Toggle(isOn: $isOn) {
      label
    }
    .toggleStyle(
      FlowingCheckboxToggleStyle(
        contentAlignment: contentAlignment,
        widthPolicy: widthPolicy,
        truncationMode: truncationMode
      )
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
  let widthPolicy: FlowingCheckboxWidthPolicy
  let truncationMode: Text.TruncationMode

  func makeBody(configuration: Configuration) -> some View {
    Button {
      configuration.isOn.toggle()
    } label: {
      sizedContent(configuration)
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

  @ViewBuilder
  private func sizedContent(_ configuration: Configuration) -> some View {
    let content = HStack(spacing: 6) {
      Image(systemName: configuration.isOn ? "checkmark.circle.fill" : "circle")
        .font(.system(size: 11, weight: .semibold))
      configuration.label
        .font(typography.selectionLabel.font)
        .lineLimit(1)
        .truncationMode(truncationMode)
    }
    .foregroundStyle(configuration.isOn ? accent.foreground : PreferencesPalette.muted)
    .padding(.horizontal, 9)
    .padding(.vertical, 7)

    switch widthPolicy {
    case .fill:
      content.frame(maxWidth: .infinity, alignment: contentAlignment.frameAlignment)
    case .fitContent:
      content
        .frame(maxWidth: widthPolicy.maximumWidth, alignment: contentAlignment.frameAlignment)
        .fixedSize(horizontal: widthPolicy.maximumWidth == nil, vertical: false)
    }
  }
}

extension FlowingCheckbox where Label == Text {
  public init(
    _ title: String,
    isOn: Binding<Bool>,
    contentAlignment: FlowingCheckboxContentAlignment = .leading,
    widthPolicy: FlowingCheckboxWidthPolicy = .fill,
    truncationMode: Text.TruncationMode = .tail
  ) {
    self.init(
      isOn: isOn,
      contentAlignment: contentAlignment,
      widthPolicy: widthPolicy,
      truncationMode: truncationMode
    ) {
      Text(title)
    }
  }
}
