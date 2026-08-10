import SwiftUI

public enum FlowingTextFieldEmphasis: String, CaseIterable, Hashable, Sendable {
  case standard
  case accented
}

enum FlowingTextFieldMetrics {
  static let height: CGFloat = 30
  static let horizontalInset: CGFloat = 10
  static let contentSpacing: CGFloat = 8
  static let iconSize: CGFloat = 11
  static let iconWidth: CGFloat = 14
  static let cornerRadius: CGFloat = 8
  static let textAreaVerticalInset: CGFloat = 6
}

struct FlowingSingleLineField<Editor: View>: View {
  private let editor: Editor
  private let emphasis: FlowingTextFieldEmphasis
  private let isFocused: Bool
  private let systemImage: String?
  private let validation: FlowingFieldValidation

  init(
    systemImage: String?,
    emphasis: FlowingTextFieldEmphasis,
    validation: FlowingFieldValidation,
    isFocused: Bool,
    @ViewBuilder editor: () -> Editor
  ) {
    self.systemImage = systemImage
    self.emphasis = emphasis
    self.validation = validation
    self.isFocused = isFocused
    self.editor = editor()
  }

  var body: some View {
    HStack(spacing: FlowingTextFieldMetrics.contentSpacing) {
      FlowingFieldIcon(systemImage: systemImage, emphasis: emphasis)
      editor
    }
    .padding(.horizontal, FlowingTextFieldMetrics.horizontalInset)
    .frame(height: FlowingTextFieldMetrics.height)
    .modifier(
      FlowingFieldChrome(
        emphasis: emphasis,
        validation: validation,
        isFocused: isFocused
      )
    )
  }
}

struct FlowingFieldIcon: View {
  @Environment(\.preferencesAccent) private var accent
  private let emphasis: FlowingTextFieldEmphasis
  private let systemImage: String?

  init(systemImage: String?, emphasis: FlowingTextFieldEmphasis) {
    self.systemImage = systemImage
    self.emphasis = emphasis
  }

  var body: some View {
    if let systemImage {
      Image(systemName: systemImage)
        .font(.system(size: FlowingTextFieldMetrics.iconSize, weight: .medium))
        .foregroundStyle(iconColor)
        .frame(width: FlowingTextFieldMetrics.iconWidth)
    }
  }

  private var iconColor: Color {
    switch emphasis {
    case .standard: PreferencesPalette.muted
    case .accented: accent.foreground.opacity(0.72)
    }
  }
}

struct FlowingFieldChrome: ViewModifier {
  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.preferencesAccent) private var accent
  @Environment(\.preferencesSurfaces) private var surfaces
  let emphasis: FlowingTextFieldEmphasis
  let validation: FlowingFieldValidation
  let isFocused: Bool

  func body(content: Content) -> some View {
    content
      .background(backgroundColor, in: fieldShape)
      .overlay {
        fieldShape.strokeBorder(borderColor)
      }
      .opacity(isEnabled ? 1 : 0.55)
  }

  private var backgroundColor: Color {
    switch emphasis {
    case .standard: surfaces.field
    case .accented: accent.veil
    }
  }

  private var borderColor: Color {
    if validation != .none {
      return validation.color(accent: accent).opacity(0.58)
    }
    if isFocused {
      return accent.foreground.opacity(0.46)
    }
    return switch emphasis {
    case .standard: PreferencesPalette.hairline
    case .accented: accent.fill.opacity(0.16)
    }
  }

  private var fieldShape: RoundedRectangle {
    RoundedRectangle(
      cornerRadius: FlowingTextFieldMetrics.cornerRadius,
      style: .continuous
    )
  }
}

public struct FlowingTextField: View {
  @Environment(\.preferencesTypography) private var typography
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
        TextField(placeholder, text: $text)
          .textFieldStyle(.plain)
          .font(typography.value.font)
          .foregroundStyle(PreferencesPalette.ink)
          .focused($isFocused)
          .onSubmit(onSubmit)
          .accessibilityLabel(label)
      }
    }
  }
}
