import SwiftUI

public enum FlowingTextFieldEmphasis: String, CaseIterable, Sendable {
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
}

public struct FlowingTextField: View {
  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.preferencesAccent) private var accent
  @Environment(\.preferencesSurfaces) private var surfaces
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
    HStack(spacing: FlowingTextFieldMetrics.contentSpacing) {
      if let systemImage {
        Image(systemName: systemImage)
          .font(.system(size: FlowingTextFieldMetrics.iconSize, weight: .medium))
          .foregroundStyle(iconColor)
          .frame(width: FlowingTextFieldMetrics.iconWidth)
      }
      TextField(placeholder, text: $text)
        .textFieldStyle(.plain)
        .font(typography.value.font)
        .foregroundStyle(PreferencesPalette.ink)
        .onSubmit(onSubmit)
        .accessibilityLabel(label)
    }
    .padding(.horizontal, FlowingTextFieldMetrics.horizontalInset)
    .frame(height: FlowingTextFieldMetrics.height)
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
    switch emphasis {
    case .standard: PreferencesPalette.hairline
    case .accented: accent.fill.opacity(0.16)
    }
  }

  private var iconColor: Color {
    switch emphasis {
    case .standard: PreferencesPalette.muted
    case .accented: accent.foreground.opacity(0.72)
    }
  }

  private var fieldShape: RoundedRectangle {
    RoundedRectangle(
      cornerRadius: FlowingTextFieldMetrics.cornerRadius,
      style: .continuous
    )
  }
}
