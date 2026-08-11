import SwiftUI

public struct FlowingSecureField: View {
  @Environment(\.flowingTypography) private var typography
  @FocusState private var isFocused: Bool
  @Binding private var text: String
  private let emphasis: FlowingTextFieldEmphasis
  private let label: String
  private let onSubmit: () -> Void
  private let placeholder: String
  private let supportingText: String?
  private let systemImage: String?
  private let validation: FlowingFieldValidation

  public init(
    _ label: String,
    text: Binding<String>,
    placeholder: String? = nil,
    systemImage: String? = nil,
    emphasis: FlowingTextFieldEmphasis = .standard,
    supportingText: String? = nil,
    validation: FlowingFieldValidation = .none,
    onSubmit: @escaping () -> Void = {}
  ) {
    self.label = label
    _text = text
    self.placeholder = placeholder ?? label
    self.systemImage = systemImage
    self.emphasis = emphasis
    self.supportingText = supportingText
    self.validation = validation
    self.onSubmit = onSubmit
  }

  public var body: some View {
    FlowingFieldContainer(validation: validation, supportingText: supportingText) {
      FlowingSingleLineField(
        systemImage: systemImage,
        emphasis: emphasis,
        validation: validation,
        isFocused: isFocused
      ) {
        SecureField(placeholder, text: $text)
          .textFieldStyle(.plain)
          .font(typography.value.font)
          .foregroundStyle(FlowingPalette.ink)
          .focused($isFocused)
          .onSubmit(onSubmit)
          .accessibilityLabel(label)
      }
    }
  }
}
