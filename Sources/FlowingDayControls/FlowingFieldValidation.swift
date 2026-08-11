import SwiftUI

public enum FlowingFieldValidation: Equatable, Sendable {
  case none
  case success(String?)
  case warning(String)
  case error(String)

  public var message: String? {
    switch self {
    case .none: nil
    case .success(let message): message
    case .warning(let message), .error(let message): message
    }
  }

  var systemImage: String? {
    switch self {
    case .none: nil
    case .success: "checkmark.circle.fill"
    case .warning: "exclamationmark.triangle.fill"
    case .error: "xmark.circle.fill"
    }
  }

  func color(accent: FlowingAccent) -> Color {
    switch self {
    case .none: FlowingPalette.faint
    case .success: FlowingStatusTone.success.color(accent: accent)
    case .warning: FlowingStatusTone.warning.color(accent: accent)
    case .error: FlowingStatusTone.critical.color(accent: accent)
    }
  }
}

struct FlowingFieldContainer<Content: View>: View {
  @Environment(\.flowingAccent) private var accent
  @Environment(\.flowingTypography) private var typography
  let validation: FlowingFieldValidation
  let supportingText: String?
  let content: Content

  init(
    validation: FlowingFieldValidation,
    supportingText: String?,
    @ViewBuilder content: () -> Content
  ) {
    self.validation = validation
    self.supportingText = supportingText
    self.content = content()
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 5) {
      content
      if let message = validation.message ?? supportingText {
        let displayedValidation =
          validation.message == nil ? FlowingFieldValidation.none : validation
        HStack(alignment: .firstTextBaseline, spacing: 5) {
          if let systemImage = displayedValidation.systemImage {
            Image(systemName: systemImage)
              .font(.system(size: 9, weight: .semibold))
          }
          Text(message)
            .font(typography.rowCaption.font)
            .fixedSize(horizontal: false, vertical: true)
        }
        .foregroundStyle(displayedValidation.color(accent: accent))
        .padding(.horizontal, 2)
        .accessibilityElement(children: .combine)
      }
    }
  }
}
