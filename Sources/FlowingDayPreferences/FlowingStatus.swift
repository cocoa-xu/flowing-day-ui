import AppKit
import SwiftUI

public enum FlowingStatusTone: String, CaseIterable, Hashable, Sendable {
  case neutral
  case accent
  case informational
  case success
  case warning
  case critical

  func color(accent: PreferencesAccent) -> Color {
    switch self {
    case .neutral: PreferencesPalette.muted
    case .accent: accent.foreground
    case .informational: Color(nsColor: .systemBlue)
    case .success: Color(nsColor: .systemGreen)
    case .warning: Color(nsColor: .systemOrange)
    case .critical: Color(nsColor: .systemRed)
    }
  }

  fileprivate var defaultSystemImage: String {
    switch self {
    case .neutral: "info.circle"
    case .accent: "sparkles"
    case .informational: "info.circle.fill"
    case .success: "checkmark.circle.fill"
    case .warning: "exclamationmark.triangle.fill"
    case .critical: "xmark.octagon.fill"
    }
  }
}

public enum FlowingBadgeEmphasis: String, CaseIterable, Hashable, Sendable {
  case subtle
  case strong
}

public struct FlowingBadge: View {
  @Environment(\.preferencesAccent) private var accent
  @Environment(\.preferencesTypography) private var typography
  private let title: String
  private let systemImage: String?
  private let tone: FlowingStatusTone
  private let emphasis: FlowingBadgeEmphasis

  public init(
    _ title: String,
    systemImage: String? = nil,
    tone: FlowingStatusTone = .neutral,
    emphasis: FlowingBadgeEmphasis = .subtle
  ) {
    self.title = title
    self.systemImage = systemImage
    self.tone = tone
    self.emphasis = emphasis
  }

  public var body: some View {
    HStack(spacing: 4) {
      if let systemImage {
        Image(systemName: systemImage)
          .font(.system(size: 8.5, weight: .semibold))
      }
      Text(title)
        .font(typography.selectionLabel.font)
        .lineLimit(1)
    }
    .foregroundStyle(toneColor)
    .padding(.horizontal, 8)
    .padding(.vertical, 4)
    .background(background, in: shape)
    .overlay {
      shape.strokeBorder(border)
    }
    .fixedSize(horizontal: true, vertical: false)
    .accessibilityElement(children: .combine)
  }

  private var toneColor: Color {
    tone.color(accent: accent)
  }

  private var background: Color {
    toneColor.opacity(emphasis == .strong ? 0.15 : 0.08)
  }

  private var border: Color {
    emphasis == .strong ? toneColor.opacity(0.24) : Color.clear
  }

  private var shape: Capsule {
    Capsule(style: .continuous)
  }
}

public enum FlowingCalloutPresentation: String, CaseIterable, Hashable, Sendable {
  case inline
  case card
}

public struct FlowingCallout<Content: View>: View {
  @Environment(\.preferencesAccent) private var accent
  @Environment(\.preferencesMetrics) private var metrics
  @Environment(\.preferencesTypography) private var typography
  private let title: String?
  private let systemImage: String?
  private let tone: FlowingStatusTone
  private let presentation: FlowingCalloutPresentation
  private let content: Content

  public init(
    title: String? = nil,
    systemImage: String? = nil,
    tone: FlowingStatusTone = .informational,
    presentation: FlowingCalloutPresentation = .card,
    @ViewBuilder content: () -> Content
  ) {
    self.title = title
    self.systemImage = systemImage
    self.tone = tone
    self.presentation = presentation
    self.content = content()
  }

  public var body: some View {
    HStack(alignment: .top, spacing: 9) {
      Image(systemName: systemImage ?? tone.defaultSystemImage)
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(toneColor)
        .frame(width: 16)

      VStack(alignment: .leading, spacing: 3) {
        if let title {
          Text(title)
            .font(typography.rowTitle.font)
            .foregroundStyle(PreferencesPalette.ink)
        }
        content
          .font(typography.body.font)
          .foregroundStyle(PreferencesPalette.muted)
          .fixedSize(horizontal: false, vertical: true)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .padding(presentation == .card ? 11 : 0)
    .background(presentation == .card ? toneColor.opacity(0.07) : Color.clear, in: shape)
    .overlay {
      if presentation == .card {
        shape.strokeBorder(toneColor.opacity(0.16))
      }
    }
    .accessibilityElement(children: .combine)
  }

  private var toneColor: Color {
    tone.color(accent: accent)
  }

  private var shape: RoundedRectangle {
    RoundedRectangle(cornerRadius: metrics.controlRadius, style: .continuous)
  }
}

extension FlowingCallout where Content == Text {
  public init(
    _ message: String,
    title: String? = nil,
    systemImage: String? = nil,
    tone: FlowingStatusTone = .informational,
    presentation: FlowingCalloutPresentation = .card
  ) {
    self.init(
      title: title,
      systemImage: systemImage,
      tone: tone,
      presentation: presentation
    ) {
      Text(message)
    }
  }
}
