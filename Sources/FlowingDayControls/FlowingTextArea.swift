import SwiftUI

public struct FlowingTextArea: View {
  public static let standardMinimumHeight: CGFloat = 84

  @Environment(\.flowingTypography) private var typography
  @FocusState private var isFocused: Bool
  @Binding private var text: String
  private let emphasis: FlowingTextFieldEmphasis
  private let label: String
  private let minimumHeight: CGFloat
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
    minimumHeight: CGFloat = FlowingTextArea.standardMinimumHeight
  ) {
    precondition(minimumHeight.isFinite && minimumHeight > 0)
    self.label = label
    _text = text
    self.placeholder = placeholder ?? label
    self.systemImage = systemImage
    self.emphasis = emphasis
    self.supportingText = supportingText
    self.validation = validation
    self.minimumHeight = minimumHeight
  }

  public var body: some View {
    FlowingFieldContainer(validation: validation, supportingText: supportingText) {
      HStack(alignment: .top, spacing: FlowingTextFieldMetrics.contentSpacing) {
        FlowingFieldIcon(systemImage: systemImage, emphasis: emphasis)
          .padding(.top, FlowingTextFieldMetrics.textAreaVerticalInset)
        editor
      }
      .padding(.horizontal, FlowingTextFieldMetrics.horizontalInset)
      .padding(.vertical, FlowingTextFieldMetrics.textAreaVerticalInset)
      .frame(minHeight: minimumHeight)
      .modifier(
        FlowingFieldChrome(
          emphasis: emphasis,
          validation: validation,
          isFocused: isFocused
        )
      )
    }
  }

  private var editor: some View {
    ZStack(alignment: .topLeading) {
      if text.isEmpty {
        Text(placeholder)
          .font(typography.value.font)
          .foregroundStyle(FlowingPalette.faint)
          .padding(.horizontal, 5)
          .padding(.vertical, 7)
          .allowsHitTesting(false)
      }
      TextEditor(text: $text)
        .scrollContentBackground(.hidden)
        .font(typography.value.font)
        .foregroundStyle(FlowingPalette.ink)
        .focused($isFocused)
        .accessibilityLabel(label)
    }
  }
}
