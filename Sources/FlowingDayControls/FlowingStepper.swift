import SwiftUI

enum FlowingStepperMetrics {
  static let controlHeight: CGFloat = 28
  static let buttonWidth: CGFloat = 27
  static let dividerHeight: CGFloat = 14
  static let disabledOpacity = 0.42
}

enum FlowingStepperMath {
  static func increment<Value>(
    _ value: Value,
    in bounds: ClosedRange<Value>,
    step: Value.Stride
  ) -> Value where Value: Strideable & Comparable, Value.Stride: SignedNumeric & Comparable {
    guard value < bounds.upperBound else { return bounds.upperBound }
    let remaining = value.distance(to: bounds.upperBound)
    return step >= remaining ? bounds.upperBound : value.advanced(by: step)
  }

  static func decrement<Value>(
    _ value: Value,
    in bounds: ClosedRange<Value>,
    step: Value.Stride
  ) -> Value where Value: Strideable & Comparable, Value.Stride: SignedNumeric & Comparable {
    guard value > bounds.lowerBound else { return bounds.lowerBound }
    let remaining = bounds.lowerBound.distance(to: value)
    return step >= remaining ? bounds.lowerBound : value.advanced(by: -step)
  }
}

public struct FlowingStepper<Value>: View
where Value: Strideable & Comparable, Value.Stride: SignedNumeric & Comparable {
  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.flowingAccent) private var accent
  @Environment(\.flowingMetrics) private var metrics
  @Environment(\.flowingSurfaces) private var surfaces
  @Environment(\.flowingTypography) private var typography
  @FocusState private var hasKeyboardFocus: Bool
  private let label: String
  @Binding private var value: Value
  private let bounds: ClosedRange<Value>
  private let step: Value.Stride
  private let formatValue: (Value) -> String

  public init(
    _ label: String,
    value: Binding<Value>,
    in bounds: ClosedRange<Value>,
    step: Value.Stride,
    formatValue: @escaping (Value) -> String = { String(describing: $0) }
  ) {
    precondition(step > .zero)
    self.label = label
    _value = value
    self.bounds = bounds
    self.step = step
    self.formatValue = formatValue
  }

  public var body: some View {
    HStack(spacing: 10) {
      Text(formatValue(value))
        .font(typography.value.font)
        .foregroundStyle(FlowingPalette.ink)
        .monospacedDigit()
        .lineLimit(1)
        .accessibilityHidden(true)

      HStack(spacing: 0) {
        stepButton(
          title: "Decrease \(label)",
          systemImage: "minus",
          isAvailable: value > bounds.lowerBound,
          action: decrement
        )
        Rectangle()
          .fill(FlowingPalette.hairline)
          .frame(width: 1, height: FlowingStepperMetrics.dividerHeight)
        stepButton(
          title: "Increase \(label)",
          systemImage: "plus",
          isAvailable: value < bounds.upperBound,
          action: increment
        )
      }
      .frame(height: FlowingStepperMetrics.controlHeight)
      .background(surfaces.control, in: controlShape)
      .overlay {
        controlShape.strokeBorder(
          hasKeyboardFocus ? accent.foreground.opacity(0.42) : FlowingPalette.hairline
        )
      }
    }
    .opacity(isEnabled ? 1 : FlowingStepperMetrics.disabledOpacity)
    .focusable()
    .modifier(FlowingFocusEffectDisabledModifier())
    .focused($hasKeyboardFocus)
    .onMoveCommand { direction in
      switch direction {
      case .up, .right:
        increment()
      case .down, .left:
        decrement()
      default:
        break
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(label)
    .accessibilityValue(formatValue(value))
    .accessibilityAdjustableAction { direction in
      switch direction {
      case .increment:
        increment()
      case .decrement:
        decrement()
      @unknown default:
        break
      }
    }
  }

  private var controlShape: RoundedRectangle {
    RoundedRectangle(cornerRadius: metrics.controlRadius, style: .continuous)
  }

  private func stepButton(
    title: String,
    systemImage: String,
    isAvailable: Bool,
    action: @escaping () -> Void
  ) -> some View {
    Button {
      hasKeyboardFocus = true
      action()
    } label: {
      Image(systemName: systemImage)
        .font(.system(size: 9, weight: .bold))
        .foregroundStyle(isAvailable ? accent.foreground : FlowingPalette.faint)
        .frame(
          width: FlowingStepperMetrics.buttonWidth,
          height: FlowingStepperMetrics.controlHeight
        )
        .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .disabled(!isAvailable)
    .help(title)
    .accessibilityLabel(title)
  }

  private func increment() {
    guard isEnabled else { return }
    value = FlowingStepperMath.increment(value, in: bounds, step: step)
  }

  private func decrement() {
    guard isEnabled else { return }
    value = FlowingStepperMath.decrement(value, in: bounds, step: step)
  }
}
