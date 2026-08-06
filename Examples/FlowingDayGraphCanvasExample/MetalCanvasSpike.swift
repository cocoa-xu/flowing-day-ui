import AppKit
import MetalKit
import SwiftUI

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

struct MetalCanvasSpikeNode: Equatable {
  let id: Int
  var frame: CGRect
  let color: SIMD4<Float>
}

struct MetalCanvasSpikeEdge: Equatable {
  let sourceID: Int
  let targetID: Int
}

struct MetalCanvasSpikeScene {
  var nodes: [MetalCanvasSpikeNode]
  let edges: [MetalCanvasSpikeEdge]

  var contentBounds: CGRect {
    nodes.dropFirst().reduce(nodes.first?.frame ?? .zero) { $0.union($1.frame) }
  }

  func nodeID(at point: CGPoint) -> Int? {
    nodes.last(where: { $0.frame.contains(point) })?.id
  }

  func nodeIDs(intersecting rect: CGRect) -> Set<Int> {
    Set(nodes.lazy.filter { $0.frame.intersects(rect) }.map(\.id))
  }

  mutating func moveNodes(
    from origins: [Int: CGPoint],
    by translation: CGSize
  ) {
    for index in nodes.indices {
      guard let origin = origins[nodes[index].id] else { continue }
      nodes[index].frame.origin = CGPoint(
        x: origin.x + translation.width,
        y: origin.y + translation.height
      )
    }
  }

  static func make(nodeCount: Int) -> MetalCanvasSpikeScene {
    let columnCount = max(Int(ceil(sqrt(Double(nodeCount)))), 1)
    let nodeSize = CGSize(width: 126, height: 66)
    let cellSize = CGSize(width: 164, height: 106)
    let nodes = (0..<nodeCount).map { id in
      MetalCanvasSpikeNode(
        id: id,
        frame: CGRect(
          x: CGFloat(id % columnCount) * cellSize.width,
          y: CGFloat(id / columnCount) * cellSize.height,
          width: nodeSize.width,
          height: nodeSize.height
        ),
        color: Self.palette[id % Self.palette.count]
      )
    }
    let edges = (1..<nodeCount).map { id in
      MetalCanvasSpikeEdge(sourceID: (id - 1) / 3, targetID: id)
    }
    return MetalCanvasSpikeScene(nodes: nodes, edges: edges)
  }

  private static let palette: [SIMD4<Float>] = [
    SIMD4(0.78, 0.90, 0.91, 1),
    SIMD4(0.89, 0.85, 0.96, 1),
    SIMD4(0.96, 0.86, 0.78, 1),
    SIMD4(0.82, 0.91, 0.80, 1),
    SIMD4(0.91, 0.83, 0.87, 1),
  ]
}

@MainActor
final class MetalCanvasSpikeController: ObservableObject {
  @Published private(set) var tool = MetalCanvasSpikeTool.select
  @Published private(set) var selectionCount = 0
  @Published private(set) var framesPerSecond = 0
  @Published private(set) var gpuFrameTimeMilliseconds = 0.0

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
}

@MainActor
struct MetalCanvasSpikeView: View {
  @StateObject private var controller = MetalCanvasSpikeController()

  var body: some View {
    ZStack(alignment: .topLeading) {
      MetalCanvasSpikeRepresentable(controller: controller)

      HStack(spacing: 10) {
        Label("500 GPU Nodes", systemImage: "cpu")
        Text("\(controller.framesPerSecond) FPS")
          .monospacedDigit()
        Text(String(format: "%.2f ms GPU", controller.gpuFrameTimeMilliseconds))
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
    .background(MetalCanvasSpikeWindowAttachment())
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

  func makeNSView(context: Context) -> MetalCanvasSpikeMTKView {
    let view = MetalCanvasSpikeMTKView(controller: controller)
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
  private let nodeBuffers: [any MTLBuffer]
  private let edgeBuffers: [any MTLBuffer]
  private var scene = MetalCanvasSpikeScene.make(nodeCount: 500)
  private var camera = MetalCanvasSpikeCamera()
  private var selectedNodeIDs = Set<Int>()
  private var hoveredNodeID: Int?
  private var marqueeWorldRect: CGRect?
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
  private let gpuFrameStats = MetalCanvasGPUFrameStats()
  private var trackingArea: NSTrackingArea?

  init(controller: MetalCanvasSpikeController) {
    guard let device = MTLCreateSystemDefaultDevice(),
      let commandQueue = device.makeCommandQueue()
    else {
      preconditionFailure("Metal is unavailable")
    }
    self.controller = controller
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

    let nodeBufferLength = MemoryLayout<MetalCanvasNodeInstance>.stride * 501
    let edgeBufferLength = MemoryLayout<MetalCanvasEdgeInstance>.stride * 499
    nodeBuffers = (0..<3).map { _ in
      device.makeBuffer(length: nodeBufferLength, options: .storageModeShared)!
    }
    edgeBuffers = (0..<3).map { _ in
      device.makeBuffer(length: edgeBufferLength, options: .storageModeShared)!
    }

    super.init(frame: .zero, device: device)
    delegate = self
    colorPixelFormat = .bgra8Unorm_srgb
    clearColor = MTLClearColor(red: 0.965, green: 0.97, blue: 0.968, alpha: 1)
    framebufferOnly = true
    preferredFramesPerSecond = 120
    isPaused = false
    enableSetNeedsDisplay = false
  }

  @available(*, unavailable)
  required init(coder: NSCoder) {
    fatalError()
  }

  override var isFlipped: Bool { true }
  override var acceptsFirstResponder: Bool { true }

  override func viewDidMoveToWindow() {
    super.viewDidMoveToWindow()
    window?.acceptsMouseMovedEvents = true
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
    camera.pan(
      by: CGSize(
        width: event.scrollingDeltaX * multiplier,
        height: event.scrollingDeltaY * multiplier
      )
    )
  }

  override func magnify(with event: NSEvent) {
    camera.magnify(
      by: event.magnification,
      at: convert(event.locationInWindow, from: nil)
    )
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
        uniqueKeysWithValues: scene.nodes.lazy
          .filter { self.selectedNodeIDs.contains($0.id) }
          .map { ($0.id, $0.frame.origin) }
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
      uniqueKeysWithValues: scene.nodes.lazy
        .filter { self.selectedNodeIDs.contains($0.id) }
        .map { ($0.id, $0.frame.origin) }
    )
    scene.moveNodes(from: origins, by: translation)
  }

  func fitContent() {
    guard bounds.width > 0, bounds.height > 0 else { return }
    camera.fit(scene.contentBounds, in: bounds.size)
  }

  func resetScene() {
    scene = .make(nodeCount: 500)
    selectedNodeIDs.removeAll()
    hoveredNodeID = nil
    marqueeWorldRect = nil
    publishSelection()
    fitContent()
  }

  func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

  func draw(in view: MTKView) {
    guard bounds.width > 0, bounds.height > 0,
      let descriptor = currentRenderPassDescriptor,
      let drawable = currentDrawable,
      let commandBuffer = commandQueue.makeCommandBuffer(),
      let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: descriptor)
    else { return }

    frameIndex = (frameIndex + 1) % nodeBuffers.count
    let nodeInstances = makeNodeInstances()
    let edgeInstances = makeEdgeInstances()
    copy(nodeInstances, to: nodeBuffers[frameIndex])
    copy(edgeInstances, to: edgeBuffers[frameIndex])

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
      encoder.setVertexBuffer(edgeBuffers[frameIndex], offset: 0, index: 1)
      encoder.drawPrimitives(
        type: .triangle,
        vertexStart: 0,
        vertexCount: 6,
        instanceCount: edgeInstances.count
      )
    }

    encoder.setRenderPipelineState(nodePipeline)
    encoder.setVertexBytes(
      &uniforms,
      length: MemoryLayout<MetalCanvasUniforms>.stride,
      index: 0
    )
    encoder.setVertexBuffer(nodeBuffers[frameIndex], offset: 0, index: 1)
    encoder.drawPrimitives(
      type: .triangle,
      vertexStart: 0,
      vertexCount: 6,
      instanceCount: nodeInstances.count
    )

    encoder.endEncoding()
    let gpuFrameStats = gpuFrameStats
    commandBuffer.addCompletedHandler { commandBuffer in
      let duration = commandBuffer.gpuEndTime - commandBuffer.gpuStartTime
      if duration > 0 {
        gpuFrameStats.record(duration: duration)
      }
    }
    commandBuffer.present(drawable)
    commandBuffer.commit()
    recordFrame()
  }

  private func makeNodeInstances() -> [MetalCanvasNodeInstance] {
    var instances = scene.nodes.map { node in
      MetalCanvasNodeInstance(
        origin: SIMD2(Float(node.frame.minX), Float(node.frame.minY)),
        size: SIMD2(Float(node.frame.width), Float(node.frame.height)),
        fillColor: node.color,
        borderColor: SIMD4(0.22, 0.28, 0.29, 0.22),
        selected: selectedNodeIDs.contains(node.id) ? 1 : 0,
        hovered: hoveredNodeID == node.id ? 1 : 0,
        padding: .zero
      )
    }
    if let marqueeWorldRect {
      instances.append(
        MetalCanvasNodeInstance(
          origin: SIMD2(Float(marqueeWorldRect.minX), Float(marqueeWorldRect.minY)),
          size: SIMD2(Float(marqueeWorldRect.width), Float(marqueeWorldRect.height)),
          fillColor: SIMD4(0.22, 0.55, 0.72, 0.10),
          borderColor: SIMD4(0.22, 0.55, 0.72, 0.90),
          selected: 1,
          hovered: 0,
          padding: .zero
        )
      )
    }
    return instances
  }

  private func makeEdgeInstances() -> [MetalCanvasEdgeInstance] {
    let centers = Dictionary(
      uniqueKeysWithValues: scene.nodes.map {
        ($0.id, SIMD2(Float($0.frame.midX), Float($0.frame.midY)))
      }
    )
    return scene.edges.compactMap { edge in
      guard let start = centers[edge.sourceID], let end = centers[edge.targetID] else {
        return nil
      }
      return MetalCanvasEdgeInstance(
        start: start,
        end: end,
        color: SIMD4(0.35, 0.41, 0.42, 0.35),
        width: 1.25,
        padding: .zero
      )
    }
  }

  private func copy<T>(_ values: [T], to buffer: any MTLBuffer) {
    guard !values.isEmpty else { return }
    values.withUnsafeBytes { bytes in
      buffer.contents().copyMemory(from: bytes.baseAddress!, byteCount: bytes.count)
    }
  }

  private func publishSelection() {
    controller.updateSelectionCount(selectedNodeIDs.count)
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
      uint2 padding;
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
      return output;
    }

    fragment float4 nodeFragment(NodeOutput input [[stage_in]]) {
      float radius = min(12.0, min(input.pixelSize.x, input.pixelSize.y) * 0.22);
      float2 point = (input.uv - 0.5) * input.pixelSize;
      float2 bounds = input.pixelSize * 0.5 - radius;
      float2 delta = abs(point) - bounds;
      float distance = length(max(delta, 0.0)) + min(max(delta.x, delta.y), 0.0) - radius;
      float alpha = 1.0 - smoothstep(-0.5, 0.8, distance);
      float borderWidth = input.selected != 0 ? 2.4 : (input.hovered != 0 ? 1.8 : 1.0);
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
  var padding: SIMD2<UInt32>
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
  func makeNSView(context: Context) -> NSView {
    WindowView()
  }

  func updateNSView(_ nsView: NSView, context: Context) {}

  private final class WindowView: NSView {
    override func viewDidMoveToWindow() {
      super.viewDidMoveToWindow()
      guard let window, let screen = NSScreen.screens.first else { return }
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
  }
}
