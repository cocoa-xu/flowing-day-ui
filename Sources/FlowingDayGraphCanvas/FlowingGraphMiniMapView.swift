import FlowingDayCanvas
import SwiftUI

public struct FlowingGraphMiniMapNodeStyle {
  public let fill: Color
  public let stroke: Color?
  public let strokeWidth: CGFloat

  public init(
    fill: Color,
    stroke: Color? = nil,
    strokeWidth: CGFloat = 1
  ) {
    precondition(strokeWidth >= 0 && strokeWidth.isFinite)
    self.fill = fill
    self.stroke = stroke
    self.strokeWidth = strokeWidth
  }
}

public struct FlowingGraphMiniMapStyle {
  public let background: Color
  public let border: Color
  public let edge: Color
  public let viewportFill: Color
  public let viewportStroke: Color
  public let nodeStyles: [FlowingGraphMiniMapNodeStyle]
  public let cornerRadius: CGFloat
  public let viewportCornerRadius: CGFloat
  public let viewportStrokeWidth: CGFloat

  public init(
    background: Color = Color(nsColor: .windowBackgroundColor).opacity(0.96),
    border: Color = .secondary.opacity(0.18),
    edge: Color = .secondary.opacity(0.24),
    viewportFill: Color = .accentColor.opacity(0.1),
    viewportStroke: Color = .accentColor.opacity(0.88),
    nodeStyles: [FlowingGraphMiniMapNodeStyle] = [
      FlowingGraphMiniMapNodeStyle(fill: .secondary.opacity(0.52))
    ],
    cornerRadius: CGFloat = 12,
    viewportCornerRadius: CGFloat = 3,
    viewportStrokeWidth: CGFloat = 1.5
  ) {
    precondition(!nodeStyles.isEmpty)
    precondition(cornerRadius >= 0 && cornerRadius.isFinite)
    precondition(viewportCornerRadius >= 0 && viewportCornerRadius.isFinite)
    precondition(viewportStrokeWidth > 0 && viewportStrokeWidth.isFinite)
    self.background = background
    self.border = border
    self.edge = edge
    self.viewportFill = viewportFill
    self.viewportStroke = viewportStroke
    self.nodeStyles = nodeStyles
    self.cornerRadius = cornerRadius
    self.viewportCornerRadius = viewportCornerRadius
    self.viewportStrokeWidth = viewportStrokeWidth
  }
}

public struct FlowingGraphMiniMapRenderingContext<
  NodeID: Hashable & Sendable,
  EdgeID: Hashable & Sendable
>: Sendable {
  public let snapshot: FlowingGraphMiniMapSnapshot<NodeID, EdgeID>
  public let transform: FlowingGraphMiniMapTransform
  public let viewport: FlowingCanvasViewport
  public let viewportFrame: CGRect
  public let configuration: FlowingGraphMiniMapConfiguration

  public init(
    snapshot: FlowingGraphMiniMapSnapshot<NodeID, EdgeID>,
    transform: FlowingGraphMiniMapTransform,
    viewport: FlowingCanvasViewport,
    viewportFrame: CGRect,
    configuration: FlowingGraphMiniMapConfiguration
  ) {
    self.snapshot = snapshot
    self.transform = transform
    self.viewport = viewport
    self.viewportFrame = viewportFrame
    self.configuration = configuration
  }
}

public struct FlowingGraphMiniMap<
  NodeID: Hashable & Sendable,
  EdgeID: Hashable & Sendable,
  Content: View,
  Decorations: View
>: View {
  private struct PointerState {
    let transform: FlowingGraphMiniMapTransform
    let centerOffset: CGSize
  }

  private let snapshot: FlowingGraphMiniMapSnapshot<NodeID, EdgeID>
  private let viewportDriver: FlowingGraphMiniMapViewportDriver
  private let configuration: FlowingGraphMiniMapConfiguration
  private let style: FlowingGraphMiniMapStyle
  private let content: (FlowingGraphMiniMapRenderingContext<NodeID, EdgeID>) -> Content
  private let decorations: (FlowingGraphMiniMapRenderingContext<NodeID, EdgeID>) -> Decorations

  @State private var pointerState: PointerState?
  @State private var pinnedWorldBounds: CGRect?
  @State private var navigatorWorldBounds: CGRect?
  @State private var trackpadCenter: CGPoint?
  @State private var trackpadZoom: CGFloat?

  public init(
    snapshot: FlowingGraphMiniMapSnapshot<NodeID, EdgeID>,
    viewportDriver: FlowingGraphMiniMapViewportDriver,
    configuration: FlowingGraphMiniMapConfiguration = .init(),
    style: FlowingGraphMiniMapStyle = .init(),
    @ViewBuilder content:
      @escaping (FlowingGraphMiniMapRenderingContext<NodeID, EdgeID>) -> Content,
    @ViewBuilder decorations:
      @escaping (FlowingGraphMiniMapRenderingContext<NodeID, EdgeID>) -> Decorations
  ) {
    self.snapshot = snapshot
    self.viewportDriver = viewportDriver
    self.configuration = configuration
    self.style = style
    self.content = content
    self.decorations = decorations
  }

  public var body: some View {
    GeometryReader { geometry in
      let bounds = resolvedWorldBounds()
      let transform = FlowingGraphMiniMapTransform(
        worldBounds: bounds,
        viewSize: geometry.size,
        padding: configuration.contentPadding
      )
      let context = renderingContext(transform: transform)

      if isVisible {
        ZStack(alignment: .topLeading) {
          RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous)
            .fill(style.background)
          content(context)
          decorations(context)
          viewportIndicator(context.viewportFrame)
          if configuration.interaction != .displayOnly {
            interactionLayer(context)
          }
          RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous)
            .strokeBorder(style.border, lineWidth: 1)
            .allowsHitTesting(false)
        }
        .clipShape(RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(configuration.accessibilityLabel)
        .accessibilityValue(accessibilityValue)
        .accessibilityAdjustableAction { direction in
          guard configuration.interaction == .panAndZoom else { return }
          let factor: CGFloat =
            direction == .increment
            ? FlowingGraphMiniMapMetrics.accessibilityZoomFactor
            : 1 / FlowingGraphMiniMapMetrics.accessibilityZoomFactor
          viewportDriver.setZoom(viewportDriver.zoom * factor)
        }
      }
    }
    .frame(width: configuration.size.width, height: configuration.size.height)
    .onAppear {
      refreshNavigatorBounds(force: true)
    }
    .onChange(of: viewportDriver.viewport.visibleWorldRect) { _ in
      refreshNavigatorBounds(force: false)
    }
    .onChange(of: configuration.scope) { _ in
      refreshNavigatorBounds(force: true)
    }
  }

  private var isVisible: Bool {
    pointerState != nil || pinnedWorldBounds != nil
      || configuration.visibility.isVisible(
        contentBounds: snapshot.contentBounds,
        visibleWorldRect: viewportDriver.viewport.visibleWorldRect
      )
  }

  private var accessibilityValue: String {
    let percentage = Int((viewportDriver.zoom * 100).rounded())
    return "Zoom \(percentage) percent"
  }

  private func resolvedWorldBounds() -> CGRect {
    if let pinnedWorldBounds {
      return pinnedWorldBounds
    }
    if case .localNavigator = configuration.scope, let navigatorWorldBounds {
      return navigatorWorldBounds
    }
    return requestedWorldBounds()
  }

  private func requestedWorldBounds() -> CGRect {
    configuration.scope.bounds(
      contentBounds: snapshot.contentBounds,
      visibleWorldRect: viewportDriver.viewport.visibleWorldRect
    )
  }

  private func refreshNavigatorBounds(force: Bool) {
    guard case .localNavigator = configuration.scope,
      pinnedWorldBounds == nil
    else {
      if force {
        navigatorWorldBounds = nil
      }
      return
    }
    let requested = requestedWorldBounds()
    guard !force, let current = navigatorWorldBounds else {
      navigatorWorldBounds = requested
      return
    }
    let retained = current.insetBy(
      dx: current.width * FlowingGraphMiniMapMetrics.localNavigatorMarginRatio,
      dy: current.height * FlowingGraphMiniMapMetrics.localNavigatorMarginRatio
    )
    if !retained.contains(viewportDriver.viewport.visibleWorldRect) {
      navigatorWorldBounds = requested
    }
  }

  private func renderingContext(
    transform: FlowingGraphMiniMapTransform
  ) -> FlowingGraphMiniMapRenderingContext<NodeID, EdgeID> {
    FlowingGraphMiniMapRenderingContext(
      snapshot: snapshot,
      transform: transform,
      viewport: viewportDriver.viewport,
      viewportFrame: transform.viewRect(for: viewportDriver.viewport.visibleWorldRect),
      configuration: configuration
    )
  }

  private func viewportIndicator(_ frame: CGRect) -> some View {
    RoundedRectangle(cornerRadius: style.viewportCornerRadius, style: .continuous)
      .fill(style.viewportFill)
      .overlay {
        RoundedRectangle(cornerRadius: style.viewportCornerRadius, style: .continuous)
          .strokeBorder(style.viewportStroke, lineWidth: style.viewportStrokeWidth)
      }
      .frame(width: max(frame.width, 1), height: max(frame.height, 1))
      .position(x: frame.midX, y: frame.midY)
      .allowsHitTesting(false)
  }

  private func interactionLayer(
    _ context: FlowingGraphMiniMapRenderingContext<NodeID, EdgeID>
  ) -> some View {
    FlowingGraphMiniMapInteractionView(
      discreteScrollMultiplier: configuration.discreteScrollMultiplier,
      onPointerBegan: { beginPointer(at: $0, context: context) },
      onPointerChanged: { movePointer(to: $0, phase: .continuous) },
      onPointerEnded: { location in
        movePointer(to: location, phase: .ended)
        pointerState = nil
        pinnedWorldBounds = nil
        refreshNavigatorBounds(force: false)
      },
      onPan: { panByTrackpad($0, phase: $1, context: context) },
      onMagnify: { magnify($0, phase: $1, context: context) }
    )
  }

  private func beginPointer(
    at location: CGPoint,
    context: FlowingGraphMiniMapRenderingContext<NodeID, EdgeID>
  ) {
    let worldPoint = context.transform.worldPoint(for: location)
    let visibleCenter = CGPoint(
      x: viewportDriver.viewport.visibleWorldRect.midX,
      y: viewportDriver.viewport.visibleWorldRect.midY
    )
    let offset: CGSize
    if context.viewportFrame.contains(location) {
      offset = CGSize(
        width: visibleCenter.x - worldPoint.x,
        height: visibleCenter.y - worldPoint.y
      )
    } else {
      offset = .zero
    }
    pinnedWorldBounds = context.transform.worldBounds
    pointerState = PointerState(transform: context.transform, centerOffset: offset)
    movePointer(to: location, phase: .continuous)
  }

  private func movePointer(
    to location: CGPoint,
    phase: FlowingCanvasViewportChangePhase
  ) {
    guard let pointerState else { return }
    viewportDriver.center(
      on: FlowingGraphMiniMapNavigation.center(
        pointerLocation: location,
        transform: pointerState.transform,
        centerOffset: pointerState.centerOffset
      ),
      phase: phase
    )
  }

  private func panByTrackpad(
    _ delta: CGSize,
    phase: FlowingCanvasViewportChangePhase,
    context: FlowingGraphMiniMapRenderingContext<NodeID, EdgeID>
  ) {
    if pinnedWorldBounds == nil {
      pinnedWorldBounds = context.transform.worldBounds
    }
    let transform = FlowingGraphMiniMapTransform(
      worldBounds: pinnedWorldBounds ?? context.transform.worldBounds,
      viewSize: context.transform.viewSize,
      padding: context.transform.padding
    )
    let currentCenter =
      trackpadCenter
      ?? CGPoint(
        x: viewportDriver.viewport.visibleWorldRect.midX,
        y: viewportDriver.viewport.visibleWorldRect.midY
      )
    let nextCenter = FlowingGraphMiniMapNavigation.pannedCenter(
      currentCenter: currentCenter,
      viewDelta: delta,
      transform: transform
    )
    trackpadCenter = nextCenter
    viewportDriver.center(on: nextCenter, phase: phase)
    if phase == .ended {
      trackpadCenter = nil
      pinnedWorldBounds = nil
      refreshNavigatorBounds(force: false)
    }
  }

  private func magnify(
    _ magnification: CGFloat,
    phase: FlowingCanvasViewportChangePhase,
    context: FlowingGraphMiniMapRenderingContext<NodeID, EdgeID>
  ) {
    guard configuration.interaction == .panAndZoom else { return }
    if pinnedWorldBounds == nil {
      pinnedWorldBounds = context.transform.worldBounds
    }
    let factor = max(
      1 + magnification * configuration.zoomSensitivity,
      FlowingGraphMiniMapMetrics.minimumMagnificationFactor
    )
    let nextZoom = (trackpadZoom ?? viewportDriver.zoom) * factor
    trackpadZoom = nextZoom
    viewportDriver.setZoom(nextZoom, phase: phase)
    if phase == .ended {
      trackpadZoom = nil
      pinnedWorldBounds = nil
      refreshNavigatorBounds(force: false)
    }
  }
}

extension FlowingGraphMiniMap
where
  Content == FlowingGraphMiniMapDefaultContent<NodeID, EdgeID>
{
  public init(
    snapshot: FlowingGraphMiniMapSnapshot<NodeID, EdgeID>,
    viewportDriver: FlowingGraphMiniMapViewportDriver,
    configuration: FlowingGraphMiniMapConfiguration = .init(),
    style: FlowingGraphMiniMapStyle = .init(),
    styleRevision: UInt64 = 0,
    nodeStyleIndex:
      @escaping @Sendable (FlowingGraphMiniMapNode<NodeID>) -> Int = { _ in 0 },
    @ViewBuilder decorations:
      @escaping (FlowingGraphMiniMapRenderingContext<NodeID, EdgeID>) -> Decorations
  ) {
    self.init(
      snapshot: snapshot,
      viewportDriver: viewportDriver,
      configuration: configuration,
      style: style,
      content: {
        FlowingGraphMiniMapDefaultContent(
          context: $0,
          style: style,
          styleRevision: styleRevision,
          nodeStyleIndex: nodeStyleIndex
        )
      },
      decorations: decorations
    )
  }

  public init(
    snapshot: FlowingGraphMiniMapSnapshot<NodeID, EdgeID>,
    proxy: FlowingCanvasProxy,
    configuration: FlowingGraphMiniMapConfiguration = .init(),
    style: FlowingGraphMiniMapStyle = .init(),
    styleRevision: UInt64 = 0,
    nodeStyleIndex:
      @escaping @Sendable (FlowingGraphMiniMapNode<NodeID>) -> Int = { _ in 0 },
    @ViewBuilder decorations:
      @escaping (FlowingGraphMiniMapRenderingContext<NodeID, EdgeID>) -> Decorations
  ) {
    self.init(
      snapshot: snapshot,
      viewportDriver: FlowingGraphMiniMapViewportDriver(proxy: proxy),
      configuration: configuration,
      style: style,
      styleRevision: styleRevision,
      nodeStyleIndex: nodeStyleIndex,
      decorations: decorations
    )
  }
}

extension FlowingGraphMiniMap
where
  Content == FlowingGraphMiniMapDefaultContent<NodeID, EdgeID>,
  Decorations == EmptyView
{
  public init(
    snapshot: FlowingGraphMiniMapSnapshot<NodeID, EdgeID>,
    viewportDriver: FlowingGraphMiniMapViewportDriver,
    configuration: FlowingGraphMiniMapConfiguration = .init(),
    style: FlowingGraphMiniMapStyle = .init(),
    styleRevision: UInt64 = 0,
    nodeStyleIndex:
      @escaping @Sendable (FlowingGraphMiniMapNode<NodeID>) -> Int = { _ in 0 }
  ) {
    self.init(
      snapshot: snapshot,
      viewportDriver: viewportDriver,
      configuration: configuration,
      style: style,
      styleRevision: styleRevision,
      nodeStyleIndex: nodeStyleIndex,
      decorations: { _ in EmptyView() }
    )
  }

  public init(
    snapshot: FlowingGraphMiniMapSnapshot<NodeID, EdgeID>,
    proxy: FlowingCanvasProxy,
    configuration: FlowingGraphMiniMapConfiguration = .init(),
    style: FlowingGraphMiniMapStyle = .init(),
    styleRevision: UInt64 = 0,
    nodeStyleIndex:
      @escaping @Sendable (FlowingGraphMiniMapNode<NodeID>) -> Int = { _ in 0 }
  ) {
    self.init(
      snapshot: snapshot,
      viewportDriver: FlowingGraphMiniMapViewportDriver(proxy: proxy),
      configuration: configuration,
      style: style,
      styleRevision: styleRevision,
      nodeStyleIndex: nodeStyleIndex
    )
  }
}

public struct FlowingGraphMiniMapDefaultContent<
  NodeID: Hashable & Sendable,
  EdgeID: Hashable & Sendable
>: View {
  private struct PlanID: Hashable {
    let snapshotID: FlowingGraphMiniMapSnapshotID
    let transform: FlowingGraphMiniMapTransform
    let representation: FlowingGraphMiniMapRepresentation
    let performance: FlowingGraphMiniMapPerformanceConfiguration
    let refreshPolicy: FlowingGraphMiniMapRefreshPolicy
    let styleRevision: UInt64
  }

  private let context: FlowingGraphMiniMapRenderingContext<NodeID, EdgeID>
  private let style: FlowingGraphMiniMapStyle
  private let styleRevision: UInt64
  private let nodeStyleIndex: @Sendable (FlowingGraphMiniMapNode<NodeID>) -> Int

  @State private var plan: FlowingGraphMiniMapRenderPlan?

  public init(
    context: FlowingGraphMiniMapRenderingContext<NodeID, EdgeID>,
    style: FlowingGraphMiniMapStyle = .init(),
    styleRevision: UInt64 = 0,
    nodeStyleIndex:
      @escaping @Sendable (FlowingGraphMiniMapNode<NodeID>) -> Int = { _ in 0 }
  ) {
    self.context = context
    self.style = style
    self.styleRevision = styleRevision
    self.nodeStyleIndex = nodeStyleIndex
  }

  public var body: some View {
    Canvas(opaque: false, rendersAsynchronously: true) { graphics, _ in
      guard let plan else { return }
      draw(
        plan,
        projection: FlowingGraphMiniMapPlanProjection(
          source: plan.transform,
          target: context.transform
        ),
        in: &graphics
      )
    }
    .task(id: planID) {
      if context.configuration.refreshPolicy == .afterChangesSettle {
        do {
          try await Task.sleep(
            nanoseconds: FlowingGraphMiniMapMetrics.settledRefreshDelayNanoseconds
          )
        } catch {
          return
        }
      }
      let snapshot = context.snapshot
      let transform = planningTransform
      let representation = context.configuration.representation
      let performance = context.configuration.performance
      let styleIndex = nodeStyleIndex
      let availableNodeStyleCount = style.nodeStyles.count
      let task = Task.detached(priority: .userInitiated) {
        try FlowingGraphMiniMapPlanner.plan(
          snapshot: snapshot,
          transform: transform,
          representation: representation,
          performance: performance,
          availableNodeStyleCount: availableNodeStyleCount,
          nodeStyleIndex: styleIndex
        )
      }
      do {
        let nextPlan = try await withTaskCancellationHandler {
          try await task.value
        } onCancel: {
          task.cancel()
        }
        guard !Task.isCancelled else { return }
        plan = nextPlan
      } catch {
        return
      }
    }
    .allowsHitTesting(false)
  }

  private var planID: PlanID {
    PlanID(
      snapshotID: context.snapshot.id,
      transform: planningTransform,
      representation: context.configuration.representation,
      performance: context.configuration.performance,
      refreshPolicy: context.configuration.refreshPolicy,
      styleRevision: styleRevision
    )
  }

  private var planningTransform: FlowingGraphMiniMapTransform {
    FlowingGraphMiniMapPlanning.transform(
      snapshotBounds: context.snapshot.contentBounds,
      displayTransform: context.transform,
      scope: context.configuration.scope
    )
  }

  private func draw(
    _ plan: FlowingGraphMiniMapRenderPlan,
    projection: FlowingGraphMiniMapPlanProjection,
    in graphics: inout GraphicsContext
  ) {
    if !plan.edgeSegments.isEmpty {
      var edgePath = Path()
      for edge in plan.edgeSegments {
        edgePath.move(to: projection.point(edge.start))
        edgePath.addLine(to: projection.point(edge.end))
      }
      graphics.stroke(edgePath, with: .color(style.edge), lineWidth: 1)
    }
    for batch in plan.nodeBatches {
      let nodeStyle =
        style.nodeStyles.indices.contains(batch.styleIndex)
        ? style.nodeStyles[batch.styleIndex]
        : style.nodeStyles[0]
      var path = Path()
      for rect in batch.rects {
        path.addRect(projection.rect(rect))
      }
      graphics.fill(path, with: .color(nodeStyle.fill))
      if batch.drawsStroke, let stroke = nodeStyle.stroke,
        nodeStyle.strokeWidth > 0
      {
        graphics.stroke(path, with: .color(stroke), lineWidth: nodeStyle.strokeWidth)
      }
    }
  }
}

public struct FlowingGraphMiniMapOverlay<Content: View>: View {
  private let placement: FlowingGraphMiniMapPlacement
  private let insets: EdgeInsets
  private let content: Content

  public init(
    placement: FlowingGraphMiniMapPlacement = .bottomTrailing,
    insets: EdgeInsets = EdgeInsets(top: 16, leading: 16, bottom: 16, trailing: 16),
    @ViewBuilder content: () -> Content
  ) {
    self.placement = placement
    self.insets = insets
    self.content = content()
  }

  public var body: some View {
    FlowingCanvasViewportOverlay(alignment: placement.alignment, insets: insets) {
      content
    }
  }
}

extension FlowingGraphMiniMapPlacement {
  fileprivate var alignment: Alignment {
    switch self {
    case .topLeading:
      return .topLeading
    case .topTrailing:
      return .topTrailing
    case .bottomLeading:
      return .bottomLeading
    case .bottomTrailing:
      return .bottomTrailing
    }
  }
}

private enum FlowingGraphMiniMapMetrics {
  static let localNavigatorMarginRatio: CGFloat = 0.2
  static let settledRefreshDelayNanoseconds: UInt64 = 120_000_000
  static let accessibilityZoomFactor: CGFloat = 1.15
  static let minimumMagnificationFactor: CGFloat = 0.01
}
