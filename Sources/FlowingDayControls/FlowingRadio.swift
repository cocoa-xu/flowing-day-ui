import SwiftUI

public struct FlowingRadioOption<Value: Hashable>: Identifiable {
  public let value: Value
  public let label: String
  public let systemImage: String?
  public let isEnabled: Bool
  public var id: Value { value }

  public init(
    _ value: Value,
    label: String,
    systemImage: String? = nil,
    isEnabled: Bool = true
  ) {
    self.value = value
    self.label = label
    self.systemImage = systemImage
    self.isEnabled = isEnabled
  }
}

enum FlowingRadioMetrics {
  static let indicatorSize: CGFloat = 15
  static let dotSize: CGFloat = 7
  static let spacing: CGFloat = 7
  static let horizontalInset: CGFloat = 8
  static let verticalInset: CGFloat = 6
  static let disabledOpacity = 0.42
}

enum FlowingRadioNavigation {
  static func destination<Value: Equatable>(
    in values: [Value],
    from currentValue: Value,
    offset: Int
  ) -> Value? {
    FlowingSegmentedControlNavigation.destination(
      in: values,
      from: currentValue,
      offset: offset
    )
  }
}

public struct FlowingRadio<Label: View>: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.flowingAccent) private var accent
  @Environment(\.flowingStrings) private var strings
  @Environment(\.flowingTypography) private var typography
  @State private var isHovering = false
  private let isSelected: Bool
  private let showsKeyboardFocus: Bool
  private let action: () -> Void
  private let label: Label

  public init(
    isSelected: Bool,
    action: @escaping () -> Void,
    @ViewBuilder label: () -> Label
  ) {
    self.init(
      isSelected: isSelected,
      showsKeyboardFocus: false,
      action: action,
      label: label
    )
  }

  fileprivate init(
    isSelected: Bool,
    showsKeyboardFocus: Bool,
    action: @escaping () -> Void,
    @ViewBuilder label: () -> Label
  ) {
    self.isSelected = isSelected
    self.showsKeyboardFocus = showsKeyboardFocus
    self.action = action
    self.label = label()
  }

  public var body: some View {
    Button(action: action) {
      HStack(spacing: FlowingRadioMetrics.spacing) {
        ZStack {
          Circle()
            .fill(FlowingPalette.control)
          Circle()
            .strokeBorder(
              isSelected ? accent.fill : FlowingPalette.muted.opacity(0.48),
              lineWidth: isSelected && showsKeyboardFocus ? 1.5 : 1
            )
          Circle()
            .fill(accent.fill)
            .frame(width: FlowingRadioMetrics.dotSize, height: FlowingRadioMetrics.dotSize)
            .opacity(isSelected ? 1 : 0)
        }
        .frame(
          width: FlowingRadioMetrics.indicatorSize,
          height: FlowingRadioMetrics.indicatorSize
        )

        label
          .font(typography.selectionLabel.font)
          .foregroundStyle(isSelected ? FlowingPalette.ink : FlowingPalette.muted)
      }
      .padding(.horizontal, FlowingRadioMetrics.horizontalInset)
      .padding(.vertical, FlowingRadioMetrics.verticalInset)
      .background(
        isHovering && isEnabled ? accent.veil : Color.clear,
        in: RoundedRectangle(cornerRadius: 8, style: .continuous)
      )
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .disabled(!isEnabled)
    .onHover { isHovering = $0 }
    .accessibilityValue(isSelected ? strings.selected : strings.notSelected)
    .accessibilityAddTraits(isSelected ? .isSelected : [])
    .animation(
      reduceMotion ? nil : .easeOut(duration: FlowingMotion.hover),
      value: isHovering
    )
    .animation(
      reduceMotion ? nil : .easeOut(duration: FlowingMotion.selection),
      value: isSelected
    )
  }
}

extension FlowingRadio where Label == Text {
  public init(
    _ title: String,
    isSelected: Bool,
    action: @escaping () -> Void
  ) {
    self.init(isSelected: isSelected, action: action) {
      Text(title)
    }
  }
}

public struct FlowingRadioGroup<Value: Hashable>: View {
  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.layoutDirection) private var layoutDirection
  @FocusState private var hasKeyboardFocus: Bool
  private let label: String
  @Binding private var selection: Value
  private let options: [FlowingRadioOption<Value>]
  private let axis: Axis
  private let spacing: CGFloat

  public init(
    label: String,
    selection: Binding<Value>,
    options: [FlowingRadioOption<Value>],
    axis: Axis = .vertical,
    spacing: CGFloat = 4
  ) {
    precondition(!options.isEmpty)
    precondition(Set(options.map(\.id)).count == options.count)
    precondition(spacing.isFinite && spacing >= 0)
    self.label = label
    _selection = selection
    self.options = options
    self.axis = axis
    self.spacing = spacing
  }

  public var body: some View {
    Group {
      if axis == .horizontal {
        HStack(spacing: spacing) {
          optionsView
        }
      } else {
        VStack(alignment: .leading, spacing: spacing) {
          optionsView
        }
      }
    }
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
  }

  @ViewBuilder
  private var optionsView: some View {
    ForEach(options) { option in
      FlowingRadio(
        isSelected: selection == option.value,
        showsKeyboardFocus: hasKeyboardFocus
      ) {
        guard isEnabled, option.isEnabled else { return }
        selection = option.value
        hasKeyboardFocus = true
      } label: {
        HStack(spacing: 6) {
          if let systemImage = option.systemImage {
            Image(systemName: systemImage)
              .font(.system(size: 11, weight: .medium))
          }
          Text(option.label)
            .lineLimit(1)
        }
      }
      .disabled(!option.isEnabled)
      .opacity(option.isEnabled ? 1 : FlowingRadioMetrics.disabledOpacity)
      .accessibilityLabel(option.label)
    }
  }

  private func moveSelection(_ direction: MoveCommandDirection) {
    let forwardOffset = layoutDirection == .leftToRight ? 1 : -1
    switch direction {
    case .left where axis == .horizontal:
      select(offset: -forwardOffset)
    case .right where axis == .horizontal:
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
      let destination = FlowingRadioNavigation.destination(
        in: options.filter(\.isEnabled).map(\.value),
        from: selection,
        offset: offset
      )
    else {
      return
    }
    selection = destination
  }
}
