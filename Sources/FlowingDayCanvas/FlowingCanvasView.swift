import Foundation
import SwiftUI

public struct FlowingCanvasRenderContext: Equatable, Sendable {
  public let viewport: FlowingCanvasViewport
  public let renderWorldRect: CGRect

  public init(viewport: FlowingCanvasViewport, renderWorldRect: CGRect) {
    self.viewport = viewport
    self.renderWorldRect = renderWorldRect
  }

  public var transform: FlowingCanvasTransform {
    viewport.transform
  }

  public var zoom: CGFloat {
    transform.zoom
  }

  public var visibleWorldRect: CGRect {
    viewport.visibleWorldRect
  }

  public func worldPoint(for viewportPoint: CGPoint) -> CGPoint {
    transform.removing(from: viewportPoint)
  }

  public func viewportPoint(for worldPoint: CGPoint) -> CGPoint {
    transform.applying(to: worldPoint)
  }

  public func renderSurface() -> FlowingCanvasRenderSurface {
    FlowingCanvasRenderSurface(
      worldRect: renderWorldRect,
      viewportTransform: transform
    )
  }
}

public struct FlowingCanvasProxy {
  public let context: FlowingCanvasRenderContext
  private let setZoomAction: (CGFloat, Bool) -> Void
  private let focusAction: (CGRect, CGFloat?, Bool) -> Void
  private let fitAction: (CGRect, CGFloat, CGFloat?, Bool) -> Void

  init(
    context: FlowingCanvasRenderContext,
    setZoom: @escaping (CGFloat, Bool) -> Void,
    focus: @escaping (CGRect, CGFloat?, Bool) -> Void,
    fit: @escaping (CGRect, CGFloat, CGFloat?, Bool) -> Void
  ) {
    self.context = context
    setZoomAction = setZoom
    focusAction = focus
    fitAction = fit
  }

  public var viewport: FlowingCanvasViewport {
    context.viewport
  }

  public var zoom: CGFloat {
    context.zoom
  }

  public func setZoom(_ zoom: CGFloat, animated: Bool = false) {
    setZoomAction(zoom, animated)
  }

  public func focus(
    _ rect: CGRect,
    zoom: CGFloat? = nil,
    animated: Bool = true
  ) {
    focusAction(rect, zoom, animated)
  }

  public func fit(
    _ rect: CGRect,
    padding: CGFloat,
    maximumZoom: CGFloat? = nil,
    animated: Bool = true
  ) {
    fitAction(rect, padding, maximumZoom, animated)
  }

  public func worldPoint(for viewportPoint: CGPoint) -> CGPoint {
    context.worldPoint(for: viewportPoint)
  }

  public func viewportPoint(for worldPoint: CGPoint) -> CGPoint {
    context.viewportPoint(for: worldPoint)
  }
}

public struct FlowingCanvasViewportOverlay<Content: View>: View {
  private let alignment: Alignment
  private let insets: EdgeInsets
  private let content: Content

  public init(
    alignment: Alignment,
    insets: EdgeInsets = EdgeInsets(),
    @ViewBuilder content: () -> Content
  ) {
    self.alignment = alignment
    self.insets = insets
    self.content = content()
  }

  public var body: some View {
    content
      .padding(insets)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: alignment)
  }
}

public struct FlowingCanvasWorldLayer<Content: View>: View {
  public let surface: FlowingCanvasRenderSurface
  private let content: Content

  public init(
    context: FlowingCanvasRenderContext,
    @ViewBuilder content: (FlowingCanvasRenderSurface) -> Content
  ) {
    surface = context.renderSurface()
    self.content = content(surface)
  }

  public var body: some View {
    content
      .frame(
        width: surface.displayedSize.width,
        height: surface.displayedSize.height,
        alignment: .topLeading
      )
      .offset(
        x: surface.viewportOffset.width,
        y: surface.viewportOffset.height
      )
  }
}

public struct FlowingCanvas<
  ContentID: Hashable,
  Background: View,
  World: View,
  Overlays: View
>: View {
  @Binding private var viewport: FlowingCanvasViewport
  private let configuration: FlowingCanvasConfiguration
  private let contentRect: CGRect
  private let contentID: ContentID
  private let contentInsets: EdgeInsets
  private let contentChangeBehavior: FlowingCanvasContentChangeBehavior
  private let interactionMode: FlowingCanvasInteractionMode
  private let request: FlowingCanvasRequest?
  private let onContentDragChanged: (FlowingCanvasDragContext) -> Void
  private let onContentDragEnded: (FlowingCanvasDragContext) -> Void
  private let onSmartMagnify:
    (FlowingCanvasSmartMagnifyContext) ->
      FlowingCanvasViewportAction
  private let onRenderWorldRectChange: (CGRect) -> Void
  private let onViewportChange:
    (
      FlowingCanvasViewport,
      FlowingCanvasViewportChangePhase
    ) -> Void
  private let background: (FlowingCanvasRenderContext) -> Background
  private let world: (FlowingCanvasRenderContext) -> World
  private let overlays: (FlowingCanvasProxy) -> Overlays

  @State private var dragOrigin: CGSize?
  @State private var renderCoverage = FlowingCanvasRenderCoverage()
  @State private var restoreTransform: FlowingCanvasTransform?
  @State private var handledRequestID: UUID?
  @State private var handledRequestContentID: ContentID?
  @State private var isInitialized = false

  public init(
    viewport: Binding<FlowingCanvasViewport>,
    configuration: FlowingCanvasConfiguration = FlowingCanvasConfiguration(),
    contentRect: CGRect,
    contentID: ContentID,
    contentInsets: EdgeInsets = EdgeInsets(),
    contentChangeBehavior: FlowingCanvasContentChangeBehavior = .preserveViewport,
    interactionMode: FlowingCanvasInteractionMode = .pan,
    request: FlowingCanvasRequest? = nil,
    onContentDragChanged: @escaping (FlowingCanvasDragContext) -> Void = { _ in },
    onContentDragEnded: @escaping (FlowingCanvasDragContext) -> Void = { _ in },
    onSmartMagnify:
      @escaping (FlowingCanvasSmartMagnifyContext) ->
      FlowingCanvasViewportAction = { _ in .none },
    onRenderWorldRectChange: @escaping (CGRect) -> Void = { _ in },
    onViewportChange:
      @escaping (
        FlowingCanvasViewport,
        FlowingCanvasViewportChangePhase
      ) -> Void = { _, _ in },
    @ViewBuilder background: @escaping (FlowingCanvasRenderContext) -> Background,
    @ViewBuilder world: @escaping (FlowingCanvasRenderContext) -> World,
    @ViewBuilder overlays: @escaping (FlowingCanvasProxy) -> Overlays
  ) {
    _viewport = viewport
    self.configuration = configuration
    self.contentRect = contentRect
    self.contentID = contentID
    self.contentInsets = contentInsets
    self.contentChangeBehavior = contentChangeBehavior
    self.interactionMode = interactionMode
    self.request = request
    self.onContentDragChanged = onContentDragChanged
    self.onContentDragEnded = onContentDragEnded
    self.onSmartMagnify = onSmartMagnify
    self.onRenderWorldRectChange = onRenderWorldRectChange
    self.onViewportChange = onViewportChange
    self.background = background
    self.world = world
    self.overlays = overlays
  }

  public var body: some View {
    GeometryReader { geometry in
      let displayedViewport = viewportWithGeometry(geometry.size)
      let context = FlowingCanvasRenderContext(
        viewport: displayedViewport,
        renderWorldRect: renderCoverage.worldRect
      )
      let proxy = makeProxy(context: context)

      ZStack(alignment: .topLeading) {
        background(context)
        world(context)
        overlays(proxy)
      }
      .background {
        FlowingCanvasTrackpadGestureView(
          discreteScrollMultiplier: configuration.discreteScrollMultiplier,
          onPan: { delta, location in
            panTrackpad(by: delta, at: location, viewportSize: geometry.size)
          },
          onMagnify: { magnification, location in
            magnifyTrackpad(
              by: magnification,
              at: location,
              viewportSize: geometry.size
            )
          },
          onMagnifyEnded: {
            finishViewportChange()
          },
          onSmartMagnify: { location in
            smartMagnify(at: location, viewportSize: geometry.size)
          }
        )
        .allowsHitTesting(false)
      }
      .contentShape(Rectangle())
      .gesture(dragGesture(viewportSize: geometry.size))
      .onAppear {
        initializeViewport(size: geometry.size)
      }
      .onChange(of: geometry.size) { newSize in
        updateGeometry(size: newSize, preservingCenter: true)
      }
      .onChange(of: contentInsets) { _ in
        updateGeometry(size: geometry.size, preservingCenter: true)
      }
      .onChange(of: contentID) { _ in
        handleContentChange(viewportSize: geometry.size)
      }
      .onChange(of: request) { newRequest in
        guard let newRequest else {
          handledRequestID = nil
          handledRequestContentID = nil
          return
        }
        performRequest(newRequest, viewportSize: geometry.size)
      }
      .onChange(of: viewport.transform) { _ in
        refreshRenderWorldRect(
          for: viewportWithGeometry(geometry.size),
          force: false
        )
      }
      .onChange(of: interactionMode) { _ in
        dragOrigin = nil
      }
      .frame(
        width: geometry.size.width,
        height: geometry.size.height,
        alignment: .topLeading
      )
    }
  }

  private func makeProxy(context: FlowingCanvasRenderContext) -> FlowingCanvasProxy {
    FlowingCanvasProxy(
      context: context,
      setZoom: { zoom, animated in
        setZoom(zoom, animated: animated, viewportSize: context.viewport.size)
      },
      focus: { rect, zoom, animated in
        restoreTransform = nil
        perform(
          .focus(rect: rect, zoom: zoom),
          animated: animated,
          animationDuration: nil,
          savesRestoreTransform: false,
          viewportSize: context.viewport.size
        )
      },
      fit: { rect, padding, maximumZoom, animated in
        restoreTransform = nil
        perform(
          .fit(rect: rect, padding: padding, maximumZoom: maximumZoom),
          animated: animated,
          animationDuration: nil,
          savesRestoreTransform: false,
          viewportSize: context.viewport.size
        )
      }
    )
  }

  private func initializeViewport(size: CGSize) {
    guard !isInitialized else {
      updateGeometry(size: size, preservingCenter: true)
      return
    }
    isInitialized = true
    var initialViewport = viewport
    initialViewport.update(size: size, contentBounds: contentBounds(viewportSize: size))
    viewport = initialViewport
    if let request {
      performRequest(request, animated: false, viewportSize: size)
    } else {
      let transform = FlowingCanvasTransform.focusing(
        contentRect: contentRect,
        in: viewport.contentBounds,
        zoom: configuration.clampedZoom(configuration.initialZoom)
      )
      updateViewport(
        transform: transform,
        phase: .ended,
        animated: false,
        forceRenderRefresh: true
      )
    }
  }

  private func handleContentChange(viewportSize: CGSize) {
    restoreTransform = nil
    if let request {
      performRequest(request, animated: false, viewportSize: viewportSize)
      return
    }
    switch contentChangeBehavior {
    case .preserveViewport:
      refreshRenderWorldRect(for: viewport, force: true)
    case .center:
      perform(
        .focus(rect: contentRect, zoom: configuration.initialZoom),
        animated: false,
        animationDuration: nil,
        savesRestoreTransform: false,
        viewportSize: viewportSize
      )
    case .fit(let padding, let maximumZoom):
      perform(
        .fit(
          rect: contentRect,
          padding: padding,
          maximumZoom: maximumZoom
        ),
        animated: false,
        animationDuration: nil,
        savesRestoreTransform: false,
        viewportSize: viewportSize
      )
    }
  }

  private func performRequest(
    _ request: FlowingCanvasRequest,
    animated: Bool? = nil,
    viewportSize: CGSize
  ) {
    guard handledRequestID != request.id || handledRequestContentID != contentID else {
      return
    }
    handledRequestID = request.id
    handledRequestContentID = contentID
    restoreTransform = nil
    perform(
      request.action,
      animated: animated ?? request.animated,
      animationDuration: request.animationDuration,
      savesRestoreTransform: false,
      viewportSize: viewportSize
    )
  }

  private func perform(
    _ action: FlowingCanvasViewportAction,
    animated: Bool,
    animationDuration: TimeInterval?,
    savesRestoreTransform: Bool,
    viewportSize: CGSize
  ) {
    guard viewportSize.width > 0, viewportSize.height > 0 else { return }
    if savesRestoreTransform, action != .none, action != .restore {
      restoreTransform = viewport.transform
    }

    let transform: FlowingCanvasTransform
    switch action {
    case .none:
      return
    case .restore:
      guard let savedTransform = restoreTransform else { return }
      restoreTransform = nil
      transform = savedTransform
    case .anchor(let worldPoint, let viewportPoint, let zoom):
      transform = FlowingCanvasTransform.anchoring(
        worldPoint: worldPoint,
        at: viewportPoint,
        zoom: configuration.clampedZoom(zoom)
      )
    case .focus(let rect, let requestedZoom):
      transform = FlowingCanvasTransform.focusing(
        contentRect: rect,
        in: contentBounds(viewportSize: viewportSize),
        zoom: configuration.clampedZoom(requestedZoom ?? configuration.focusedZoom)
      )
    case .fit(let rect, let padding, let maximumZoom):
      let maximum = min(
        maximumZoom ?? configuration.zoomRange.upperBound,
        configuration.zoomRange.upperBound
      )
      transform = FlowingCanvasTransform.fitting(
        contentRect: rect,
        in: contentBounds(viewportSize: viewportSize),
        padding: padding,
        zoomRange: configuration.zoomRange
          .lowerBound...max(
            maximum,
            configuration.zoomRange.lowerBound
          )
      )
    }
    updateViewport(
      transform: transform,
      phase: .ended,
      animated: animated,
      animationDuration: animationDuration,
      forceRenderRefresh: true
    )
  }

  private func dragGesture(viewportSize: CGSize) -> some Gesture {
    DragGesture(minimumDistance: configuration.dragMinimumDistance)
      .onChanged { value in
        guard contentBounds(viewportSize: viewportSize).contains(value.startLocation) else {
          return
        }
        switch interactionMode {
        case .pan:
          panCanvas(by: value.translation)
        case .content:
          onContentDragChanged(dragContext(value))
        }
      }
      .onEnded { value in
        switch interactionMode {
        case .content
        where contentBounds(viewportSize: viewportSize).contains(
          value.startLocation
        ):
          onContentDragEnded(dragContext(value))
        case .pan where dragOrigin != nil:
          finishViewportChange()
        default:
          break
        }
        dragOrigin = nil
      }
  }

  private func dragContext(_ value: DragGesture.Value) -> FlowingCanvasDragContext {
    FlowingCanvasDragContext(
      startLocation: value.startLocation,
      location: value.location,
      translation: value.translation,
      worldStartLocation: viewport.transform.removing(from: value.startLocation),
      worldLocation: viewport.transform.removing(from: value.location)
    )
  }

  private func panCanvas(by translation: CGSize) {
    if dragOrigin == nil {
      dragOrigin = viewport.transform.offset
      restoreTransform = nil
    }
    guard let dragOrigin else { return }
    updateViewport(
      transform: FlowingCanvasTransform(
        zoom: viewport.transform.zoom,
        offset: CGSize(
          width: dragOrigin.width + translation.width,
          height: dragOrigin.height + translation.height
        )
      ),
      phase: .continuous,
      animated: false
    )
  }

  private func panTrackpad(
    by delta: CGSize,
    at location: CGPoint,
    viewportSize: CGSize
  ) -> Bool {
    guard contentBounds(viewportSize: viewportSize).contains(location) else {
      return false
    }
    restoreTransform = nil
    updateViewport(
      transform: FlowingCanvasTransform(
        zoom: viewport.transform.zoom,
        offset: CGSize(
          width: viewport.transform.offset.width + delta.width,
          height: viewport.transform.offset.height + delta.height
        )
      ),
      phase: .continuous,
      animated: false
    )
    return true
  }

  private func magnifyTrackpad(
    by magnification: CGFloat,
    at location: CGPoint,
    viewportSize: CGSize
  ) -> Bool {
    guard contentBounds(viewportSize: viewportSize).contains(location) else {
      return false
    }
    restoreTransform = nil
    let nextZoom = configuration.clampedZoom(
      viewport.transform.zoom + magnification * configuration.pinchSensitivity
    )
    let worldAnchor = viewport.transform.removing(from: location)
    updateViewport(
      transform: .anchoring(
        worldPoint: worldAnchor,
        at: location,
        zoom: nextZoom
      ),
      phase: .continuous,
      animated: false
    )
    return true
  }

  private func smartMagnify(at location: CGPoint, viewportSize: CGSize) -> Bool {
    guard contentBounds(viewportSize: viewportSize).contains(location) else {
      return false
    }
    let context = FlowingCanvasSmartMagnifyContext(
      location: location,
      worldLocation: viewport.transform.removing(from: location),
      viewport: viewport,
      initialZoom: configuration.clampedZoom(configuration.initialZoom),
      zoomTolerance: configuration.smartMagnifyZoomTolerance,
      canRestoreViewport: restoreTransform != nil
    )
    let action = onSmartMagnify(context)
    guard action != .none else { return false }
    perform(
      action,
      animated: true,
      animationDuration: nil,
      savesRestoreTransform: true,
      viewportSize: viewportSize
    )
    return true
  }

  private func setZoom(_ zoom: CGFloat, animated: Bool, viewportSize: CGSize) {
    guard viewportSize.width > 0, viewportSize.height > 0 else { return }
    restoreTransform = nil
    let nextZoom = configuration.clampedZoom(zoom)
    let bounds = contentBounds(viewportSize: viewportSize)
    let center = CGPoint(x: bounds.midX, y: bounds.midY)
    let worldCenter = viewport.transform.removing(from: center)
    updateViewport(
      transform: .anchoring(
        worldPoint: worldCenter,
        at: center,
        zoom: nextZoom
      ),
      phase: .ended,
      animated: animated
    )
  }

  private func updateGeometry(size: CGSize, preservingCenter: Bool) {
    let nextBounds = contentBounds(viewportSize: size)
    var nextViewport = viewport
    if preservingCenter,
      !viewport.contentBounds.isEmpty,
      !nextBounds.isEmpty
    {
      let oldCenter = CGPoint(
        x: viewport.contentBounds.midX,
        y: viewport.contentBounds.midY
      )
      let worldCenter = viewport.transform.removing(from: oldCenter)
      let nextCenter = CGPoint(x: nextBounds.midX, y: nextBounds.midY)
      nextViewport.transform = .anchoring(
        worldPoint: worldCenter,
        at: nextCenter,
        zoom: viewport.transform.zoom
      )
    }
    nextViewport.update(size: size, contentBounds: nextBounds)
    viewport = nextViewport
    refreshRenderWorldRect(for: nextViewport, force: true)
  }

  private func updateViewport(
    transform: FlowingCanvasTransform,
    phase: FlowingCanvasViewportChangePhase,
    animated: Bool,
    animationDuration: TimeInterval? = nil,
    forceRenderRefresh: Bool = false
  ) {
    var nextViewport = viewport
    nextViewport.transform = transform
    if animated {
      withAnimation(
        .easeInOut(
          duration: animationDuration ?? configuration.viewportAnimationDuration
        )
      ) {
        viewport = nextViewport
      }
    } else {
      viewport = nextViewport
    }
    refreshRenderWorldRect(for: nextViewport, force: forceRenderRefresh)
    onViewportChange(nextViewport, phase)
  }

  private func finishViewportChange() {
    onViewportChange(viewport, .ended)
  }

  private func refreshRenderWorldRect(
    for viewport: FlowingCanvasViewport,
    force: Bool
  ) {
    guard
      let nextRect = renderCoverage.update(
        for: viewport,
        overscan: configuration.renderOverscan,
        retentionRatio: configuration.renderRetentionRatio,
        force: force
      )
    else { return }
    onRenderWorldRectChange(nextRect)
  }

  private func viewportWithGeometry(_ size: CGSize) -> FlowingCanvasViewport {
    var result = viewport
    result.update(size: size, contentBounds: contentBounds(viewportSize: size))
    return result
  }

  private func contentBounds(viewportSize: CGSize) -> CGRect {
    CGRect(
      x: contentInsets.leading,
      y: contentInsets.top,
      width: max(viewportSize.width - contentInsets.leading - contentInsets.trailing, 0),
      height: max(viewportSize.height - contentInsets.top - contentInsets.bottom, 0)
    )
  }
}
