import AppKit
import FlowingDayCanvas
import FlowingDayGraphCanvas
import SwiftUI

@main
struct FlowingDayGraphCanvasTestHostApp: App {
  var body: some Scene {
    WindowGroup("Graph Canvas Test Host") {
      TestHostRoot(scenario: TestHostScenario.current)
        .frame(minWidth: 960, minHeight: 640)
        .preferredColorScheme(.light)
        .background(TestHostWindowPositioner())
    }
    .defaultSize(width: 1180, height: 760)
    .defaultPosition(.center)
  }
}

private enum TestHostScenario: String {
  case worldLayerDrag
  case graphPortHitTesting
  case graphCanvas

  static var current: Self {
    guard let index = CommandLine.arguments.firstIndex(of: "--scenario"),
      CommandLine.arguments.indices.contains(index + 1),
      let scenario = Self(rawValue: CommandLine.arguments[index + 1])
    else {
      return .graphCanvas
    }
    return scenario
  }
}

private struct TestHostRoot: View {
  let scenario: TestHostScenario

  @ViewBuilder
  var body: some View {
    switch scenario {
    case .worldLayerDrag:
      WorldLayerDragFixture()
    case .graphPortHitTesting:
      GraphPortHitTestingFixture()
    case .graphCanvas:
      GraphCanvasShowcaseView()
    }
  }
}

private struct WorldLayerDragFixture: View {
  @State private var viewport = FlowingCanvasViewport()
  @State private var nodeState = "Idle"

  var body: some View {
    FlowingCanvas(
      viewport: $viewport,
      configuration: FlowingCanvasConfiguration(initialZoom: 1, renderOverscan: 320),
      contentRect: CGRect(x: 0, y: 0, width: 400, height: 300),
      contentID: "world-layer-drag",
      interactionMode: .content
    ) { _ in
      Color(nsColor: .windowBackgroundColor)
    } world: { context in
      FlowingCanvasWorldLayer(context: context) { surface in
        let frame = surface.localTransform.applying(
          to: CGRect(x: 120, y: 105, width: 160, height: 90)
        )
        RoundedRectangle(cornerRadius: 12, style: .continuous)
          .fill(.blue)
          .frame(width: frame.width, height: frame.height)
          .position(x: frame.midX, y: frame.midY)
          .contentShape(Rectangle())
          .gesture(nodeDragGesture)
          .accessibilityIdentifier("world-layer-drag-target")
      }
    } overlays: { _ in
      Text(nodeState)
        .accessibilityIdentifier("world-layer-node-state")
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .allowsHitTesting(false)
    }
  }

  private var nodeDragGesture: some Gesture {
    DragGesture(minimumDistance: 2)
      .onChanged { _ in nodeState = "Dragging" }
      .onEnded { _ in nodeState = "Ended" }
  }
}

private struct GraphPortHitTestingFixture: View {
  @StateObject private var model = GraphCanvasShowcaseModel()
  @State private var session = FlowingGraphCanvasSessionState<ShowcaseCanvasSchema>()
  @State private var intentState = "Idle"
  private let sessionID = FlowingGraphCanvasSessionID()

  @ViewBuilder
  var body: some View {
    if let content = model.content {
      FlowingGraphCanvas(
        content: content,
        sessionID: sessionID,
        session: $session,
        configuration: FlowingGraphCanvasConfiguration(
          canvas: FlowingCanvasConfiguration(initialZoom: 1, renderOverscan: 320),
          nodeDraggingMode: .multiple
        ),
        onIntent: { intent in
          if case .nodeDragCompleted = intent {
            intentState = "Ended"
          }
          model.send(intent)
        },
        background: { _ in Color(nsColor: .windowBackgroundColor) },
        node: { node, context in
          ShowcaseNode(node: node, context: context)
        },
        edge: { _, context in
          FlowingGraphCanvasDefaultEdge(context: context)
        },
        port: { port, context in
          ShowcasePort(port: port, context: context)
        },
        decorations: { _ in EmptyView() },
        overlays: { _ in
          Text(intentState)
            .accessibilityIdentifier("graph-port-hit-testing-state")
            .padding(16)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .allowsHitTesting(false)
        }
      )
    } else {
      ProgressView()
    }
  }
}

private struct TestHostWindowPositioner: NSViewRepresentable {
  func makeNSView(context: Context) -> NSView {
    TestHostWindowPositioningView()
  }

  func updateNSView(_ nsView: NSView, context: Context) {}
}

private final class TestHostWindowPositioningView: NSView {
  override func viewDidMoveToWindow() {
    super.viewDidMoveToWindow()
    guard let window else { return }
    DispatchQueue.main.async {
      guard let screen = NSScreen.screens.first(where: { $0.frame.origin == .zero }) else { return }
      window.setFrameOrigin(
        NSPoint(
          x: screen.visibleFrame.midX - window.frame.width / 2,
          y: screen.visibleFrame.midY - window.frame.height / 2
        )
      )
    }
  }
}
