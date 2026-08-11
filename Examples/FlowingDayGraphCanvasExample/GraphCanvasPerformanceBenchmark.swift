import AppKit
import CoreGraphics
import CoreVideo
import FlowingDayCanvas
import FlowingDayGraphCanvas
import FlowingDayGraphComposition
import FlowingDayGraphCore
import FlowingDayGraphLayout
import Foundation
import SwiftUI

enum PerformanceGraphSchema: FlowingGraphSchema {
  typealias NodeID = Int
  typealias NodeValue = Int
  typealias PortID = Int
  typealias PortValue = Int
  typealias EdgeID = Int
  typealias EdgeValue = Int
}

enum PerformanceCanvasSchema: FlowingGraphCanvasSchema {
  typealias DocumentID = Int
  typealias GraphID = Int
  typealias EntryPointID = Int
  typealias LinkID = Int
  typealias LinkValue = Int
  typealias GraphSchema = PerformanceGraphSchema
}

@MainActor
struct GraphCanvasPerformancePreviewView: View {
  @State private var session = FlowingGraphCanvasSessionState<PerformanceCanvasSchema>(
    tool: .select
  )
  private let sessionID = FlowingGraphCanvasSessionID()
  private let content = try! GraphCanvasPerformanceFixture.makeContent(nodeCount: 500)

  var body: some View {
    FlowingGraphCanvas(
      content: content,
      sessionID: sessionID,
      session: $session,
      configuration: GraphCanvasPerformanceFixture.configuration
    ) { _ in
      Color.white
    } node: { node, context in
      GraphCanvasPerformanceNode(node: node, context: context)
    } edge: { _, _ in
      EmptyView()
    } overlays: { _ in
      FlowingCanvasViewportOverlay(
        alignment: .bottomTrailing,
        insets: EdgeInsets(top: 0, leading: 0, bottom: 20, trailing: 20)
      ) {
        HStack(spacing: 6) {
          toolButton(.select, title: "Select", systemImage: "cursorarrow")
          toolButton(.pan, title: "Pan", systemImage: "hand.draw")
        }
        .padding(8)
        .background(.regularMaterial, in: Capsule())
      }
    }
    .background(GraphCanvasPerformancePreviewWindowAttachment())
  }

  @ViewBuilder
  private func toolButton(
    _ tool: FlowingGraphCanvasTool,
    title: String,
    systemImage: String
  ) -> some View {
    if session.tool == tool {
      Button {
        session.tool = tool
      } label: {
        Label(title, systemImage: systemImage)
      }
      .buttonStyle(.borderedProminent)
    } else {
      Button {
        session.tool = tool
      } label: {
        Label(title, systemImage: systemImage)
      }
      .buttonStyle(.bordered)
    }
  }
}

private struct GraphCanvasPerformancePreviewWindowAttachment: NSViewRepresentable {
  func makeNSView(context: Context) -> NSView {
    PreviewWindowView()
  }

  func updateNSView(_ nsView: NSView, context: Context) {}

  private final class PreviewWindowView: NSView {
    override func viewDidMoveToWindow() {
      super.viewDidMoveToWindow()
      guard let window, let screen = NSScreen.screens.first else { return }
      let visibleFrame = screen.visibleFrame
      window.setFrameOrigin(
        CGPoint(
          x: visibleFrame.midX - window.frame.width / 2,
          y: visibleFrame.midY - window.frame.height / 2
        )
      )
      window.makeKeyAndOrderFront(nil)
      NSApplication.shared.activate(ignoringOtherApps: true)
    }
  }
}

private struct GraphCanvasPerformanceNode: View {
  let node: FlowingGraphPresentationNode<PerformanceCanvasSchema>
  let context: FlowingGraphCanvasNodeContext<PerformanceCanvasSchema>

  var body: some View {
    RoundedRectangle(cornerRadius: 2)
      .fill(Color(hue: Double(node.value % 24) / 24, saturation: 0.34, brightness: 0.94))
      .overlay {
        VStack(alignment: .leading, spacing: 3) {
          Text("Node \(node.value)")
            .font(.system(size: 12, weight: .semibold))
          Text("Graph canvas benchmark")
            .font(.system(size: 9))
            .foregroundStyle(.secondary)
        }
        .padding(8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      }
      .overlay {
        RoundedRectangle(cornerRadius: 2)
          .stroke(context.isSelected ? Color.accentColor : Color.black.opacity(0.08))
      }
  }
}

@MainActor
struct GraphCanvasPerformanceBenchmarkView: View {
  private typealias Session = FlowingGraphCanvasSessionState<PerformanceCanvasSchema>

  @State private var session = Session(tool: .pan)
  @State private var content: FlowingGraphCanvasContent<PerformanceCanvasSchema>?
  @State private var failure: String?
  @State private var buildDuration: TimeInterval?
  @StateObject private var driver = GraphCanvasPerformanceDriver()

  var body: some View {
    Group {
      if let content {
        canvas(content: content)
      } else if let failure {
        Text(failure)
          .foregroundStyle(.red)
      } else {
        ProgressView("Building 100,000-node benchmark…")
      }
    }
    .background(Color.white)
    .task {
      guard content == nil, failure == nil else { return }
      let start = ContinuousClock.now
      do {
        content = try GraphCanvasPerformanceFixture.makeContent()
        buildDuration = start.duration(to: .now).seconds
      } catch {
        failure = String(describing: error)
        print("FLOWING_BENCHMARK_ERROR \(error)")
      }
    }
  }

  private func canvas(
    content: FlowingGraphCanvasContent<PerformanceCanvasSchema>
  ) -> some View {
    FlowingGraphCanvas(
      content: content,
      sessionID: driver.sessionID,
      session: $session,
      configuration: GraphCanvasPerformanceFixture.configuration
    ) { _ in
      Color.white
    } node: { node, context in
      GraphCanvasPerformanceNode(node: node, context: context)
    } edge: { _, _ in
      EmptyView()
    } overlays: { context in
      GraphCanvasPerformanceAttachment(
        proxy: context.proxy,
        driver: driver,
        contentBounds: content.contentBounds,
        buildDuration: buildDuration ?? 0,
        interaction: { action in
          apply(action, to: content)
        }
      )
    }
  }

  private func apply(
    _ action: GraphCanvasBenchmarkInteraction,
    to content: FlowingGraphCanvasContent<PerformanceCanvasSchema>
  ) {
    let nodes = content.presentation.nodes
    switch action {
    case .idle:
      session.transientNodeDrag = nil
    case .drag(let translation):
      let nodeIDs = Set(nodes.prefix(8).map(\.id))
      guard let nodeID = nodes.first?.id else { return }
      session.selection = nodeIDs
      session.transientNodeDrag = FlowingGraphCanvasTransientNodeDrag(
        nodeID: nodeID,
        nodeIDs: nodeIDs,
        basePresentationSnapshotID: content.presentation.snapshotID,
        baseLayoutInputID: content.id,
        translation: translation
      )
    case .selection(let index):
      session.transientNodeDrag = nil
      guard !nodes.isEmpty else { return }
      session.selection = [nodes[index % nodes.count].id]
    }
  }
}

private enum GraphCanvasPerformanceFixture {
  typealias CanvasSchema = PerformanceCanvasSchema
  typealias LayoutSchema = FlowingGraphCanvasLayoutSchema<CanvasSchema>

  static let nodeCount =
    ProcessInfo.processInfo.environment["FLOWING_CANVAS_BENCHMARK_NODES"]
    .flatMap(Int.init) ?? 100_000
  static let columnCount = 400
  static let nodeSize = CGSize(width: 120, height: 64)
  static let cellSize = CGSize(width: 152, height: 96)

  static let configuration = FlowingGraphCanvasConfiguration(
    canvas: FlowingCanvasConfiguration(
      initialZoom: 1,
      focusedZoom: 1,
      zoomRange: 0.5...2
    ),
    edgeRenderPadding: 0,
    nodeDraggingMode: .multiple,
    snapping: .disabled,
    allowsArrangementCommands: false,
    keyboardNavigation: .disabled,
    accessibility: .disabled
  )

  static func makeContent(
    nodeCount: Int = nodeCount
  ) throws -> FlowingGraphCanvasContent<CanvasSchema> {
    let resolvedColumnCount = min(
      columnCount,
      max(Int(ceil(sqrt(Double(nodeCount)))), 1)
    )
    var graph = FlowingGraph<PerformanceGraphSchema>()
    let mutation = graph.update { transaction in
      for id in 0..<nodeCount {
        transaction.insert(FlowingGraphNode(id: id, value: id))
      }
    }
    guard case .committed = mutation else {
      throw GraphCanvasPerformanceFixtureIssue.graphMutationFailed
    }

    let document = FlowingGraphDocument<CanvasSchema>(
      id: 0,
      defaultEntryPointID: 0,
      entryPoints: [FlowingGraphEntryPoint(id: 0, name: "Benchmark", graphID: 0)],
      definitions: [FlowingGraphDefinition(id: 0, graph: graph)],
      subgraphLinks: []
    )
    let presentation = try FlowingGraphProjector(document: document).projectDefault()
    let topology = try FlowingGraphCanvasLayoutAdapter.topology(for: presentation)
    let input = try FlowingGraphLayoutResolution.input(
      topology: topology,
      nodeSizeResolver: FlowingFixedNodeSizeResolver<LayoutSchema>(size: nodeSize),
      portAnchorResolver: FlowingCenteredPortAnchorResolver<LayoutSchema>(),
      pipelineIdentity: FlowingLayoutPipelineIdentity(
        component: FlowingLayoutComponentIdentity()
      )
    )
    let nodeFrames = input.topology.nodeIDs.enumerated().map { index, nodeID in
      FlowingGraphNodeFrame<LayoutSchema>(
        nodeID: nodeID,
        frame: frame(at: index, columnCount: resolvedColumnCount)
      )
    }
    let rowCount = (nodeCount + resolvedColumnCount - 1) / resolvedColumnCount
    let contentBounds = CGRect(
      x: 0,
      y: 0,
      width: CGFloat(resolvedColumnCount - 1) * cellSize.width + nodeSize.width,
      height: CGFloat(rowCount - 1) * cellSize.height + nodeSize.height
    )
    let placement = try FlowingGraphNodePlacement(
      input: input,
      nodeFrames: nodeFrames,
      contentBounds: contentBounds
    )
    let result = try FlowingGraphLayoutResult(
      input: input,
      placement: placement,
      edgeRoutes: []
    )
    return try FlowingGraphCanvasContent(
      presentation: presentation,
      layoutInput: input,
      layoutResult: result
    )
  }

  private static func frame(at index: Int, columnCount: Int) -> CGRect {
    CGRect(
      x: CGFloat(index % columnCount) * cellSize.width,
      y: CGFloat(index / columnCount) * cellSize.height,
      width: nodeSize.width,
      height: nodeSize.height
    )
  }
}

private enum GraphCanvasPerformanceFixtureIssue: Error {
  case graphMutationFailed
}

private struct GraphCanvasPerformanceAttachment: NSViewRepresentable {
  let proxy: FlowingCanvasProxy
  let driver: GraphCanvasPerformanceDriver
  let contentBounds: CGRect
  let buildDuration: TimeInterval
  let interaction: (GraphCanvasBenchmarkInteraction) -> Void

  func makeNSView(context: Context) -> GraphCanvasPerformanceHostView {
    GraphCanvasPerformanceHostView { window in
      driver.attach(to: window)
    }
  }

  func updateNSView(_ view: GraphCanvasPerformanceHostView, context: Context) {
    driver.update(
      proxy: proxy,
      contentBounds: contentBounds,
      buildDuration: buildDuration,
      interaction: interaction,
      window: view.window
    )
  }
}

private final class GraphCanvasPerformanceHostView: NSView {
  private let didAttachToWindow: (NSWindow) -> Void

  init(didAttachToWindow: @escaping (NSWindow) -> Void) {
    self.didAttachToWindow = didAttachToWindow
    super.init(frame: .zero)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError()
  }

  override func viewDidMoveToWindow() {
    super.viewDidMoveToWindow()
    guard let window else { return }
    window.title = "Graph Canvas Performance Benchmark"
    didAttachToWindow(window)
  }
}

@MainActor
private final class GraphCanvasPerformanceDriver: ObservableObject, @unchecked Sendable {
  let sessionID = FlowingGraphCanvasSessionID()

  private let warmupDuration: TimeInterval = 2
  private let measurementDuration: TimeInterval = 20
  nonisolated private let tickState = GraphCanvasDisplayTickState()
  private var displayLink: CVDisplayLink?
  private var latestProxy: FlowingCanvasProxy?
  private var contentBounds = CGRect.zero
  private var buildDuration: TimeInterval = 0
  private var interaction: ((GraphCanvasBenchmarkInteraction) -> Void)?
  private var startTime: UInt64?
  private var previousDeliveryTime: UInt64?
  private var deliveryIntervals: [Double] = []
  private var deliveryIntervalsByPhase: [String: [Double]] = [:]
  private var previousRenderWorldRect = CGRect.zero
  private var renderCoverageChanges = 0
  private var deliveredUpdates = 0
  private var hasFinished = false
  private var lastInteraction = GraphCanvasBenchmarkInteraction.idle

  func update(
    proxy: FlowingCanvasProxy,
    contentBounds: CGRect,
    buildDuration: TimeInterval,
    interaction: @escaping (GraphCanvasBenchmarkInteraction) -> Void,
    window: NSWindow?
  ) {
    latestProxy = proxy
    self.contentBounds = contentBounds
    self.buildDuration = buildDuration
    self.interaction = interaction
    if let window {
      attach(to: window)
    }
  }

  func attach(to window: NSWindow) {
    guard displayLink == nil, latestProxy != nil else { return }
    moveToMainDisplay(window)
    startDisplayLink()
  }

  private func moveToMainDisplay(_ window: NSWindow) {
    let mainDisplayID = CGMainDisplayID()
    guard
      let screen = NSScreen.screens.first(where: { screen in
        (screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?
          .uint32Value == mainDisplayID
      })
    else {
      return
    }
    let visibleFrame = screen.visibleFrame
    let origin = CGPoint(
      x: visibleFrame.midX - window.frame.width / 2,
      y: visibleFrame.midY - window.frame.height / 2
    )
    window.setFrameOrigin(origin)
    window.makeKeyAndOrderFront(nil)
  }

  private func startDisplayLink() {
    var nextDisplayLink: CVDisplayLink?
    guard CVDisplayLinkCreateWithCGDisplay(CGMainDisplayID(), &nextDisplayLink) == kCVReturnSuccess,
      let nextDisplayLink
    else {
      print("FLOWING_BENCHMARK_ERROR display-link")
      return
    }
    displayLink = nextDisplayLink
    CVDisplayLinkSetOutputCallback(
      nextDisplayLink,
      { _, _, _, _, _, context in
        guard let context else { return kCVReturnError }
        let driver = Unmanaged<GraphCanvasPerformanceDriver>
          .fromOpaque(context)
          .takeUnretainedValue()
        driver.receiveDisplayTick()
        return kCVReturnSuccess
      },
      Unmanaged.passUnretained(self).toOpaque()
    )
    CVDisplayLinkStart(nextDisplayLink)
  }

  nonisolated private func receiveDisplayTick() {
    let now = DispatchTime.now().uptimeNanoseconds
    guard tickState.registerTick() else { return }

    DispatchQueue.main.async { [weak self] in
      self?.deliverFrame(at: now)
    }
  }

  private func deliverFrame(at now: UInt64) {
    tickState.completeDelivery()

    guard !hasFinished, let proxy = latestProxy else { return }
    if startTime == nil {
      startTime = now
    }
    guard let startTime else { return }
    let elapsed = Double(now - startTime) / 1_000_000_000
    let measuredElapsed = elapsed - warmupDuration

    if measuredElapsed >= 0 {
      if let previousDeliveryTime {
        let interval = Double(now - previousDeliveryTime) / 1_000_000
        deliveryIntervals.append(interval)
        deliveryIntervalsByPhase[Self.phaseName(at: measuredElapsed), default: []]
          .append(interval)
      }
      previousDeliveryTime = now
      deliveredUpdates += 1
      let renderWorldRect = proxy.context.renderWorldRect
      if renderWorldRect != previousRenderWorldRect {
        previousRenderWorldRect = renderWorldRect
        renderCoverageChanges += 1
      }
    }

    if measuredElapsed >= measurementDuration {
      finish(proxy: proxy)
      return
    }

    let progress = max(elapsed, 0)
    let phase = max(measuredElapsed, 0).truncatingRemainder(dividingBy: measurementDuration)
    let center = CGPoint(
      x: contentBounds.midX + sin(progress * 0.72) * 2_400,
      y: contentBounds.midY + cos(progress * 0.57) * 1_600
    )
    switch phase {
    case 0..<4:
      apply(.idle)
      proxy.center(on: center, zoom: 1, phase: .continuous)
    case 4..<8:
      apply(.idle)
      let zoom = 1 + sin((phase - 4) * .pi / 2) * 0.42
      proxy.center(on: center, zoom: zoom, phase: .continuous)
    case 8..<12:
      let dragProgress = phase - 8
      apply(
        .drag(
          CGSize(
            width: sin(dragProgress * .pi) * 180,
            height: cos(dragProgress * .pi * 0.8) * 120
          )
        )
      )
    case 12..<16:
      apply(.selection(Int((phase - 12) * 4)))
    default:
      apply(.idle)
      let zoom = 1 + sin(progress * 1.15) * 0.34
      proxy.center(on: center, zoom: zoom, phase: .continuous)
    }
  }

  private func finish(proxy: FlowingCanvasProxy) {
    hasFinished = true
    proxy.center(
      on: CGPoint(x: contentBounds.midX, y: contentBounds.midY),
      zoom: 1,
      phase: .ended
    )
    if let displayLink {
      CVDisplayLinkStop(displayLink)
    }
    let tickCounts = tickState.snapshot()
    let result = GraphCanvasPerformanceResult(
      displayRefreshRate: CGDisplayCopyDisplayMode(CGMainDisplayID())?.refreshRate ?? 0,
      nodeCount: GraphCanvasPerformanceFixture.nodeCount,
      buildDuration: buildDuration,
      measurementDuration: measurementDuration,
      displayTicks: tickCounts.displayTicks,
      deliveredUpdates: deliveredUpdates,
      coalescedTicks: tickCounts.coalescedTicks,
      deliveryIntervals: deliveryIntervals,
      deliveryIntervalsByPhase: deliveryIntervalsByPhase,
      renderCoverageChanges: renderCoverageChanges
    )
    print("FLOWING_BENCHMARK_RESULT \(result.json)")
    DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
      NSApplication.shared.terminate(nil)
    }
  }

  private static func phaseName(at elapsed: TimeInterval) -> String {
    switch elapsed {
    case 0..<4:
      "pan"
    case 4..<8:
      "zoom"
    case 8..<12:
      "nodeDrag"
    case 12..<16:
      "selection"
    default:
      "panZoom"
    }
  }

  private func apply(_ nextInteraction: GraphCanvasBenchmarkInteraction) {
    guard nextInteraction != lastInteraction else { return }
    lastInteraction = nextInteraction
    interaction?(nextInteraction)
  }
}

private enum GraphCanvasBenchmarkInteraction: Equatable {
  case idle
  case drag(CGSize)
  case selection(Int)
}

private final class GraphCanvasDisplayTickState: @unchecked Sendable {
  private let lock = NSLock()
  private var displayTicks = 0
  private var coalescedTicks = 0
  private var deliveryPending = false

  func registerTick() -> Bool {
    lock.lock()
    defer { lock.unlock() }
    displayTicks += 1
    guard !deliveryPending else {
      coalescedTicks += 1
      return false
    }
    deliveryPending = true
    return true
  }

  func completeDelivery() {
    lock.lock()
    deliveryPending = false
    lock.unlock()
  }

  func snapshot() -> (displayTicks: Int, coalescedTicks: Int) {
    lock.lock()
    defer { lock.unlock() }
    return (displayTicks, coalescedTicks)
  }
}

private struct GraphCanvasPerformanceResult: Encodable {
  let displayRefreshRate: Double
  let nodeCount: Int
  let buildDuration: TimeInterval
  let measurementDuration: TimeInterval
  let displayTicks: Int
  let deliveredUpdates: Int
  let coalescedTicks: Int
  let medianIntervalMilliseconds: Double
  let p95IntervalMilliseconds: Double
  let p99IntervalMilliseconds: Double
  let maximumIntervalMilliseconds: Double
  let intervalsOverTarget: Int
  let intervalsOverTwoFrames: Int
  let renderCoverageChanges: Int
  let phases: [String: GraphCanvasPerformancePhaseResult]

  init(
    displayRefreshRate: Double,
    nodeCount: Int,
    buildDuration: TimeInterval,
    measurementDuration: TimeInterval,
    displayTicks: Int,
    deliveredUpdates: Int,
    coalescedTicks: Int,
    deliveryIntervals: [Double],
    deliveryIntervalsByPhase: [String: [Double]],
    renderCoverageChanges: Int
  ) {
    let target = 1_000 / max(displayRefreshRate, 1)
    self.displayRefreshRate = displayRefreshRate
    self.nodeCount = nodeCount
    self.buildDuration = buildDuration
    self.measurementDuration = measurementDuration
    self.displayTicks = displayTicks
    self.deliveredUpdates = deliveredUpdates
    self.coalescedTicks = coalescedTicks
    self.renderCoverageChanges = renderCoverageChanges
    medianIntervalMilliseconds = Self.percentile(0.5, values: deliveryIntervals)
    p95IntervalMilliseconds = Self.percentile(0.95, values: deliveryIntervals)
    p99IntervalMilliseconds = Self.percentile(0.99, values: deliveryIntervals)
    maximumIntervalMilliseconds = deliveryIntervals.max() ?? 0
    intervalsOverTarget = deliveryIntervals.count { $0 > target * 1.5 }
    intervalsOverTwoFrames = deliveryIntervals.count { $0 > target * 2.5 }
    phases = deliveryIntervalsByPhase.mapValues {
      GraphCanvasPerformancePhaseResult(
        targetIntervalMilliseconds: target,
        intervals: $0
      )
    }
  }

  var json: String {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    guard let data = try? encoder.encode(self),
      let string = String(data: data, encoding: .utf8)
    else {
      return "{}"
    }
    return string
  }

  private static func percentile(_ percentile: Double, values: [Double]) -> Double {
    guard !values.isEmpty else { return 0 }
    let sorted = values.sorted()
    let index = min(Int((Double(sorted.count - 1) * percentile).rounded()), sorted.count - 1)
    return sorted[index]
  }
}

private struct GraphCanvasPerformancePhaseResult: Encodable {
  let deliveredIntervals: Int
  let medianIntervalMilliseconds: Double
  let p95IntervalMilliseconds: Double
  let maximumIntervalMilliseconds: Double
  let intervalsOverTarget: Int

  init(targetIntervalMilliseconds: Double, intervals: [Double]) {
    let sorted = intervals.sorted()
    deliveredIntervals = intervals.count
    medianIntervalMilliseconds = Self.percentile(0.5, sortedValues: sorted)
    p95IntervalMilliseconds = Self.percentile(0.95, sortedValues: sorted)
    maximumIntervalMilliseconds = sorted.last ?? 0
    intervalsOverTarget = intervals.count { $0 > targetIntervalMilliseconds * 1.5 }
  }

  private static func percentile(_ percentile: Double, sortedValues: [Double]) -> Double {
    guard !sortedValues.isEmpty else { return 0 }
    let index = min(
      Int((Double(sortedValues.count - 1) * percentile).rounded()),
      sortedValues.count - 1
    )
    return sortedValues[index]
  }
}

extension Duration {
  fileprivate var seconds: TimeInterval {
    let parts = components
    return Double(parts.seconds) + Double(parts.attoseconds) / 1_000_000_000_000_000_000
  }
}
