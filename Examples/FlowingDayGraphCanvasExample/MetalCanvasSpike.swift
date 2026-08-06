import AppKit
import FlowingDayGraphLayout
import MetalKit
import SwiftUI

private enum MetalCanvasSpikeMetrics {
  static let nodeSize = CGSize(width: 126, height: 66)
  static let cellSize = CGSize(width: 164, height: 106)
  static let renderOverscan: CGFloat = 320
  static let renderCoverageRetentionRatio: CGFloat = 0.5
  static let overviewMaximumPixelHeight: CGFloat = 18
  static let compactMaximumPixelHeight: CGFloat = 44
  static let frameResourceCount = 3
  static let minimumBufferLength = 256
  static let interactionRenderTail: TimeInterval = 0.18
  static let renderIndexCommitDelayNanoseconds: UInt64 = 80_000_000
}

enum MetalCanvasSpikeBenchmarkInteraction: Equatable {
  case none
  case pan
  case zoom
}

struct MetalCanvasSpikeConfiguration: Equatable {
  static let defaultNodeCount = 500

  let nodeCount: Int
  let benchmarkInteraction: MetalCanvasSpikeBenchmarkInteraction

  init(arguments: [String]) {
    nodeCount =
      Self.positiveInteger(
        following: "--canvas-metal-node-count",
        in: arguments
      ) ?? Self.defaultNodeCount
    if arguments.contains("--canvas-metal-zoom-benchmark") {
      benchmarkInteraction = .zoom
    } else if arguments.contains("--canvas-metal-pan-benchmark") {
      benchmarkInteraction = .pan
    } else {
      benchmarkInteraction = .none
    }
  }

  private static func positiveInteger(
    following option: String,
    in arguments: [String]
  ) -> Int? {
    guard let optionIndex = arguments.firstIndex(of: option) else { return nil }
    let valueIndex = arguments.index(after: optionIndex)
    guard valueIndex < arguments.endIndex,
      let value = Int(arguments[valueIndex]),
      value > 0
    else { return nil }
    return value
  }
}

enum MetalCanvasSpikeTool: Equatable {
  case select
  case pan
}

struct MetalCanvasSpikeCamera: Equatable {
  var zoom: CGFloat = 1
  var offset = CGSize.zero

  func worldPoint(for viewportPoint: CGPoint) -> CGPoint {
    CGPoint(
      x: (viewportPoint.x - offset.width) / zoom,
      y: (viewportPoint.y - offset.height) / zoom
    )
  }

  func visibleWorldRect(viewportSize: CGSize, overscan: CGFloat = 0) -> CGRect {
    let viewportRect = CGRect(origin: .zero, size: viewportSize).insetBy(
      dx: -overscan,
      dy: -overscan
    )
    let minimum = worldPoint(for: viewportRect.origin)
    let maximum = worldPoint(
      for: CGPoint(x: viewportRect.maxX, y: viewportRect.maxY)
    )
    return CGRect(
      x: minimum.x,
      y: minimum.y,
      width: maximum.x - minimum.x,
      height: maximum.y - minimum.y
    )
  }

  mutating func pan(by translation: CGSize) {
    offset.width += translation.width
    offset.height += translation.height
  }

  mutating func magnify(
    by magnification: CGFloat,
    at viewportPoint: CGPoint,
    range: ClosedRange<CGFloat> = 0.2...3
  ) {
    let worldAnchor = worldPoint(for: viewportPoint)
    zoom = min(max(zoom * (1 + magnification), range.lowerBound), range.upperBound)
    offset = CGSize(
      width: viewportPoint.x - worldAnchor.x * zoom,
      height: viewportPoint.y - worldAnchor.y * zoom
    )
  }

  mutating func fit(
    _ worldRect: CGRect,
    in viewportSize: CGSize,
    padding: CGFloat = 64,
    maximumZoom: CGFloat = 1
  ) {
    let availableWidth = max(viewportSize.width - padding * 2, 1)
    let availableHeight = max(viewportSize.height - padding * 2, 1)
    zoom = min(
      max(min(availableWidth / worldRect.width, availableHeight / worldRect.height), 0.2),
      maximumZoom
    )
    offset = CGSize(
      width: viewportSize.width / 2 - worldRect.midX * zoom,
      height: viewportSize.height / 2 - worldRect.midY * zoom
    )
  }
}

struct MetalCanvasSpikeNode: Equatable, Sendable {
  let id: Int
  var frame: CGRect
  let color: SIMD4<Float>
}

struct MetalCanvasSpikeEdge: Equatable, Sendable {
  let id: Int
  let sourceID: Int
  let targetID: Int
}

enum MetalCanvasSpikeNodeLevelOfDetail: UInt32, Equatable {
  case overview
  case compact
  case full

  static func resolve(nodeHeight: CGFloat, zoom: CGFloat) -> Self {
    let pixelHeight = nodeHeight * zoom
    if pixelHeight < MetalCanvasSpikeMetrics.overviewMaximumPixelHeight {
      return .overview
    }
    if pixelHeight < MetalCanvasSpikeMetrics.compactMaximumPixelHeight {
      return .compact
    }
    return .full
  }
}

struct MetalCanvasSpikeRenderSliceCoverage: Equatable {
  let retainedWorldRect: CGRect
  let levelOfDetail: MetalCanvasSpikeNodeLevelOfDetail

  func covers(
    viewportWorldRect: CGRect,
    levelOfDetail: MetalCanvasSpikeNodeLevelOfDetail
  ) -> Bool {
    self.levelOfDetail == levelOfDetail && retainedWorldRect.contains(viewportWorldRect)
  }
}

enum MetalCanvasSpikeLayoutSchema: FlowingGraphLayoutSchema {
  typealias NodeID = Int
  typealias PortID = Int
  typealias EdgeID = Int
}

struct MetalCanvasSpikeRenderIndexUpdate: Sendable {
  let revision: UInt64
  let renderIndex: FlowingGraphRenderIndex<MetalCanvasSpikeLayoutSchema>
}

struct MetalCanvasSpikeRenderIndexSnapshot: Sendable {
  let revision: UInt64
  let nodes: [MetalCanvasSpikeNode]
  let edges: [MetalCanvasSpikeEdge]

  func build() -> MetalCanvasSpikeRenderIndexUpdate {
    MetalCanvasSpikeRenderIndexUpdate(
      revision: revision,
      renderIndex: MetalCanvasSpikeScene.makeRenderIndex(nodes: nodes, edges: edges)
    )
  }
}

struct MetalCanvasSpikeScene {
  var nodes: [MetalCanvasSpikeNode]
  let edges: [MetalCanvasSpikeEdge]

  private var renderIndex: FlowingGraphRenderIndex<MetalCanvasSpikeLayoutSchema>
  private let nodeIndexByID: [Int: Int]
  private let edgeIndexByID: [Int: Int]
  private let edgeIndicesByNodeID: [Int: [Int]]
  private var movedNodeIDs: Set<Int> = []
  private var movedEdgeIDs: Set<Int> = []
  private var geometryRevision: UInt64 = 0

  var contentBounds: CGRect {
    nodes.dropFirst().reduce(nodes.first?.frame ?? .zero) { $0.union($1.frame) }
  }

  var hasPendingIndexChanges: Bool {
    !movedNodeIDs.isEmpty
  }

  func nodeID(at point: CGPoint) -> Int? {
    let queryRect = CGRect(x: point.x - 0.5, y: point.y - 0.5, width: 1, height: 1)
    return candidates(
      indexed: renderIndex.unorderedNodeIDs(intersecting: queryRect),
      additional: movedNodeIDs
    ).last { nodeID in
      nodeIndexByID[nodeID].map { nodes[$0].frame.contains(point) } == true
    }
  }

  func nodeIDs(intersecting rect: CGRect) -> Set<Int> {
    Set(
      candidates(
        indexed: renderIndex.unorderedNodeIDs(intersecting: rect),
        additional: movedNodeIDs
      ).filter { nodeID in
        nodeIndexByID[nodeID].map { nodes[$0].frame.intersects(rect) } == true
      }
    )
  }

  func node(for id: Int) -> MetalCanvasSpikeNode? {
    nodeIndexByID[id].map { nodes[$0] }
  }

  func edgeEndpoints(for id: Int) -> (start: CGPoint, end: CGPoint)? {
    guard let edgeIndex = edgeIndexByID[id] else { return nil }
    let edge = edges[edgeIndex]
    guard let sourceIndex = nodeIndexByID[edge.sourceID],
      let targetIndex = nodeIndexByID[edge.targetID]
    else { return nil }
    return (nodes[sourceIndex].frame.center, nodes[targetIndex].frame.center)
  }

  func renderElementIDs(
    intersecting rect: CGRect
  ) -> (nodeIDs: [Int], edgeIDs: [Int]) {
    let indexed = renderIndex.unorderedElementIDs(intersecting: rect)
    let nodeIDs = candidates(indexed: indexed.nodeIDs, additional: movedNodeIDs).filter { nodeID in
      nodeIndexByID[nodeID].map { nodeIndex in
        nodes[nodeIndex].frame.intersects(rect)
      } == true
    }
    let edgeIDs = candidates(indexed: indexed.edgeIDs, additional: movedEdgeIDs).filter {
      edgeBounds(for: $0)?.intersectsIncludingBoundary(rect) == true
    }
    return (nodeIDs, edgeIDs)
  }

  mutating func moveNodes(
    from origins: [Int: CGPoint],
    by translation: CGSize
  ) {
    var didMove = false
    for (nodeID, origin) in origins {
      guard let index = nodeIndexByID[nodeID] else { continue }
      nodes[index].frame.origin = CGPoint(
        x: origin.x + translation.width,
        y: origin.y + translation.height
      )
      movedNodeIDs.insert(nodeID)
      for edgeIndex in edgeIndicesByNodeID[nodeID, default: []] {
        movedEdgeIDs.insert(edges[edgeIndex].id)
      }
      didMove = true
    }
    if didMove {
      geometryRevision &+= 1
    }
  }

  mutating func commitMoves() {
    guard !movedNodeIDs.isEmpty else { return }
    install(renderIndexSnapshot().build())
  }

  func renderIndexSnapshot() -> MetalCanvasSpikeRenderIndexSnapshot {
    MetalCanvasSpikeRenderIndexSnapshot(
      revision: geometryRevision,
      nodes: nodes,
      edges: edges
    )
  }

  @discardableResult
  mutating func install(_ update: MetalCanvasSpikeRenderIndexUpdate) -> Bool {
    guard update.revision == geometryRevision else { return false }
    renderIndex = update.renderIndex
    movedNodeIDs.removeAll(keepingCapacity: true)
    movedEdgeIDs.removeAll(keepingCapacity: true)
    return true
  }

  static func make(nodeCount: Int) -> MetalCanvasSpikeScene {
    let columnCount = max(Int(ceil(sqrt(Double(nodeCount)))), 1)
    let nodes = (0..<nodeCount).map { id in
      MetalCanvasSpikeNode(
        id: id,
        frame: CGRect(
          x: CGFloat(id % columnCount) * MetalCanvasSpikeMetrics.cellSize.width,
          y: CGFloat(id / columnCount) * MetalCanvasSpikeMetrics.cellSize.height,
          width: MetalCanvasSpikeMetrics.nodeSize.width,
          height: MetalCanvasSpikeMetrics.nodeSize.height
        ),
        color: Self.palette[id % Self.palette.count]
      )
    }
    let edges = (1..<nodeCount).map { targetID in
      MetalCanvasSpikeEdge(
        id: targetID - 1,
        sourceID: (targetID - 1) / 3,
        targetID: targetID
      )
    }
    return MetalCanvasSpikeScene(
      nodes: nodes,
      edges: edges,
      renderIndex: makeRenderIndex(nodes: nodes, edges: edges),
      nodeIndexByID: Dictionary(
        uniqueKeysWithValues: nodes.indices.map { (nodes[$0].id, $0) }
      ),
      edgeIndexByID: Dictionary(
        uniqueKeysWithValues: edges.indices.map { (edges[$0].id, $0) }
      ),
      edgeIndicesByNodeID: edgeIndicesByNodeID(edges: edges)
    )
  }

  private func candidates(indexed: [Int], additional: Set<Int>) -> [Int] {
    guard !additional.isEmpty else { return indexed }
    var seen = Set(indexed)
    var result = indexed
    result.reserveCapacity(indexed.count + additional.count)
    for id in additional where seen.insert(id).inserted {
      result.append(id)
    }
    return result
  }

  private func edgeBounds(for id: Int) -> CGRect? {
    edgeEndpoints(for: id).map { start, end in
      CGRect(
        x: min(start.x, end.x),
        y: min(start.y, end.y),
        width: abs(end.x - start.x),
        height: abs(end.y - start.y)
      )
    }
  }

  private static func edgeIndicesByNodeID(
    edges: [MetalCanvasSpikeEdge]
  ) -> [Int: [Int]] {
    var result: [Int: [Int]] = [:]
    for (index, edge) in edges.enumerated() {
      result[edge.sourceID, default: []].append(index)
      if edge.targetID != edge.sourceID {
        result[edge.targetID, default: []].append(index)
      }
    }
    return result
  }

  static func makeRenderIndex(
    nodes: [MetalCanvasSpikeNode],
    edges: [MetalCanvasSpikeEdge]
  ) -> FlowingGraphRenderIndex<MetalCanvasSpikeLayoutSchema> {
    do {
      let topology = try FlowingGraphLayoutTopology<MetalCanvasSpikeLayoutSchema>(
        nodeIDs: nodes.map(\.id),
        ports: [],
        edges: edges.map { edge in
          FlowingGraphLayoutEdge(
            id: edge.id,
            endpoints: .directed(
              source: .node(edge.sourceID),
              target: .node(edge.targetID)
            )
          )
        }
      )
      let componentIdentity = FlowingLayoutComponentIdentity()
      let input = try FlowingGraphLayoutInput(
        id: FlowingLayoutInputID(
          presentationSnapshotID: topology.snapshotID,
          pipelineIdentity: FlowingLayoutPipelineIdentity(component: componentIdentity),
          nodeSizeRevision: componentIdentity,
          portAnchorRevision: componentIdentity,
          layoutStateRevision: FlowingLayoutRevision()
        ),
        topology: topology,
        nodeSizes: nodes.map { FlowingGraphLayoutNodeSize(nodeID: $0.id, size: $0.frame.size) },
        portAnchors: []
      )
      let placement = try FlowingGraphNodePlacement(
        input: input,
        nodeFrames: nodes.map { FlowingGraphNodeFrame(nodeID: $0.id, frame: $0.frame) },
        contentBounds: nodes.dropFirst().reduce(nodes.first?.frame ?? .zero) {
          $0.union($1.frame)
        }
      )
      let frameByNodeID = Dictionary(
        uniqueKeysWithValues: nodes.map { ($0.id, $0.frame) }
      )
      let result = try FlowingGraphLayoutResult(
        input: input,
        placement: placement,
        edgeRoutes: edges.compactMap { edge in
          guard let sourceFrame = frameByNodeID[edge.sourceID],
            let targetFrame = frameByNodeID[edge.targetID]
          else { return nil }
          return FlowingGraphLayoutEdgeRoute(
            edgeID: edge.id,
            route: FlowingGraphEdgeRoute(
              start: sourceFrame.center,
              segments: [.line(end: targetFrame.center)]
            )
          )
        }
      )
      return try FlowingGraphRenderIndex(input: input, result: result)
    } catch {
      preconditionFailure("Metal canvas render index construction failed: \(error)")
    }
  }

  private static let palette: [SIMD4<Float>] = [
    SIMD4(0.78, 0.90, 0.91, 1),
    SIMD4(0.89, 0.85, 0.96, 1),
    SIMD4(0.96, 0.86, 0.78, 1),
    SIMD4(0.82, 0.91, 0.80, 1),
    SIMD4(0.91, 0.83, 0.87, 1),
  ]
}

extension CGRect {
  fileprivate var center: CGPoint {
    CGPoint(x: midX, y: midY)
  }

  fileprivate func intersectsIncludingBoundary(_ other: CGRect) -> Bool {
    minX <= other.maxX && maxX >= other.minX && minY <= other.maxY && maxY >= other.minY
  }
}

@MainActor
final class MetalCanvasSpikeController: ObservableObject {
  @Published private(set) var tool = MetalCanvasSpikeTool.select
  @Published private(set) var selectionCount = 0
  @Published private(set) var framesPerSecond = 0
  @Published private(set) var gpuFrameTimeMilliseconds = 0.0
  @Published private(set) var visibleNodeCount = 0
  @Published private(set) var visibleEdgeCount = 0

  private weak var canvas: MetalCanvasSpikeMTKView?

  func attach(_ canvas: MetalCanvasSpikeMTKView) {
    self.canvas = canvas
    canvas.tool = tool
  }

  func setTool(_ tool: MetalCanvasSpikeTool) {
    self.tool = tool
    canvas?.tool = tool
  }

  func fit() {
    canvas?.fitContent()
  }

  func reset() {
    canvas?.resetScene()
  }

  func updateSelectionCount(_ count: Int) {
    guard selectionCount != count else { return }
    selectionCount = count
  }

  func updateFramesPerSecond(_ value: Int) {
    guard framesPerSecond != value else { return }
    framesPerSecond = value
  }

  func updateGPUFrameTime(_ value: Double) {
    gpuFrameTimeMilliseconds = value
  }

  func updateVisibleElementCounts(nodes: Int, edges: Int) {
    guard visibleNodeCount != nodes || visibleEdgeCount != edges else { return }
    visibleNodeCount = nodes
    visibleEdgeCount = edges
  }
}

@MainActor
struct MetalCanvasSpikeView: View {
  @StateObject private var controller = MetalCanvasSpikeController()
  let configuration: MetalCanvasSpikeConfiguration

  var body: some View {
    ZStack(alignment: .topLeading) {
      MetalCanvasSpikeRepresentable(
        controller: controller,
        configuration: configuration
      )

      HStack(spacing: 10) {
        Label("\(configuration.nodeCount) GPU Nodes", systemImage: "cpu")
        Text("\(controller.framesPerSecond) FPS")
          .monospacedDigit()
        Text(String(format: "%.2f ms GPU", controller.gpuFrameTimeMilliseconds))
          .monospacedDigit()
        Text("\(controller.visibleNodeCount) Nodes · \(controller.visibleEdgeCount) Edges Visible")
          .monospacedDigit()
        if controller.selectionCount > 0 {
          Text("\(controller.selectionCount) Selected")
            .monospacedDigit()
        }
      }
      .font(.system(size: 12, weight: .medium, design: .rounded))
      .padding(.horizontal, 12)
      .padding(.vertical, 8)
      .background(.regularMaterial, in: Capsule())
      .padding(18)

      HStack(spacing: 5) {
        toolButton(.select, title: "Select", systemImage: "cursorarrow")
        toolButton(.pan, title: "Pan", systemImage: "hand.draw")

        Divider()
          .frame(height: 18)

        Button {
          controller.fit()
        } label: {
          Label("Fit", systemImage: "arrow.up.left.and.arrow.down.right")
        }
        .buttonStyle(.bordered)

        Button {
          controller.reset()
        } label: {
          Label("Reset", systemImage: "arrow.counterclockwise")
        }
        .buttonStyle(.bordered)
      }
      .controlSize(.small)
      .padding(8)
      .background(.regularMaterial, in: Capsule())
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
      .padding(20)
    }
    .background(
      MetalCanvasSpikeWindowAttachment(
        prefersBuiltInDisplay: configuration.benchmarkInteraction != .none
      )
    )
  }

  @ViewBuilder
  private func toolButton(
    _ tool: MetalCanvasSpikeTool,
    title: String,
    systemImage: String
  ) -> some View {
    if controller.tool == tool {
      Button {
        controller.setTool(tool)
      } label: {
        Label(title, systemImage: systemImage)
      }
      .buttonStyle(.borderedProminent)
    } else {
      Button {
        controller.setTool(tool)
      } label: {
        Label(title, systemImage: systemImage)
      }
      .buttonStyle(.bordered)
    }
  }
}

@MainActor
private struct MetalCanvasSpikeRepresentable: NSViewRepresentable {
  let controller: MetalCanvasSpikeController
  let configuration: MetalCanvasSpikeConfiguration

  func makeNSView(context: Context) -> MetalCanvasSpikeMTKView {
    let view = MetalCanvasSpikeMTKView(
      controller: controller,
      configuration: configuration
    )
    controller.attach(view)
    return view
  }

  func updateNSView(_ nsView: MetalCanvasSpikeMTKView, context: Context) {
    controller.attach(nsView)
  }
}

@MainActor
final class MetalCanvasSpikeMTKView: MTKView, MTKViewDelegate {
  var tool = MetalCanvasSpikeTool.select {
    didSet {
      resetCursorRects()
      window?.invalidateCursorRects(for: self)
    }
  }

  private let controller: MetalCanvasSpikeController
  private let commandQueue: any MTLCommandQueue
  private let gridPipeline: any MTLRenderPipelineState
  private let edgePipeline: any MTLRenderPipelineState
  private let nodePipeline: any MTLRenderPipelineState
  private let inFlightSemaphore = DispatchSemaphore(
    value: MetalCanvasSpikeMetrics.frameResourceCount
  )
  private let configuration: MetalCanvasSpikeConfiguration
  private var scene: MetalCanvasSpikeScene
  private var camera = MetalCanvasSpikeCamera() {
    didSet {
      guard camera != oldValue else { return }
      requestContinuousRendering()
    }
  }
  private var selectedNodeIDs = Set<Int>()
  private var hoveredNodeID: Int? {
    didSet {
      guard hoveredNodeID != oldValue else { return }
      invalidateRenderInstances()
    }
  }
  private var marqueeWorldRect: CGRect? {
    didSet {
      guard marqueeWorldRect != oldValue else { return }
      invalidateRenderInstances()
    }
  }
  private var mouseDownViewportPoint: CGPoint?
  private var mouseDownWorldPoint: CGPoint?
  private var mouseDownCameraOffset: CGSize?
  private var dragOrigins: [Int: CGPoint] = [:]
  private var startsMarquee = false
  private var addsToSelection = false
  private var hasInitializedCamera = false
  private var frameIndex = 0
  private var frameCount = 0
  private var frameCountStart = CACurrentMediaTime()
  private var continuousRenderingUntil = CACurrentMediaTime()
  private var nodeBuffers: [any MTLBuffer] = []
  private var edgeBuffers: [any MTLBuffer] = []
  private var nodeBufferGenerations = Array(
    repeating: UInt64.zero,
    count: MetalCanvasSpikeMetrics.frameResourceCount
  )
  private var edgeBufferGenerations = Array(
    repeating: UInt64.zero,
    count: MetalCanvasSpikeMetrics.frameResourceCount
  )
  private var nodeInstances: [MetalCanvasNodeInstance] = []
  private var edgeInstances: [MetalCanvasEdgeInstance] = []
  private var renderSliceCoverage: MetalCanvasSpikeRenderSliceCoverage?
  private var renderInstancesDirty = true
  private var renderGeneration: UInt64 = 0
  private var renderIndexTask: Task<Void, Never>?
  private let gpuFrameStats = MetalCanvasGPUFrameStats()
  private var trackingArea: NSTrackingArea?
  private var motionBenchmarkBaseCamera = MetalCanvasSpikeCamera()
  private let motionBenchmarkStartTime = CACurrentMediaTime()

  init(
    controller: MetalCanvasSpikeController,
    configuration: MetalCanvasSpikeConfiguration
  ) {
    guard let device = MTLCreateSystemDefaultDevice(),
      let commandQueue = device.makeCommandQueue()
    else {
      preconditionFailure("Metal is unavailable")
    }
    self.controller = controller
    self.configuration = configuration
    scene = .make(nodeCount: configuration.nodeCount)
    self.commandQueue = commandQueue

    do {
      let library = try device.makeLibrary(source: Self.shaderSource, options: nil)
      gridPipeline = try Self.makePipeline(
        device: device,
        library: library,
        vertex: "gridVertex",
        fragment: "gridFragment"
      )
      edgePipeline = try Self.makePipeline(
        device: device,
        library: library,
        vertex: "edgeVertex",
        fragment: "edgeFragment",
        blends: true
      )
      nodePipeline = try Self.makePipeline(
        device: device,
        library: library,
        vertex: "nodeVertex",
        fragment: "nodeFragment",
        blends: true
      )
    } catch {
      preconditionFailure("Metal pipeline creation failed: \(error)")
    }

    super.init(frame: .zero, device: device)
    delegate = self
    colorPixelFormat = .bgra8Unorm_srgb
    clearColor = MTLClearColor(red: 0.965, green: 0.97, blue: 0.968, alpha: 1)
    framebufferOnly = true
    preferredFramesPerSecond = 120
    isPaused = false
    enableSetNeedsDisplay = false
    addGestureRecognizer(
      NSMagnificationGestureRecognizer(
        target: self,
        action: #selector(handleMagnification(_:))
      )
    )
  }

  @available(*, unavailable)
  required init(coder: NSCoder) {
    fatalError()
  }

  deinit {
    renderIndexTask?.cancel()
  }

  override var isFlipped: Bool { true }
  override var acceptsFirstResponder: Bool { true }

  override func viewDidMoveToWindow() {
    super.viewDidMoveToWindow()
    window?.acceptsMouseMovedEvents = true
    requestContinuousRendering()
  }

  override func layout() {
    super.layout()
    guard !hasInitializedCamera, bounds.width > 0, bounds.height > 0 else { return }
    hasInitializedCamera = true
    fitContent()
  }

  override func updateTrackingAreas() {
    if let trackingArea {
      removeTrackingArea(trackingArea)
    }
    let nextTrackingArea = NSTrackingArea(
      rect: .zero,
      options: [.activeInKeyWindow, .inVisibleRect, .mouseMoved],
      owner: self
    )
    addTrackingArea(nextTrackingArea)
    trackingArea = nextTrackingArea
    super.updateTrackingAreas()
  }

  override func resetCursorRects() {
    addCursorRect(bounds, cursor: tool == .pan ? .openHand : .arrow)
  }

  override func scrollWheel(with event: NSEvent) {
    guard !event.modifierFlags.contains(.command) else {
      super.scrollWheel(with: event)
      return
    }
    let multiplier: CGFloat = event.hasPreciseScrollingDeltas ? 1 : 12
    hoveredNodeID = nil
    camera.pan(
      by: CGSize(
        width: event.scrollingDeltaX * multiplier,
        height: event.scrollingDeltaY * multiplier
      )
    )
  }

  @objc
  private func handleMagnification(_ gesture: NSMagnificationGestureRecognizer) {
    let magnification = gesture.magnification
    guard magnification != 0 else { return }
    hoveredNodeID = nil
    camera.magnify(
      by: magnification,
      at: gesture.location(in: self)
    )
    gesture.magnification = 0
  }

  override func smartMagnify(with event: NSEvent) {
    fitContent()
  }

  override func mouseDown(with event: NSEvent) {
    window?.makeFirstResponder(self)
    let viewportPoint = convert(event.locationInWindow, from: nil)
    let worldPoint = camera.worldPoint(for: viewportPoint)
    mouseDownViewportPoint = viewportPoint
    mouseDownWorldPoint = worldPoint
    addsToSelection = event.modifierFlags.contains(.command)

    if tool == .pan {
      hoveredNodeID = nil
      mouseDownCameraOffset = camera.offset
      NSCursor.closedHand.set()
      return
    }

    if let nodeID = scene.nodeID(at: worldPoint) {
      if addsToSelection {
        if selectedNodeIDs.remove(nodeID) == nil {
          selectedNodeIDs.insert(nodeID)
        }
      } else if !selectedNodeIDs.contains(nodeID) {
        selectedNodeIDs = [nodeID]
      }
      dragOrigins = Dictionary(
        uniqueKeysWithValues: selectedNodeIDs.compactMap { nodeID in
          scene.node(for: nodeID).map { (nodeID, $0.frame.origin) }
        }
      )
      startsMarquee = false
      publishSelection()
    } else {
      startsMarquee = true
      dragOrigins = [:]
      if !addsToSelection {
        selectedNodeIDs.removeAll()
        publishSelection()
      }
    }
  }

  override func mouseDragged(with event: NSEvent) {
    guard let startViewportPoint = mouseDownViewportPoint else { return }
    let viewportPoint = convert(event.locationInWindow, from: nil)

    if tool == .pan, let startOffset = mouseDownCameraOffset {
      camera.offset = CGSize(
        width: startOffset.width + viewportPoint.x - startViewportPoint.x,
        height: startOffset.height + viewportPoint.y - startViewportPoint.y
      )
      return
    }

    guard let startWorldPoint = mouseDownWorldPoint else { return }
    let worldPoint = camera.worldPoint(for: viewportPoint)
    let translation = CGSize(
      width: worldPoint.x - startWorldPoint.x,
      height: worldPoint.y - startWorldPoint.y
    )
    if startsMarquee {
      marqueeWorldRect = Self.rect(from: startWorldPoint, to: worldPoint)
    } else {
      scene.moveNodes(from: dragOrigins, by: translation)
      invalidateRenderInstances()
    }
  }

  override func mouseUp(with event: NSEvent) {
    if tool == .pan {
      NSCursor.openHand.set()
    } else if let marqueeWorldRect {
      let marqueeSelection = scene.nodeIDs(intersecting: marqueeWorldRect)
      if addsToSelection {
        selectedNodeIDs.formUnion(marqueeSelection)
      } else {
        selectedNodeIDs = marqueeSelection
      }
      publishSelection()
    }
    scheduleRenderIndexCommit()
    mouseDownViewportPoint = nil
    mouseDownWorldPoint = nil
    mouseDownCameraOffset = nil
    dragOrigins = [:]
    marqueeWorldRect = nil
    startsMarquee = false
  }

  override func mouseMoved(with event: NSEvent) {
    let viewportPoint = convert(event.locationInWindow, from: nil)
    hoveredNodeID = scene.nodeID(at: camera.worldPoint(for: viewportPoint))
  }

  override func mouseExited(with event: NSEvent) {
    hoveredNodeID = nil
  }

  override func keyDown(with event: NSEvent) {
    if event.keyCode == 53 {
      selectedNodeIDs.removeAll()
      publishSelection()
      return
    }
    if event.modifierFlags.contains(.command), event.charactersIgnoringModifiers == "a" {
      selectedNodeIDs = Set(scene.nodes.map(\.id))
      publishSelection()
      return
    }

    let step: CGFloat = event.modifierFlags.contains(.shift) ? 10 : 1
    let translation: CGSize?
    switch event.keyCode {
    case 123: translation = CGSize(width: -step, height: 0)
    case 124: translation = CGSize(width: step, height: 0)
    case 125: translation = CGSize(width: 0, height: step)
    case 126: translation = CGSize(width: 0, height: -step)
    default: translation = nil
    }
    guard let translation, !selectedNodeIDs.isEmpty else {
      super.keyDown(with: event)
      return
    }
    let origins = Dictionary(
      uniqueKeysWithValues: selectedNodeIDs.compactMap { nodeID in
        scene.node(for: nodeID).map { (nodeID, $0.frame.origin) }
      }
    )
    scene.moveNodes(from: origins, by: translation)
    scheduleRenderIndexCommit()
    invalidateRenderInstances()
  }

  func fitContent() {
    guard bounds.width > 0, bounds.height > 0 else { return }
    camera.fit(scene.contentBounds, in: bounds.size)
    motionBenchmarkBaseCamera = camera
  }

  func resetScene() {
    renderIndexTask?.cancel()
    renderIndexTask = nil
    scene = .make(nodeCount: configuration.nodeCount)
    invalidateRenderInstances()
    selectedNodeIDs.removeAll()
    hoveredNodeID = nil
    marqueeWorldRect = nil
    publishSelection()
    fitContent()
  }

  func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {
    requestContinuousRendering()
  }

  func draw(in view: MTKView) {
    guard bounds.width > 0, bounds.height > 0 else { return }

    updateMotionBenchmarkCamera()
    rebuildRenderInstancesIfNeeded()
    inFlightSemaphore.wait()
    guard let descriptor = currentRenderPassDescriptor,
      let drawable = currentDrawable,
      let commandBuffer = commandQueue.makeCommandBuffer()
    else {
      inFlightSemaphore.signal()
      return
    }
    frameIndex = (frameIndex + 1) % MetalCanvasSpikeMetrics.frameResourceCount
    let nodeBuffer = updateBuffer(
      values: nodeInstances,
      buffers: &nodeBuffers,
      bufferGenerations: &nodeBufferGenerations
    )
    let edgeBuffer = updateBuffer(
      values: edgeInstances,
      buffers: &edgeBuffers,
      bufferGenerations: &edgeBufferGenerations
    )
    guard let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: descriptor) else {
      inFlightSemaphore.signal()
      return
    }

    var uniforms = MetalCanvasUniforms(
      viewportSize: SIMD2(Float(bounds.width), Float(bounds.height)),
      cameraOffset: SIMD2(Float(camera.offset.width), Float(camera.offset.height)),
      zoom: Float(camera.zoom),
      padding: 0
    )

    encoder.setRenderPipelineState(gridPipeline)
    encoder.setFragmentBytes(
      &uniforms,
      length: MemoryLayout<MetalCanvasUniforms>.stride,
      index: 0
    )
    encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 6)

    if !edgeInstances.isEmpty {
      encoder.setRenderPipelineState(edgePipeline)
      encoder.setVertexBytes(
        &uniforms,
        length: MemoryLayout<MetalCanvasUniforms>.stride,
        index: 0
      )
      encoder.setVertexBuffer(edgeBuffer, offset: 0, index: 1)
      encoder.drawPrimitives(
        type: .triangle,
        vertexStart: 0,
        vertexCount: 6,
        instanceCount: edgeInstances.count
      )
    }

    if !nodeInstances.isEmpty {
      encoder.setRenderPipelineState(nodePipeline)
      encoder.setVertexBytes(
        &uniforms,
        length: MemoryLayout<MetalCanvasUniforms>.stride,
        index: 0
      )
      encoder.setVertexBuffer(nodeBuffer, offset: 0, index: 1)
      encoder.drawPrimitives(
        type: .triangle,
        vertexStart: 0,
        vertexCount: 6,
        instanceCount: nodeInstances.count
      )
    }

    encoder.endEncoding()
    let gpuFrameStats = gpuFrameStats
    let inFlightSemaphore = inFlightSemaphore
    commandBuffer.addCompletedHandler { commandBuffer in
      let duration = commandBuffer.gpuEndTime - commandBuffer.gpuStartTime
      if duration > 0 {
        gpuFrameStats.record(duration: duration)
      }
      inFlightSemaphore.signal()
    }
    commandBuffer.present(drawable)
    commandBuffer.commit()
    recordFrame()
    pauseRenderingWhenIdle()
  }

  private func rebuildRenderInstancesIfNeeded() {
    let levelOfDetail = MetalCanvasSpikeNodeLevelOfDetail.resolve(
      nodeHeight: MetalCanvasSpikeMetrics.nodeSize.height,
      zoom: camera.zoom
    )
    let viewportWorldRect = camera.visibleWorldRect(viewportSize: bounds.size)
    if !renderInstancesDirty,
      renderSliceCoverage?.covers(
        viewportWorldRect: viewportWorldRect,
        levelOfDetail: levelOfDetail
      ) == true
    {
      return
    }

    let visibleWorldRect = camera.visibleWorldRect(
      viewportSize: bounds.size,
      overscan: MetalCanvasSpikeMetrics.renderOverscan
    )
    let visibleElements = scene.renderElementIDs(intersecting: visibleWorldRect)

    nodeInstances.removeAll(keepingCapacity: true)
    nodeInstances.reserveCapacity(visibleElements.nodeIDs.count + (marqueeWorldRect == nil ? 0 : 1))
    for nodeID in visibleElements.nodeIDs {
      guard let node = scene.node(for: nodeID) else { continue }
      nodeInstances.append(
        MetalCanvasNodeInstance(
          origin: SIMD2(Float(node.frame.minX), Float(node.frame.minY)),
          size: SIMD2(Float(node.frame.width), Float(node.frame.height)),
          fillColor: node.color,
          borderColor: SIMD4(0.22, 0.28, 0.29, 0.22),
          selected: selectedNodeIDs.contains(node.id) ? 1 : 0,
          hovered: hoveredNodeID == node.id ? 1 : 0,
          levelOfDetail: levelOfDetail.rawValue,
          padding: 0
        )
      )
    }
    if let marqueeWorldRect {
      nodeInstances.append(
        MetalCanvasNodeInstance(
          origin: SIMD2(Float(marqueeWorldRect.minX), Float(marqueeWorldRect.minY)),
          size: SIMD2(Float(marqueeWorldRect.width), Float(marqueeWorldRect.height)),
          fillColor: SIMD4(0.22, 0.55, 0.72, 0.10),
          borderColor: SIMD4(0.22, 0.55, 0.72, 0.90),
          selected: 1,
          hovered: 0,
          levelOfDetail: MetalCanvasSpikeNodeLevelOfDetail.full.rawValue,
          padding: 0
        )
      )
    }

    edgeInstances.removeAll(keepingCapacity: true)
    edgeInstances.reserveCapacity(visibleElements.edgeIDs.count)
    for edgeID in visibleElements.edgeIDs {
      guard let endpoints = scene.edgeEndpoints(for: edgeID) else { continue }
      edgeInstances.append(
        MetalCanvasEdgeInstance(
          start: SIMD2(Float(endpoints.start.x), Float(endpoints.start.y)),
          end: SIMD2(Float(endpoints.end.x), Float(endpoints.end.y)),
          color: SIMD4(0.35, 0.41, 0.42, 0.35),
          width: 1.25,
          padding: .zero
        )
      )
    }

    controller.updateVisibleElementCounts(
      nodes: nodeInstances.count - (marqueeWorldRect == nil ? 0 : 1),
      edges: edgeInstances.count
    )
    let retainedMargin =
      MetalCanvasSpikeMetrics.renderOverscan / camera.zoom
      * MetalCanvasSpikeMetrics.renderCoverageRetentionRatio
    renderSliceCoverage = MetalCanvasSpikeRenderSliceCoverage(
      retainedWorldRect: visibleWorldRect.insetBy(
        dx: retainedMargin,
        dy: retainedMargin
      ),
      levelOfDetail: levelOfDetail
    )
    renderInstancesDirty = false
    renderGeneration &+= 1
    if renderGeneration == 0 {
      renderGeneration = 1
      nodeBufferGenerations = Array(
        repeating: 0,
        count: MetalCanvasSpikeMetrics.frameResourceCount
      )
      edgeBufferGenerations = Array(
        repeating: 0,
        count: MetalCanvasSpikeMetrics.frameResourceCount
      )
    }
  }

  private func updateBuffer<T>(
    values: [T],
    buffers: inout [any MTLBuffer],
    bufferGenerations: inout [UInt64]
  ) -> any MTLBuffer {
    let (valueBytes, overflow) = values.count.multipliedReportingOverflow(
      by: MemoryLayout<T>.stride
    )
    precondition(!overflow, "Metal buffer size overflow")
    let requiredLength = max(valueBytes, 1)
    if buffers.count != MetalCanvasSpikeMetrics.frameResourceCount
      || buffers.contains(where: { $0.length < requiredLength })
    {
      guard let device else { preconditionFailure("Metal device is unavailable") }
      let bufferLength = Self.bufferLength(for: requiredLength)
      buffers = (0..<MetalCanvasSpikeMetrics.frameResourceCount).map { _ in
        guard
          let buffer = device.makeBuffer(
            length: bufferLength,
            options: .storageModeShared
          )
        else {
          preconditionFailure("Metal buffer allocation failed")
        }
        return buffer
      }
      bufferGenerations = Array(
        repeating: 0,
        count: MetalCanvasSpikeMetrics.frameResourceCount
      )
    }
    let buffer = buffers[frameIndex]
    if bufferGenerations[frameIndex] != renderGeneration, !values.isEmpty {
      values.withUnsafeBytes { bytes in
        buffer.contents().copyMemory(from: bytes.baseAddress!, byteCount: bytes.count)
      }
    }
    bufferGenerations[frameIndex] = renderGeneration
    return buffer
  }

  private static func bufferLength(for requiredLength: Int) -> Int {
    var length = MetalCanvasSpikeMetrics.minimumBufferLength
    while length < requiredLength {
      let (next, overflow) = length.multipliedReportingOverflow(by: 2)
      if overflow { return requiredLength }
      length = next
    }
    return length
  }

  private func publishSelection() {
    controller.updateSelectionCount(selectedNodeIDs.count)
    invalidateRenderInstances()
  }

  private func invalidateRenderInstances() {
    renderInstancesDirty = true
    requestContinuousRendering()
  }

  private func scheduleRenderIndexCommit() {
    guard scene.hasPendingIndexChanges else { return }
    let snapshot = scene.renderIndexSnapshot()
    renderIndexTask?.cancel()
    renderIndexTask = Task { [weak self] in
      do {
        try await Task.sleep(
          nanoseconds: MetalCanvasSpikeMetrics.renderIndexCommitDelayNanoseconds
        )
      } catch {
        return
      }
      let buildTask = Task.detached(priority: .utility) {
        snapshot.build()
      }
      let update = await withTaskCancellationHandler {
        await buildTask.value
      } onCancel: {
        buildTask.cancel()
      }
      guard !Task.isCancelled, let self else { return }
      if self.scene.install(update) {
        self.renderIndexTask = nil
      }
    }
  }

  private func requestContinuousRendering() {
    continuousRenderingUntil = max(
      continuousRenderingUntil,
      CACurrentMediaTime() + MetalCanvasSpikeMetrics.interactionRenderTail
    )
    if isPaused {
      isPaused = false
    }
  }

  private func pauseRenderingWhenIdle() {
    guard configuration.benchmarkInteraction == .none,
      CACurrentMediaTime() >= continuousRenderingUntil
    else { return }
    isPaused = true
  }

  private func updateMotionBenchmarkCamera() {
    guard configuration.benchmarkInteraction != .none else { return }
    let elapsed = CACurrentMediaTime() - motionBenchmarkStartTime
    if configuration.benchmarkInteraction == .zoom {
      let viewportAnchor = CGPoint(x: bounds.midX, y: bounds.midY)
      let worldAnchor = motionBenchmarkBaseCamera.worldPoint(for: viewportAnchor)
      let zoomFactor = 1.625 + sin(elapsed * 1.2) * 0.625
      let zoom = min(motionBenchmarkBaseCamera.zoom * zoomFactor, 3)
      camera = MetalCanvasSpikeCamera(
        zoom: zoom,
        offset: CGSize(
          width: viewportAnchor.x - worldAnchor.x * zoom,
          height: viewportAnchor.y - worldAnchor.y * zoom
        )
      )
      return
    }
    camera = MetalCanvasSpikeCamera(
      zoom: motionBenchmarkBaseCamera.zoom,
      offset: CGSize(
        width: motionBenchmarkBaseCamera.offset.width + sin(elapsed * 1.7) * 72,
        height: motionBenchmarkBaseCamera.offset.height + cos(elapsed * 1.3) * 48
      )
    )
  }

  private func recordFrame() {
    frameCount += 1
    let now = CACurrentMediaTime()
    let elapsed = now - frameCountStart
    guard elapsed >= 1 else { return }
    controller.updateFramesPerSecond(Int((Double(frameCount) / elapsed).rounded()))
    controller.updateGPUFrameTime(gpuFrameStats.meanMillisecondsAndReset())
    frameCount = 0
    frameCountStart = now
  }

  private static func rect(from start: CGPoint, to end: CGPoint) -> CGRect {
    CGRect(
      x: min(start.x, end.x),
      y: min(start.y, end.y),
      width: abs(end.x - start.x),
      height: abs(end.y - start.y)
    )
  }

  private static func makePipeline(
    device: any MTLDevice,
    library: any MTLLibrary,
    vertex: String,
    fragment: String,
    blends: Bool = false
  ) throws -> any MTLRenderPipelineState {
    let descriptor = MTLRenderPipelineDescriptor()
    descriptor.vertexFunction = library.makeFunction(name: vertex)
    descriptor.fragmentFunction = library.makeFunction(name: fragment)
    descriptor.colorAttachments[0].pixelFormat = .bgra8Unorm_srgb
    if blends {
      let attachment = descriptor.colorAttachments[0]!
      attachment.isBlendingEnabled = true
      attachment.sourceRGBBlendFactor = .sourceAlpha
      attachment.destinationRGBBlendFactor = .oneMinusSourceAlpha
      attachment.sourceAlphaBlendFactor = .one
      attachment.destinationAlphaBlendFactor = .oneMinusSourceAlpha
    }
    return try device.makeRenderPipelineState(descriptor: descriptor)
  }

  private static let shaderSource = """
    #include <metal_stdlib>
    using namespace metal;

    struct Uniforms {
      float2 viewportSize;
      float2 cameraOffset;
      float zoom;
      float padding;
    };

    struct NodeInstance {
      float2 origin;
      float2 size;
      float4 fillColor;
      float4 borderColor;
      uint selected;
      uint hovered;
      uint levelOfDetail;
      uint padding;
    };

    struct EdgeInstance {
      float2 start;
      float2 end;
      float4 color;
      float width;
      float3 padding;
    };

    struct GridOutput {
      float4 position [[position]];
      float2 viewportPoint;
    };

    struct NodeOutput {
      float4 position [[position]];
      float2 uv;
      float2 pixelSize;
      float4 fillColor [[flat]];
      float4 borderColor [[flat]];
      uint selected [[flat]];
      uint hovered [[flat]];
      uint levelOfDetail [[flat]];
    };

    struct EdgeOutput {
      float4 position [[position]];
      float4 color [[flat]];
    };

    constant float2 quadVertices[6] = {
      float2(0, 0), float2(1, 0), float2(0, 1),
      float2(0, 1), float2(1, 0), float2(1, 1)
    };

    vertex GridOutput gridVertex(
      uint vertexID [[vertex_id]]
    ) {
      float2 uv = quadVertices[vertexID];
      GridOutput output;
      output.position = float4(uv.x * 2 - 1, 1 - uv.y * 2, 0, 1);
      output.viewportPoint = uv;
      return output;
    }

    fragment float4 gridFragment(
      GridOutput input [[stage_in]],
      constant Uniforms &uniforms [[buffer(0)]]
    ) {
      float2 viewportPoint = input.viewportPoint * uniforms.viewportSize;
      float2 worldPoint = (viewportPoint - uniforms.cameraOffset) / uniforms.zoom;
      float baseVisualSpacing = max(24.0 * uniforms.zoom, 0.001);
      float levelScale = exp2(ceil(log2(12.0 / baseVisualSpacing)));
      float spacing = 24.0 * levelScale;
      float2 cell = (fract(worldPoint / spacing + 0.5) - 0.5) * spacing * uniforms.zoom;
      float fine = 1.0 - smoothstep(0.65, 1.55, length(cell));
      float2 coarseCell =
        (fract(worldPoint / (spacing * 2.0) + 0.5) - 0.5) * spacing * 2.0 * uniforms.zoom;
      float coarse = 1.0 - smoothstep(0.8, 1.8, length(coarseCell));
      float strength = max(fine * 0.16, coarse * 0.26);
      float3 background = float3(0.965, 0.970, 0.968);
      float3 dots = float3(0.37, 0.43, 0.42);
      return float4(mix(background, dots, strength), 1);
    }

    vertex EdgeOutput edgeVertex(
      uint vertexID [[vertex_id]],
      uint instanceID [[instance_id]],
      constant Uniforms &uniforms [[buffer(0)]],
      constant EdgeInstance *instances [[buffer(1)]]
    ) {
      EdgeInstance instance = instances[instanceID];
      float2 start = instance.start * uniforms.zoom + uniforms.cameraOffset;
      float2 end = instance.end * uniforms.zoom + uniforms.cameraOffset;
      float2 delta = end - start;
      float2 direction = delta / max(length(delta), 0.001);
      float2 normal = float2(-direction.y, direction.x) * instance.width * 0.5;
      float2 corner = quadVertices[vertexID];
      float2 viewportPoint = mix(start, end, corner.x) + normal * (corner.y * 2 - 1);
      EdgeOutput output;
      output.position = float4(
        viewportPoint.x / uniforms.viewportSize.x * 2 - 1,
        1 - viewportPoint.y / uniforms.viewportSize.y * 2,
        0,
        1
      );
      output.color = instance.color;
      return output;
    }

    fragment float4 edgeFragment(EdgeOutput input [[stage_in]]) {
      return input.color;
    }

    vertex NodeOutput nodeVertex(
      uint vertexID [[vertex_id]],
      uint instanceID [[instance_id]],
      constant Uniforms &uniforms [[buffer(0)]],
      constant NodeInstance *instances [[buffer(1)]]
    ) {
      NodeInstance instance = instances[instanceID];
      float2 uv = quadVertices[vertexID];
      float2 worldPoint = instance.origin + uv * instance.size;
      float2 viewportPoint = worldPoint * uniforms.zoom + uniforms.cameraOffset;
      NodeOutput output;
      output.position = float4(
        viewportPoint.x / uniforms.viewportSize.x * 2 - 1,
        1 - viewportPoint.y / uniforms.viewportSize.y * 2,
        0,
        1
      );
      output.uv = uv;
      output.pixelSize = max(instance.size * uniforms.zoom, float2(1));
      output.fillColor = instance.fillColor;
      output.borderColor = instance.borderColor;
      output.selected = instance.selected;
      output.hovered = instance.hovered;
      output.levelOfDetail = instance.levelOfDetail;
      return output;
    }

    fragment float4 nodeFragment(NodeOutput input [[stage_in]]) {
      float maximumRadius = input.levelOfDetail == 0
        ? 4.0
        : (input.levelOfDetail == 1 ? 6.0 : 12.0);
      float radius = min(maximumRadius, min(input.pixelSize.x, input.pixelSize.y) * 0.22);
      float2 point = (input.uv - 0.5) * input.pixelSize;
      float2 bounds = input.pixelSize * 0.5 - radius;
      float2 delta = abs(point) - bounds;
      float distance = length(max(delta, 0.0)) + min(max(delta.x, delta.y), 0.0) - radius;
      float alpha = 1.0 - smoothstep(-0.5, 0.8, distance);
      if (input.levelOfDetail == 0 && input.selected == 0 && input.hovered == 0) {
        float4 color = input.fillColor;
        color.a *= alpha;
        return color;
      }
      float defaultBorderWidth = input.levelOfDetail == 1 ? 0.75 : 1.0;
      float borderWidth = input.selected != 0
        ? 2.4
        : (input.hovered != 0 ? 1.8 : defaultBorderWidth);
      float border = smoothstep(-borderWidth - 0.8, -borderWidth + 0.4, distance);
      float4 borderColor = input.selected != 0
        ? float4(0.16, 0.48, 0.64, 1)
        : (input.hovered != 0 ? float4(0.23, 0.36, 0.38, 0.72) : input.borderColor);
      float4 color = mix(input.fillColor, borderColor, border);
      color.a *= alpha;
      return color;
    }
    """
}

private struct MetalCanvasUniforms {
  var viewportSize: SIMD2<Float>
  var cameraOffset: SIMD2<Float>
  var zoom: Float
  var padding: Float
}

private struct MetalCanvasNodeInstance {
  var origin: SIMD2<Float>
  var size: SIMD2<Float>
  var fillColor: SIMD4<Float>
  var borderColor: SIMD4<Float>
  var selected: UInt32
  var hovered: UInt32
  var levelOfDetail: UInt32
  var padding: UInt32
}

private struct MetalCanvasEdgeInstance {
  var start: SIMD2<Float>
  var end: SIMD2<Float>
  var color: SIMD4<Float>
  var width: Float
  var padding: SIMD3<Float>
}

private final class MetalCanvasGPUFrameStats: @unchecked Sendable {
  private let lock = NSLock()
  private var durationTotal = 0.0
  private var sampleCount = 0

  func record(duration: TimeInterval) {
    lock.lock()
    durationTotal += duration
    sampleCount += 1
    lock.unlock()
  }

  func meanMillisecondsAndReset() -> Double {
    lock.lock()
    defer { lock.unlock() }
    let mean = sampleCount > 0 ? durationTotal / Double(sampleCount) * 1_000 : 0
    durationTotal = 0
    sampleCount = 0
    return mean
  }
}

private struct MetalCanvasSpikeWindowAttachment: NSViewRepresentable {
  let prefersBuiltInDisplay: Bool

  func makeNSView(context: Context) -> NSView {
    WindowView(prefersBuiltInDisplay: prefersBuiltInDisplay)
  }

  func updateNSView(_ nsView: NSView, context: Context) {}

  private final class WindowView: NSView {
    private let prefersBuiltInDisplay: Bool

    init(prefersBuiltInDisplay: Bool) {
      self.prefersBuiltInDisplay = prefersBuiltInDisplay
      super.init(frame: .zero)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
      fatalError()
    }

    override func viewDidMoveToWindow() {
      super.viewDidMoveToWindow()
      guard let window,
        let screen = prefersBuiltInDisplay
          ? Self.builtInScreen ?? NSScreen.main
          : window.screen ?? NSScreen.main
      else { return }
      window.title = "Metal Canvas Spike"
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

    private static var builtInScreen: NSScreen? {
      NSScreen.screens.first { screen in
        guard let screenNumber = screen.deviceDescription[.init("NSScreenNumber")] as? NSNumber
        else { return false }
        return CGDisplayIsBuiltin(screenNumber.uint32Value) != 0
      }
    }
  }
}
