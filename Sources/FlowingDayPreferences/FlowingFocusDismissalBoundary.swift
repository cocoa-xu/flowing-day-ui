import AppKit
import SwiftUI

struct FlowingFocusDismissalBoundary: NSViewRepresentable {
  @Binding var isFocused: Bool

  func makeCoordinator() -> Coordinator {
    Coordinator(isFocused: $isFocused)
  }

  func makeNSView(context: Context) -> BoundaryView {
    let view = BoundaryView()
    view.coordinator = context.coordinator
    context.coordinator.attach(to: view)
    return view
  }

  func updateNSView(_ nsView: BoundaryView, context: Context) {
    context.coordinator.isFocused = $isFocused
  }

  static func dismantleNSView(_ nsView: BoundaryView, coordinator: Coordinator) {
    coordinator.detach()
  }

  final class BoundaryView: NSView {
    weak var coordinator: Coordinator?

    override func viewDidMoveToWindow() {
      super.viewDidMoveToWindow()
      coordinator?.windowDidChange()
    }

    override func hitTest(_ point: NSPoint) -> NSView? {
      nil
    }
  }

  @MainActor
  final class Coordinator {
    var isFocused: Binding<Bool>
    private weak var boundaryView: BoundaryView?
    private var eventMonitor: Any?

    init(isFocused: Binding<Bool>) {
      self.isFocused = isFocused
    }

    func attach(to view: BoundaryView) {
      boundaryView = view
      installEventMonitor()
    }

    func windowDidChange() {
      installEventMonitor()
    }

    func detach() {
      if let eventMonitor {
        NSEvent.removeMonitor(eventMonitor)
      }
      eventMonitor = nil
      boundaryView = nil
    }

    func shouldDismiss(for event: NSEvent) -> Bool {
      guard isFocused.wrappedValue,
        let boundaryView,
        let window = boundaryView.window,
        event.window === window
      else {
        return false
      }
      let point = boundaryView.convert(event.locationInWindow, from: nil)
      return !boundaryView.bounds.contains(point)
    }

    private func installEventMonitor() {
      guard eventMonitor == nil else { return }
      eventMonitor = NSEvent.addLocalMonitorForEvents(
        matching: [.leftMouseDown, .rightMouseDown, .otherMouseDown]
      ) { [weak self] event in
        guard let self else { return event }
        if shouldDismiss(for: event) {
          Task { @MainActor [weak self] in
            self?.isFocused.wrappedValue = false
          }
        }
        return event
      }
    }
  }
}
