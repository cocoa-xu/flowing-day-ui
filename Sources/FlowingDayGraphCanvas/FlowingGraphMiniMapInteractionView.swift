import AppKit
import FlowingDayCanvas
import SwiftUI

struct FlowingGraphMiniMapInteractionView: NSViewRepresentable {
  let discreteScrollMultiplier: CGFloat
  let onPointerBegan: (CGPoint) -> Void
  let onPointerChanged: (CGPoint) -> Void
  let onPointerEnded: (CGPoint) -> Void
  let onPan: (CGSize, FlowingCanvasViewportChangePhase) -> Void
  let onMagnify: (CGFloat, FlowingCanvasViewportChangePhase) -> Void

  func makeNSView(context: Context) -> EventView {
    let view = EventView()
    configure(view)
    return view
  }

  func updateNSView(_ nsView: EventView, context: Context) {
    configure(nsView)
  }

  private func configure(_ view: EventView) {
    view.discreteScrollMultiplier = discreteScrollMultiplier
    view.onPointerBegan = onPointerBegan
    view.onPointerChanged = onPointerChanged
    view.onPointerEnded = onPointerEnded
    view.onPan = onPan
    view.onMagnify = onMagnify
  }

  final class EventView: NSView, FlowingCanvasTrackpadEventTarget {
    var discreteScrollMultiplier: CGFloat = 12
    var onPointerBegan: ((CGPoint) -> Void)?
    var onPointerChanged: ((CGPoint) -> Void)?
    var onPointerEnded: ((CGPoint) -> Void)?
    var onPan: ((CGSize, FlowingCanvasViewportChangePhase) -> Void)?
    var onMagnify: ((CGFloat, FlowingCanvasViewportChangePhase) -> Void)?

    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { true }

    override func resetCursorRects() {
      addCursorRect(bounds, cursor: .openHand)
    }

    override func mouseDown(with event: NSEvent) {
      window?.makeFirstResponder(self)
      NSCursor.closedHand.set()
      onPointerBegan?(convert(event.locationInWindow, from: nil))
    }

    override func mouseDragged(with event: NSEvent) {
      onPointerChanged?(convert(event.locationInWindow, from: nil))
    }

    override func mouseUp(with event: NSEvent) {
      NSCursor.openHand.set()
      onPointerEnded?(convert(event.locationInWindow, from: nil))
    }

    override func scrollWheel(with event: NSEvent) {
      guard !event.modifierFlags.contains(.command) else {
        super.scrollWheel(with: event)
        return
      }
      let multiplier = event.hasPreciseScrollingDeltas ? 1 : discreteScrollMultiplier
      let delta = CGSize(
        width: event.scrollingDeltaX * multiplier,
        height: event.scrollingDeltaY * multiplier
      )
      let ended =
        event.phase == .ended || event.phase == .cancelled
        || event.momentumPhase == .ended || event.momentumPhase == .cancelled
      let phase: FlowingCanvasViewportChangePhase =
        event.hasPreciseScrollingDeltas && !ended ? .continuous : .ended
      onPan?(delta, phase)
    }

    override func magnify(with event: NSEvent) {
      let phase: FlowingCanvasViewportChangePhase =
        event.phase == .ended || event.phase == .cancelled ? .ended : .continuous
      onMagnify?(event.magnification, phase)
    }
  }
}
