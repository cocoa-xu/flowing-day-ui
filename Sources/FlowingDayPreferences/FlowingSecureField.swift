import SwiftUI

public struct FlowingSecureField: View {
  @Environment(\.preferencesTypography) private var typography
  @Binding private var text: String
  private let emphasis: FlowingTextFieldEmphasis
  private let label: String
  private let onSubmit: () -> Void
  private let placeholder: String
  private let systemImage: String?

  public init(
    _ label: String,
    text: Binding<String>,
    placeholder: String? = nil,
    systemImage: String? = nil,
    emphasis: FlowingTextFieldEmphasis = .standard,
    onSubmit: @escaping () -> Void = {}
  ) {
    self.label = label
    _text = text
    self.placeholder = placeholder ?? label
    self.systemImage = systemImage
    self.emphasis = emphasis
    self.onSubmit = onSubmit
  }

  public var body: some View {
    FlowingSingleLineField(systemImage: systemImage, emphasis: emphasis) {
      SecureField(placeholder, text: $text)
        .textFieldStyle(.plain)
        .font(typography.value.font)
        .foregroundStyle(PreferencesPalette.ink)
        .onSubmit(onSubmit)
        .accessibilityLabel(label)
    }
  }
}
