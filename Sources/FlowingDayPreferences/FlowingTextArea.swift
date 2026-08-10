import SwiftUI

public struct FlowingTextArea: View {
  public static let standardMinimumHeight: CGFloat = 84

  @Environment(\.preferencesTypography) private var typography
  @FocusState private var isFocused: Bool
  @Binding private var text: String
  private let emphasis: FlowingTextFieldEmphasis
  private let label: String
  private let minimumHeight: CGFloat
  private let placeholder: String
  private let systemImage: String?

  public init(
    _ label: String,
    text: Binding<String>,
    placeholder: String? = nil,
    systemImage: String? = nil,
    emphasis: FlowingTextFieldEmphasis = .standard,
    minimumHeight: CGFloat = FlowingTextArea.standardMinimumHeight
  ) {
    precondition(minimumHeight.isFinite && minimumHeight > 0)
    self.label = label
    _text = text
    self.placeholder = placeholder ?? label
    self.systemImage = systemImage
    self.emphasis = emphasis
    self.minimumHeight = minimumHeight
  }

  public var body: some View {
    HStack(alignment: .top, spacing: FlowingTextFieldMetrics.contentSpacing) {
      FlowingFieldIcon(systemImage: systemImage, emphasis: emphasis)
        .padding(.top, FlowingTextFieldMetrics.textAreaVerticalInset)
      editor
    }
    .padding(.horizontal, FlowingTextFieldMetrics.horizontalInset)
    .padding(.vertical, FlowingTextFieldMetrics.textAreaVerticalInset)
    .frame(minHeight: minimumHeight)
    .modifier(FlowingFieldChrome(emphasis: emphasis))
  }

  private var editor: some View {
    ZStack(alignment: .topLeading) {
      if text.isEmpty {
        Text(placeholder)
          .font(typography.value.font)
          .foregroundStyle(PreferencesPalette.faint)
          .padding(.horizontal, 5)
          .padding(.vertical, 7)
          .allowsHitTesting(false)
      }
      TextEditor(text: $text)
        .scrollContentBackground(.hidden)
        .font(typography.value.font)
        .foregroundStyle(PreferencesPalette.ink)
        .focused($isFocused)
        .accessibilityLabel(label)
    }
  }
}
