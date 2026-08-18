import SwiftUI

public enum FlowingSegmentLabelStyle: Sendable {
  case automatic
  case textOnly
  case iconOnly
  case iconAndText
}

public struct FlowingSegmentOption<Value: Hashable>: Identifiable {
  public let value: Value
  public let label: String
  public let systemImage: String?
  public var id: Value { value }

  public init(
    _ value: Value,
    label: String,
    systemImage: String? = nil
  ) {
    self.value = value
    self.label = label
    self.systemImage = systemImage
  }
}

enum FlowingSegmentedControlMetrics {
  static let spacing: CGFloat = 6
  static let horizontalInset: CGFloat = 9
  static let verticalInset: CGFloat = 7
  static let selectedBorderWidth: CGFloat = 1
  static let disabledOpacity = 0.42
}

enum FlowingSegmentedControlNavigation {
  static func destination<Value: Equatable>(
    in values: [Value],
    from currentValue: Value,
    offset: Int
  ) -> Value? {
    guard !values.isEmpty, offset != 0 else { return nil }
    guard let currentIndex = values.firstIndex(of: currentValue) else {
      return offset > 0 ? values.first : values.last
    }
    let normalizedOffset = (offset % values.count + values.count) % values.count
    let destinationIndex = (currentIndex + normalizedOffset) % values.count
    return values[destinationIndex]
  }
}

public struct FlowingSegmentedControl<Value: Hashable>: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.layoutDirection) private var layoutDirection
  @FocusState private var hasKeyboardFocus: Bool
  private let label: String
  @Binding private var selection: Value
  private let options: [FlowingSegmentOption<Value>]
  private let labelStyle: FlowingSegmentLabelStyle

  public init(
    label: String,
    selection: Binding<Value>,
    options: [FlowingSegmentOption<Value>],
    labelStyle: FlowingSegmentLabelStyle = .automatic
  ) {
    precondition(!options.isEmpty)
    precondition(Set(options.map(\.id)).count == options.count)
    self.label = label
    _selection = selection
    self.options = options
    self.labelStyle = labelStyle
  }

  public var body: some View {
    HStack(spacing: FlowingSegmentedControlMetrics.spacing) {
      ForEach(options) { option in
        FlowingSegmentButton(
          option: option,
          isSelected: selection == option.value,
          showsKeyboardFocus: hasKeyboardFocus,
          labelStyle: labelStyle
        ) {
          selection = option.value
          hasKeyboardFocus = true
        }
      }
    }
    .frame(maxWidth: .infinity)
    .opacity(isEnabled ? 1 : FlowingSegmentedControlMetrics.disabledOpacity)
    .focusable()
    .modifier(FlowingFocusEffectDisabledModifier())
    .focused($hasKeyboardFocus)
    .onMoveCommand(perform: moveSelection)
    .accessibilityElement(children: .contain)
    .accessibilityLabel(label)
    .accessibilityAdjustableAction { direction in
      switch direction {
      case .increment:
        select(offset: 1)
      case .decrement:
        select(offset: -1)
      @unknown default:
        break
      }
    }
    .animation(
      reduceMotion ? nil : .easeOut(duration: FlowingMotion.selection),
      value: selection
    )
  }

  private func moveSelection(_ direction: MoveCommandDirection) {
    let forwardOffset = layoutDirection == .leftToRight ? 1 : -1
    switch direction {
    case .left:
      select(offset: -forwardOffset)
    case .right:
      select(offset: forwardOffset)
    case .up:
      select(offset: -1)
    case .down:
      select(offset: 1)
    default:
      break
    }
  }

  private func select(offset: Int) {
    guard isEnabled,
      let destination = FlowingSegmentedControlNavigation.destination(
        in: options.map(\.value),
        from: selection,
        offset: offset
      )
    else {
      return
    }
    selection = destination
  }
}

private struct FlowingSegmentButton<Value: Hashable>: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.flowingAccent) private var accent
  @Environment(\.flowingMetrics) private var metrics
  @Environment(\.flowingStrings) private var strings
  @Environment(\.flowingSurfaces) private var surfaces
  @State private var isHovering = false
  let option: FlowingSegmentOption<Value>
  let isSelected: Bool
  let showsKeyboardFocus: Bool
  let labelStyle: FlowingSegmentLabelStyle
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      FlowingSegmentLabel(option: option, style: labelStyle)
        .foregroundStyle(isSelected ? accent.foreground : FlowingPalette.muted)
        .frame(maxWidth: .infinity)
        .padding(.horizontal, FlowingSegmentedControlMetrics.horizontalInset)
        .padding(.vertical, FlowingSegmentedControlMetrics.verticalInset)
        .background(background, in: shape)
        .overlay {
          shape.strokeBorder(
            selectedBorderColor,
            lineWidth: FlowingSegmentedControlMetrics.selectedBorderWidth
          )
        }
        .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .help(option.label)
    .onHover { isHovering = $0 }
    .accessibilityLabel(option.label)
    .accessibilityValue(isSelected ? strings.selected : strings.notSelected)
    .accessibilityAddTraits(isSelected ? .isSelected : [])
    .animation(
      reduceMotion ? nil : .easeOut(duration: FlowingMotion.hover),
      value: isHovering
    )
  }

  private var background: Color {
    if isSelected {
      return accent.wash
    }
    if isHovering && isEnabled {
      return accent.veil
    }
    return surfaces.control
  }

  private var selectedBorderColor: Color {
    guard isSelected else { return FlowingPalette.hairline }
    return accent.foreground.opacity(showsKeyboardFocus ? 0.42 : 0.22)
  }

  private var shape: RoundedRectangle {
    RoundedRectangle(cornerRadius: metrics.controlRadius, style: .continuous)
  }
}

struct FlowingSegmentLabel<Value: Hashable>: View {
  @Environment(\.flowingTypography) private var typography
  let option: FlowingSegmentOption<Value>
  let style: FlowingSegmentLabelStyle

  @ViewBuilder
  var body: some View {
    switch style {
    case .automatic:
      if let systemImage = option.systemImage {
        icon(systemImage)
      } else {
        text
      }
    case .textOnly:
      text
    case .iconOnly:
      if let systemImage = option.systemImage {
        icon(systemImage)
      } else {
        text
      }
    case .iconAndText:
      HStack(spacing: 6) {
        if let systemImage = option.systemImage {
          icon(systemImage)
        }
        text
      }
    }
  }

  private func icon(_ systemImage: String) -> some View {
    Image(systemName: systemImage)
      .font(.system(size: 12, weight: .semibold))
  }

  private var text: some View {
    Text(option.label)
      .font(typography.selectionLabel.font)
      .lineLimit(1)
  }
}

struct FlowingFocusEffectDisabledModifier: ViewModifier {
  @ViewBuilder
  func body(content: Content) -> some View {
    if #available(macOS 14, *) {
      content.focusEffectDisabled()
    } else {
      content
    }
  }
}
