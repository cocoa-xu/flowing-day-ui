import SwiftUI

public struct FlowingSegmentOption<Value: Hashable>: Identifiable {
  public let value: Value
  public let label: String
  public var id: Value { value }

  public init(_ value: Value, label: String) {
    self.value = value
    self.label = label
  }
}

enum FlowingConnectedSegmentedControlMetrics {
  static let horizontalInset: CGFloat = 9
  static let verticalInset: CGFloat = 6
  static let containerInset: CGFloat = 2
  static let dividerHeight: CGFloat = 14
  static let disabledOpacity = 0.42
}

enum FlowingConnectedSegmentedControlNavigation {
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

public struct FlowingConnectedSegmentedControl<Value: Hashable>: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.layoutDirection) private var layoutDirection
  @Environment(\.preferencesMetrics) private var metrics
  @Environment(\.preferencesSurfaces) private var surfaces
  @FocusState private var hasKeyboardFocus: Bool
  @Namespace private var selectionNamespace
  private let label: String
  @Binding private var selection: Value
  private let options: [FlowingSegmentOption<Value>]

  public init(
    label: String,
    selection: Binding<Value>,
    options: [FlowingSegmentOption<Value>]
  ) {
    precondition(!options.isEmpty)
    precondition(Set(options.map(\.id)).count == options.count)
    self.label = label
    _selection = selection
    self.options = options
  }

  public var body: some View {
    HStack(spacing: 0) {
      ForEach(Array(options.enumerated()), id: \.element.id) { index, option in
        FlowingConnectedSegmentButton(
          title: option.label,
          isSelected: selection == option.value,
          isFocused: hasKeyboardFocus && selection == option.value,
          selectionNamespace: selectionNamespace
        ) {
          selection = option.value
          hasKeyboardFocus = true
        }
        .overlay(alignment: .trailing) {
          if index < options.index(before: options.endIndex) {
            Rectangle()
              .fill(PreferencesPalette.hairline)
              .frame(width: 1, height: FlowingConnectedSegmentedControlMetrics.dividerHeight)
              .opacity(showsDivider(after: index) ? 1 : 0)
          }
        }
      }
    }
    .frame(maxWidth: .infinity)
    .padding(FlowingConnectedSegmentedControlMetrics.containerInset)
    .background(surfaces.control, in: containerShape)
    .overlay {
      containerShape.strokeBorder(PreferencesPalette.hairline)
    }
    .opacity(isEnabled ? 1 : FlowingConnectedSegmentedControlMetrics.disabledOpacity)
    .focusable()
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
      reduceMotion ? nil : .easeOut(duration: PreferencesMotion.selection),
      value: selection
    )
  }

  private var containerShape: RoundedRectangle {
    RoundedRectangle(cornerRadius: metrics.controlRadius, style: .continuous)
  }

  private func showsDivider(after index: Int) -> Bool {
    selection != options[index].value && selection != options[index + 1].value
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
      let destination = FlowingConnectedSegmentedControlNavigation.destination(
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

private struct FlowingConnectedSegmentButton: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.preferencesAccent) private var accent
  @Environment(\.preferencesMetrics) private var metrics
  @Environment(\.preferencesStrings) private var strings
  @Environment(\.preferencesTypography) private var typography
  @State private var isHovering = false
  let title: String
  let isSelected: Bool
  let isFocused: Bool
  let selectionNamespace: Namespace.ID
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      ZStack {
        if isSelected {
          selectionShape
            .fill(accent.wash)
            .overlay {
              selectionShape.strokeBorder(accent.foreground.opacity(0.22))
            }
            .matchedGeometryEffect(id: "selection", in: selectionNamespace)
        } else if isHovering && isEnabled {
          selectionShape.fill(accent.veil)
        }
        Text(title)
          .font(typography.selectionLabel.font)
          .foregroundStyle(isSelected ? accent.foreground : PreferencesPalette.muted)
          .lineLimit(1)
          .minimumScaleFactor(0.72)
          .padding(.horizontal, FlowingConnectedSegmentedControlMetrics.horizontalInset)
          .padding(.vertical, FlowingConnectedSegmentedControlMetrics.verticalInset)
          .frame(maxWidth: .infinity)
      }
      .contentShape(Rectangle())
      .overlay {
        if isFocused {
          selectionShape.strokeBorder(accent.fill, lineWidth: 2)
        }
      }
    }
    .buttonStyle(.plain)
    .onHover { isHovering = $0 }
    .accessibilityLabel(title)
    .accessibilityValue(isSelected ? strings.selected : strings.notSelected)
    .accessibilityAddTraits(isSelected ? .isSelected : [])
    .animation(
      reduceMotion ? nil : .easeOut(duration: PreferencesMotion.hover),
      value: isHovering
    )
  }

  private var selectionShape: RoundedRectangle {
    RoundedRectangle(
      cornerRadius: max(
        0,
        metrics.controlRadius - FlowingConnectedSegmentedControlMetrics.containerInset
      ),
      style: .continuous
    )
  }
}
