import AppKit
import SwiftUI

enum FlowingSliderMath {
  static func fraction(
    of value: Double,
    in range: ClosedRange<Double>
  ) -> Double {
    let span = range.upperBound - range.lowerBound
    guard span > 0 else { return 0 }
    return min(max((value - range.lowerBound) / span, 0), 1)
  }

  static func value(
    atFraction fraction: Double,
    in range: ClosedRange<Double>
  ) -> Double {
    let clamped = min(max(fraction, 0), 1)
    return range.lowerBound + clamped * (range.upperBound - range.lowerBound)
  }
}

public struct FlowingSlider: View {
  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.flowingAccent) private var accent
  @Environment(\.layoutDirection) private var layoutDirection
  @Binding private var value: Double
  private let formatValue: (Double) -> String
  private let label: String
  private let range: ClosedRange<Double>
  private let step: Double?

  public init(
    _ label: String,
    value: Binding<Double>,
    in range: ClosedRange<Double>,
    step: Double? = nil,
    formatValue: @escaping (Double) -> String = { String(format: "%.2f", $0) }
  ) {
    precondition(range.lowerBound <= range.upperBound)
    if let step {
      precondition(step > 0 && step.isFinite)
    }
    self.label = label
    _value = value
    self.range = range
    self.step = step
    self.formatValue = formatValue
  }

  public var body: some View {
    FlowingSliderRepresentable(
      value: $value,
      label: label,
      range: range,
      step: step,
      formatValue: formatValue,
      accent: accent,
      isEnabled: isEnabled,
      layoutDirection: layoutDirection
    )
    .frame(height: 16)
    .opacity(isEnabled ? 1 : 0.42)
  }
}

private struct FlowingSliderRepresentable: NSViewRepresentable {
  @Binding var value: Double
  let label: String
  let range: ClosedRange<Double>
  let step: Double?
  let formatValue: (Double) -> String
  let accent: FlowingAccent
  let isEnabled: Bool
  let layoutDirection: LayoutDirection

  func makeCoordinator() -> Coordinator {
    Coordinator(value: $value)
  }

  func makeNSView(context: Context) -> FlowingSliderControl {
    let control = FlowingSliderControl()
    control.target = context.coordinator
    control.action = #selector(Coordinator.valueChanged(_:))
    return control
  }

  func updateNSView(_ control: FlowingSliderControl, context: Context) {
    context.coordinator.value = $value
    control.value = value
    control.range = range
    control.step = step
    control.accessibilityLabelText = label
    control.formatValue = formatValue
    control.isEnabled = isEnabled
    control.isRightToLeft = layoutDirection == .rightToLeft
    control.accentColor = NSColor(accent.fill)
    control.trackColor = NSColor(FlowingPalette.hairline)
    control.knobColor = FlowingPalette.sliderKnobColor
    control.knobBorderColor = FlowingPalette.sliderKnobBorderColor
    control.needsDisplay = true
  }

  final class Coordinator: NSObject {
    var value: Binding<Double>

    init(value: Binding<Double>) {
      self.value = value
    }

    @MainActor
    @objc func valueChanged(_ sender: FlowingSliderControl) {
      value.wrappedValue = sender.value
    }
  }
}

final class FlowingSliderControl: NSControl {
  var value = 0.0
  var range = 0.0...1.0
  var step: Double?
  var accessibilityLabelText = ""
  var formatValue: (Double) -> String = { String(format: "%.2f", $0) }
  var isRightToLeft = false
  var accentColor = NSColor.controlAccentColor
  var trackColor = NSColor.separatorColor
  var knobColor = NSColor.controlBackgroundColor
  var knobBorderColor = NSColor.separatorColor

  private let knobDiameter: CGFloat = 13
  private let trackHeight: CGFloat = 3

  override var mouseDownCanMoveWindow: Bool { false }
  override var acceptsFirstResponder: Bool { true }

  override func becomeFirstResponder() -> Bool {
    let accepted = super.becomeFirstResponder()
    if accepted { needsDisplay = true }
    return accepted
  }

  override func resignFirstResponder() -> Bool {
    let resigned = super.resignFirstResponder()
    if resigned { needsDisplay = true }
    return resigned
  }

  override func accessibilityRole() -> NSAccessibility.Role? {
    .slider
  }

  override func accessibilityLabel() -> String? {
    accessibilityLabelText
  }

  override func accessibilityValue() -> Any? {
    value
  }

  override func accessibilityValueDescription() -> String? {
    formatValue(value)
  }

  override func accessibilityMinValue() -> Any? {
    range.lowerBound
  }

  override func accessibilityMaxValue() -> Any? {
    range.upperBound
  }

  override func accessibilityPerformIncrement() -> Bool {
    adjust(by: 1)
  }

  override func accessibilityPerformDecrement() -> Bool {
    adjust(by: -1)
  }

  override func acceptsFirstMouse(for event: NSEvent?) -> Bool {
    true
  }

  override func mouseDown(with event: NSEvent) {
    guard isEnabled else { return }
    window?.makeFirstResponder(self)
    updateValue(with: event)
  }

  override func mouseDragged(with event: NSEvent) {
    guard isEnabled else { return }
    updateValue(with: event)
  }

  override func keyDown(with event: NSEvent) {
    let incrementDirection = isRightToLeft ? -1 : 1
    switch event.keyCode {
    case 123:
      _ = adjust(by: -incrementDirection)
    case 124:
      _ = adjust(by: incrementDirection)
    case 125:
      _ = adjust(by: -1)
    case 126:
      _ = adjust(by: 1)
    default:
      super.keyDown(with: event)
    }
  }

  override func draw(_ dirtyRect: NSRect) {
    let usableWidth = max(bounds.width - knobDiameter, 1)
    let fraction = FlowingSliderMath.fraction(of: value, in: range)
    let knobX = usableWidth * (isRightToLeft ? 1 - fraction : fraction)
    let trackRect = NSRect(
      x: knobDiameter / 2,
      y: bounds.midY - trackHeight / 2,
      width: usableWidth,
      height: trackHeight
    )
    let progressRect =
      if isRightToLeft {
        NSRect(
          x: trackRect.minX + knobX,
          y: trackRect.minY,
          width: usableWidth - knobX,
          height: trackHeight
        )
      } else {
        NSRect(
          x: trackRect.minX,
          y: trackRect.minY,
          width: knobX,
          height: trackHeight
        )
      }
    let knobRect = NSRect(
      x: knobX,
      y: bounds.midY - knobDiameter / 2,
      width: knobDiameter,
      height: knobDiameter
    )

    trackColor.setFill()
    NSBezierPath(
      roundedRect: trackRect,
      xRadius: trackHeight / 2,
      yRadius: trackHeight / 2
    ).fill()

    accentColor.setFill()
    NSBezierPath(
      roundedRect: progressRect,
      xRadius: trackHeight / 2,
      yRadius: trackHeight / 2
    ).fill()

    NSGraphicsContext.saveGraphicsState()
    let shadow = NSShadow()
    shadow.shadowColor = NSColor.black.withAlphaComponent(0.16)
    shadow.shadowBlurRadius = 1.5
    shadow.shadowOffset = NSSize(width: 0, height: -0.5)
    shadow.set()
    knobColor.setFill()
    NSBezierPath(ovalIn: knobRect).fill()
    NSGraphicsContext.restoreGraphicsState()

    knobBorderColor.setStroke()
    let border = NSBezierPath(ovalIn: knobRect.insetBy(dx: 0.25, dy: 0.25))
    border.lineWidth = 0.5
    border.stroke()

    if window?.firstResponder === self {
      accentColor.withAlphaComponent(0.42).setStroke()
      let focusBorder = NSBezierPath(ovalIn: knobRect.insetBy(dx: -1, dy: -1))
      focusBorder.lineWidth = 1
      focusBorder.stroke()
    }
  }

  private func updateValue(with event: NSEvent) {
    let location = convert(event.locationInWindow, from: nil)
    let usableWidth = max(bounds.width - knobDiameter, 1)
    let horizontalFraction = (location.x - knobDiameter / 2) / usableWidth
    let fraction = isRightToLeft ? 1 - horizontalFraction : horizontalFraction
    let proposed = FlowingSliderMath.value(atFraction: fraction, in: range)
    if let step {
      let steps = ((proposed - range.lowerBound) / step).rounded()
      value = min(max(range.lowerBound + steps * step, range.lowerBound), range.upperBound)
    } else {
      value = proposed
    }
    needsDisplay = true
    sendAction(action, to: target)
    NSAccessibility.post(element: self, notification: .valueChanged)
  }

  @discardableResult
  private func adjust(by offset: Int) -> Bool {
    guard isEnabled, offset != 0 else { return false }
    let delta = step ?? (range.upperBound - range.lowerBound) / 20
    let proposed = value + Double(offset) * delta
    let adjusted = min(max(proposed, range.lowerBound), range.upperBound)
    guard adjusted != value else { return false }
    value = adjusted
    needsDisplay = true
    sendAction(action, to: target)
    NSAccessibility.post(element: self, notification: .valueChanged)
    return true
  }
}
