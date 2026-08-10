import SwiftUI

public enum FlowingIconButtonEmphasis: String, CaseIterable, Hashable, Sendable {
  case quiet
  case standard
  case prominent
}

enum FlowingIconButtonMetrics {
  static let size: CGFloat = 30
  static let symbolSize: CGFloat = 12
  static let cornerRadius: CGFloat = 8
}

public struct FlowingIconButton: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.preferencesStrings) private var strings
  @State private var isHovering = false
  private let action: () -> Void
  private let emphasis: FlowingIconButtonEmphasis
  private let isSelected: Bool?
  private let systemImage: String
  private let title: String

  public init(
    _ title: String,
    systemImage: String,
    emphasis: FlowingIconButtonEmphasis = .quiet,
    action: @escaping () -> Void
  ) {
    self.init(
      title,
      systemImage: systemImage,
      emphasis: emphasis,
      isSelected: nil,
      action: action
    )
  }

  public init(
    _ title: String,
    systemImage: String,
    emphasis: FlowingIconButtonEmphasis = .quiet,
    isSelected: Bool,
    action: @escaping () -> Void
  ) {
    self.init(
      title,
      systemImage: systemImage,
      emphasis: emphasis,
      isSelected: Optional(isSelected),
      action: action
    )
  }

  private init(
    _ title: String,
    systemImage: String,
    emphasis: FlowingIconButtonEmphasis,
    isSelected: Bool?,
    action: @escaping () -> Void
  ) {
    self.title = title
    self.systemImage = systemImage
    self.emphasis = emphasis
    self.isSelected = isSelected
    self.action = action
  }

  public var body: some View {
    selectionAccessibility
      .onHover { isHovering = $0 }
      .animation(.easeOut(duration: hoverDuration), value: isHovering)
  }

  @ViewBuilder
  private var selectionAccessibility: some View {
    if let isSelected {
      button
        .accessibilityValue(isSelected ? strings.selected : strings.notSelected)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    } else {
      button
    }
  }

  private var button: some View {
    Button(action: action) {
      Image(systemName: systemImage)
        .font(.system(size: FlowingIconButtonMetrics.symbolSize, weight: .semibold))
        .frame(
          width: FlowingIconButtonMetrics.size,
          height: FlowingIconButtonMetrics.size
        )
        .contentShape(Rectangle())
    }
    .buttonStyle(
      FlowingIconButtonStyle(
        emphasis: emphasis,
        isHovering: isHovering,
        isSelected: isSelected == true
      )
    )
    .accessibilityLabel(title)
    .help(title)
  }

  private var hoverDuration: TimeInterval {
    reduceMotion ? PreferencesMotion.reducedHover : PreferencesMotion.hover
  }
}

private struct FlowingIconButtonStyle: ButtonStyle {
  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.preferencesAccent) private var accent
  @Environment(\.preferencesSurfaces) private var surfaces
  let emphasis: FlowingIconButtonEmphasis
  let isHovering: Bool
  let isSelected: Bool

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .foregroundStyle(foreground)
      .background(background, in: shape)
      .overlay {
        shape.strokeBorder(border)
      }
      .opacity(opacity(isPressed: configuration.isPressed))
  }

  private var foreground: Color {
    switch emphasis {
    case .prominent: .white
    case .quiet, .standard:
      isSelected || isHovering ? accent.foreground : PreferencesPalette.muted
    }
  }

  private var background: Color {
    switch emphasis {
    case .quiet:
      isSelected ? accent.veil : (isHovering ? accent.veil.opacity(0.72) : .clear)
    case .standard:
      isSelected || isHovering ? accent.veil : surfaces.field
    case .prominent:
      isHovering ? accent.fill.opacity(0.86) : accent.fill
    }
  }

  private var border: Color {
    switch emphasis {
    case .quiet:
      isSelected ? accent.fill.opacity(0.18) : .clear
    case .standard:
      isSelected ? accent.fill.opacity(0.24) : PreferencesPalette.hairline
    case .prominent: .clear
    }
  }

  private var shape: RoundedRectangle {
    RoundedRectangle(
      cornerRadius: FlowingIconButtonMetrics.cornerRadius,
      style: .continuous
    )
  }

  private func opacity(isPressed: Bool) -> Double {
    guard isEnabled else { return 0.42 }
    return isPressed ? 0.62 : 1
  }
}
