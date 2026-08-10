import AppKit
import SwiftUI

public enum FlowingSliderMath {
  public static func fraction(
    of value: Double,
    in range: ClosedRange<Double>
  ) -> Double {
    let span = range.upperBound - range.lowerBound
    guard span > 0 else { return 0 }
    return min(max((value - range.lowerBound) / span, 0), 1)
  }

  public static func value(
    atFraction fraction: Double,
    in range: ClosedRange<Double>
  ) -> Double {
    let clamped = min(max(fraction, 0), 1)
    return range.lowerBound + clamped * (range.upperBound - range.lowerBound)
  }
}

public struct FlowingSlider: View {
  @Environment(\.isEnabled) private var isEnabled
  @Environment(\.preferencesAccent) private var accent
  @Binding private var value: Double
  private let range: ClosedRange<Double>
  private let step: Double?

  public init(
    value: Binding<Double>,
    in range: ClosedRange<Double>,
    step: Double? = nil
  ) {
    precondition(range.lowerBound <= range.upperBound)
    if let step {
      precondition(step > 0 && step.isFinite)
    }
    _value = value
    self.range = range
    self.step = step
  }

  public var body: some View {
    FlowingSliderRepresentable(
      value: $value,
      range: range,
      step: step,
      accent: accent,
      isEnabled: isEnabled
    )
    .frame(height: 16)
    .opacity(isEnabled ? 1 : 0.42)
    .accessibilityElement()
    .accessibilityValue(Text(String(format: "%.2f", value)))
    .accessibilityAdjustableAction(adjust)
  }

  private func adjust(_ direction: AccessibilityAdjustmentDirection) {
    guard isEnabled else { return }
    let delta = step ?? (range.upperBound - range.lowerBound) / 20
    let proposed = value + (direction == .increment ? delta : -delta)
    value = min(max(proposed, range.lowerBound), range.upperBound)
  }
}

private struct FlowingSliderRepresentable: NSViewRepresentable {
  @Binding var value: Double
  let range: ClosedRange<Double>
  let step: Double?
  let accent: PreferencesAccent
  let isEnabled: Bool

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
    control.isEnabled = isEnabled
    control.accentColor = NSColor(accent.fill)
    control.trackColor = NSColor(PreferencesPalette.hairline)
    control.knobColor = PreferencesPalette.sliderKnobColor
    control.knobBorderColor = PreferencesPalette.sliderKnobBorderColor
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
  var accentColor = NSColor.controlAccentColor
  var trackColor = NSColor.separatorColor
  var knobColor = NSColor.controlBackgroundColor
  var knobBorderColor = NSColor.separatorColor

  private let knobDiameter: CGFloat = 13
  private let trackHeight: CGFloat = 3

  override var mouseDownCanMoveWindow: Bool { false }

  override func acceptsFirstMouse(for event: NSEvent?) -> Bool {
    true
  }

  override func mouseDown(with event: NSEvent) {
    guard isEnabled else { return }
    updateValue(with: event)
  }

  override func mouseDragged(with event: NSEvent) {
    guard isEnabled else { return }
    updateValue(with: event)
  }

  override func draw(_ dirtyRect: NSRect) {
    let usableWidth = max(bounds.width - knobDiameter, 1)
    let fraction = FlowingSliderMath.fraction(of: value, in: range)
    let knobX = usableWidth * fraction
    let trackRect = NSRect(
      x: knobDiameter / 2,
      y: bounds.midY - trackHeight / 2,
      width: usableWidth,
      height: trackHeight
    )
    let progressRect = NSRect(
      x: trackRect.minX,
      y: trackRect.minY,
      width: knobX,
      height: trackHeight
    )
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
  }

  private func updateValue(with event: NSEvent) {
    let location = convert(event.locationInWindow, from: nil)
    let usableWidth = max(bounds.width - knobDiameter, 1)
    let fraction = (location.x - knobDiameter / 2) / usableWidth
    let proposed = FlowingSliderMath.value(atFraction: fraction, in: range)
    if let step {
      let steps = ((proposed - range.lowerBound) / step).rounded()
      value = min(max(range.lowerBound + steps * step, range.lowerBound), range.upperBound)
    } else {
      value = proposed
    }
    needsDisplay = true
    sendAction(action, to: target)
  }
}
