import AppKit
import SwiftUI

struct FlowingCanvasTrackpadGestureView: NSViewRepresentable {
  let discreteScrollMultiplier: CGFloat
  let onPan: (CGSize, CGPoint) -> Bool
  let onMagnify: (CGFloat, CGPoint) -> Bool
  let onMagnifyEnded: () -> Void
  let onSmartMagnify: (CGPoint) -> Bool

  func makeNSView(context: Context) -> EventView {
    let view = EventView()
    configure(view)
    return view
  }

  func updateNSView(_ nsView: EventView, context: Context) {
    configure(nsView)
  }

  static func dismantleNSView(_ nsView: EventView, coordinator: Void) {
    nsView.stopMonitoring()
  }

  private func configure(_ view: EventView) {
    view.discreteScrollMultiplier = discreteScrollMultiplier
    view.onPan = onPan
    view.onMagnify = onMagnify
    view.onMagnifyEnded = onMagnifyEnded
    view.onSmartMagnify = onSmartMagnify
  }

  final class EventView: NSView {
    var discreteScrollMultiplier: CGFloat = 12
    var onPan: ((CGSize, CGPoint) -> Bool)?
    var onMagnify: ((CGFloat, CGPoint) -> Bool)?
    var onMagnifyEnded: (() -> Void)?
    var onSmartMagnify: ((CGPoint) -> Bool)?
    private var eventMonitor: Any?
    private var isMagnifying = false

    override var isFlipped: Bool { true }

    override func viewWillMove(toWindow newWindow: NSWindow?) {
      if newWindow == nil {
        stopMonitoring()
      }
      super.viewWillMove(toWindow: newWindow)
    }

    override func viewDidMoveToWindow() {
      super.viewDidMoveToWindow()
      updateEventMonitor()
    }

    private func updateEventMonitor() {
      stopMonitoring()
      guard window != nil else { return }
      eventMonitor = NSEvent.addLocalMonitorForEvents(
        matching: [.scrollWheel, .magnify, .smartMagnify]
      ) { [weak self] event in
        guard let self, event.window === window else { return event }
        let location = convert(event.locationInWindow, from: nil)

        switch event.type {
        case .scrollWheel:
          guard bounds.contains(location) else { return event }
          guard !event.modifierFlags.contains(.command) else { return event }
          let multiplier =
            event.hasPreciseScrollingDeltas
            ? 1
            : discreteScrollMultiplier
          let delta = CGSize(
            width: event.scrollingDeltaX * multiplier,
            height: event.scrollingDeltaY * multiplier
          )
          guard delta != .zero else { return event }
          return onPan?(delta, location) == true ? nil : event
        case .magnify:
          let ended = event.phase == .ended || event.phase == .cancelled
          if ended {
            guard isMagnifying else { return event }
            isMagnifying = false
            onMagnifyEnded?()
            return nil
          }
          guard isMagnifying || bounds.contains(location) else { return event }
          if event.magnification != 0,
            onMagnify?(event.magnification, location) == true
          {
            isMagnifying = true
          }
          return isMagnifying ? nil : event
        case .smartMagnify:
          guard bounds.contains(location) else { return event }
          return onSmartMagnify?(location) == true ? nil : event
        default:
          return event
        }
      }
    }

    func stopMonitoring() {
      guard let eventMonitor else { return }
      NSEvent.removeMonitor(eventMonitor)
      self.eventMonitor = nil
      isMagnifying = false
    }
  }
}
