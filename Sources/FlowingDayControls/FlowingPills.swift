import SwiftUI

public struct FlowingChip: View {
  @Environment(\.flowingAccent) private var accent
  @Environment(\.flowingTypography) private var typography
  @State private var isHovering = false
  private let title: String
  private let action: () -> Void

  public init(_ title: String, action: @escaping () -> Void) {
    self.title = title
    self.action = action
  }

  public var body: some View {
    Button(action: action) {
      Text(title)
        .font(typography.selectionLabel.font)
        .foregroundStyle(accent.foreground)
        .lineLimit(1)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(
          isHovering ? accent.wash : accent.veil,
          in: RoundedRectangle(cornerRadius: 8, style: .continuous)
        )
    }
    .buttonStyle(.plain)
    .onHover { isHovering = $0 }
  }
}

public struct FlowingTag: View {
  @Environment(\.flowingAccent) private var accent
  @Environment(\.flowingTypography) private var typography
  private let title: String

  public init(_ title: String) {
    self.title = title
  }

  public var body: some View {
    Text(title)
      .font(typography.tag.font)
      .foregroundStyle(accent.foreground)
      .lineLimit(1)
      .fixedSize(horizontal: true, vertical: false)
      .padding(.horizontal, 10)
      .padding(.vertical, 6)
      .background(accent.veil, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
  }
}

public struct FlowingSelectableTag: View {
  @Environment(\.flowingAccent) private var accent
  @Environment(\.flowingStrings) private var strings
  @Environment(\.flowingTypography) private var typography
  @State private var isHovering = false
  private let title: String
  private let isSelected: Bool
  private let inactiveAccent: FlowingAccent?
  private let action: () -> Void

  public init(
    _ title: String,
    isSelected: Bool,
    inactiveAccent: FlowingAccent? = nil,
    action: @escaping () -> Void
  ) {
    self.title = title
    self.isSelected = isSelected
    self.inactiveAccent = inactiveAccent
    self.action = action
  }

  public var body: some View {
    Button(action: action) {
      Text(title)
        .font(typography.tag.font)
        .foregroundStyle(foreground)
        .lineLimit(1)
        .fixedSize(horizontal: true, vertical: false)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(background, in: shape)
        .overlay {
          shape.strokeBorder(border, lineWidth: 1)
        }
    }
    .buttonStyle(.plain)
    .onHover { isHovering = $0 }
    .accessibilityValue(isSelected ? strings.on : strings.off)
    .animation(.easeOut(duration: FlowingMotion.selection), value: isSelected)
    .animation(.easeOut(duration: FlowingMotion.hover), value: isHovering)
  }

  private var inactive: FlowingAccent {
    inactiveAccent ?? accent
  }

  private var foreground: Color {
    if isSelected {
      return accent.foreground
    }
    return inactive.foreground.opacity(isHovering ? 0.8 : 0.62)
  }

  private var background: Color {
    if isSelected {
      return isHovering ? accent.wash : accent.veil
    }
    return isHovering ? inactive.wash : inactive.veil
  }

  private var border: Color {
    if isSelected {
      return accent.fill.opacity(isHovering ? 0.35 : 0.24)
    }
    return inactive.fill.opacity(isHovering ? 0.24 : 0.12)
  }

  private var shape: RoundedRectangle {
    RoundedRectangle(cornerRadius: 8, style: .continuous)
  }
}
