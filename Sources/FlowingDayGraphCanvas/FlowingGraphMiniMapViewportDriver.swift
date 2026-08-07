import CoreGraphics
import FlowingDayCanvas

@MainActor
public struct FlowingGraphMiniMapViewportDriver {
  public let viewport: FlowingCanvasViewport

  private let centerAction: (CGPoint, FlowingCanvasViewportChangePhase) -> Void
  private let setZoomAction: (CGFloat, FlowingCanvasViewportChangePhase) -> Void

  public init(
    viewport: FlowingCanvasViewport,
    center: @escaping (CGPoint, FlowingCanvasViewportChangePhase) -> Void,
    setZoom: @escaping (CGFloat, FlowingCanvasViewportChangePhase) -> Void
  ) {
    self.viewport = viewport
    centerAction = center
    setZoomAction = setZoom
  }

  public init(proxy: FlowingCanvasProxy) {
    self.init(
      viewport: proxy.viewport,
      center: { proxy.center(on: $0, phase: $1) },
      setZoom: { proxy.setZoom($0, phase: $1) }
    )
  }

  public var zoom: CGFloat {
    viewport.transform.zoom
  }

  public func center(
    on worldPoint: CGPoint,
    phase: FlowingCanvasViewportChangePhase = .ended
  ) {
    centerAction(worldPoint, phase)
  }

  public func setZoom(
    _ zoom: CGFloat,
    phase: FlowingCanvasViewportChangePhase = .ended
  ) {
    setZoomAction(zoom, phase)
  }
}
