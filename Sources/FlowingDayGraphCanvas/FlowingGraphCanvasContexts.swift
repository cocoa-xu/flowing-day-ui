#if canImport(AppKit)
import AppKit
#endif
import CoreGraphics
import FlowingDayCanvas
import FlowingDayGraphComposition
import FlowingDayGraphLayout
import SwiftUI

public struct FlowingGraphCanvasConfiguration: Equatable, Sendable {
  public let canvas: FlowingCanvasConfiguration
  public let edgeRenderPadding: CGFloat
  public let marqueeMinimumDistance: CGFloat

  public init(
    canvas: FlowingCanvasConfiguration = .init(),
    edgeRenderPadding: CGFloat = 12,
    marqueeMinimumDistance: CGFloat = 2
  ) {
    precondition(edgeRenderPadding >= 0 && edgeRenderPadding.isFinite)
    precondition(marqueeMinimumDistance >= 0 && marqueeMinimumDistance.isFinite)
    self.canvas = canvas
    self.edgeRenderPadding = edgeRenderPadding
    self.marqueeMinimumDistance = marqueeMinimumDistance
  }
}

@MainActor
public enum FlowingGraphCanvasPlatformInput {
  public static var isAdditiveSelectionActive: Bool {
    #if canImport(AppKit)
    let flags = NSEvent.modifierFlags
    return flags.contains(.command) || flags.contains(.shift)
    #else
    return false
    #endif
  }
}

@MainActor
public struct FlowingGraphCanvasElementActions<Schema: FlowingGraphCanvasSchema> {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  private let selectAction: (FlowingGraphCanvasSelectionMode?) -> Void
  private let elementAction: (FlowingGraphCanvasElementAction) -> Void

  init(
    select: @escaping (FlowingGraphCanvasSelectionMode?) -> Void,
    send: @escaping (FlowingGraphCanvasElementAction) -> Void
  ) {
    selectAction = select
    elementAction = send
  }

  public func select(mode: FlowingGraphCanvasSelectionMode? = nil) {
    selectAction(mode)
  }

  public func send(_ action: FlowingGraphCanvasElementAction) {
    elementAction(action)
  }
}

@MainActor
public struct FlowingGraphCanvasNodeContext<Schema: FlowingGraphCanvasSchema> {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>
  public typealias LocalElementID = FlowingGraphPresentationLocalElementID<Schema>

  public let elementID: ElementID
  public let localID: LocalElementID
  public let baseFrame: CGRect
  public let frame: CGRect
  public let renderedFrame: CGRect
  public let renderScale: CGFloat
  public let isSelected: Bool
  public let isHovered: Bool
  public let isBeingDragged: Bool
  public let actions: FlowingGraphCanvasElementActions<Schema>
}

@MainActor
public struct FlowingGraphCanvasPortContext<Schema: FlowingGraphCanvasSchema> {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>
  public typealias LocalElementID = FlowingGraphPresentationLocalElementID<Schema>

  public let elementID: ElementID
  public let localID: LocalElementID
  public let nodeLocalID: LocalElementID
  public let anchor: FlowingGraphCanvasAnchor
  public let renderedPosition: CGPoint
  public let renderScale: CGFloat
  public let isSelected: Bool
  public let isHovered: Bool
  public let actions: FlowingGraphCanvasElementActions<Schema>
}

@MainActor
public struct FlowingGraphCanvasEdgeContext<Schema: FlowingGraphCanvasSchema> {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>
  public typealias LocalElementID = FlowingGraphPresentationLocalElementID<Schema>

  public let elementID: ElementID
  public let localID: LocalElementID
  public let worldRoute: FlowingGraphEdgeRoute
  public let renderedRoute: FlowingGraphEdgeRoute
  public let anchors: FlowingGraphCanvasEdgeAnchors
  public let worldFrame: CGRect
  public let renderedFrame: CGRect
  public let renderScale: CGFloat
  public let isSelected: Bool
  public let isHovered: Bool
  public let isTransient: Bool
  public let actions: FlowingGraphCanvasElementActions<Schema>
}

@MainActor
public struct FlowingGraphCanvasWorldContext<Schema: FlowingGraphCanvasSchema> {
  public let content: FlowingGraphCanvasContent<Schema>
  public let session: FlowingGraphCanvasSessionState<Schema>
  public let renderContext: FlowingCanvasRenderContext
  public let surface: FlowingCanvasRenderSurface
}

@MainActor
public struct FlowingGraphCanvasOverlayContext<Schema: FlowingGraphCanvasSchema> {
  public let sessionID: FlowingGraphCanvasSessionID
  public let content: FlowingGraphCanvasContent<Schema>
  public let session: FlowingGraphCanvasSessionState<Schema>
  public let proxy: FlowingCanvasProxy
}

public struct FlowingGraphCanvasSmartMagnifyContext<Schema: FlowingGraphCanvasSchema> {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  public let canvas: FlowingCanvasSmartMagnifyContext
  public let nearestNodeID: ElementID?
  public let nearestNodeFrame: CGRect?
  public let focusedElementID: ElementID?
  public let focusedElementBounds: CGRect?

  public init(
    canvas: FlowingCanvasSmartMagnifyContext,
    nearestNodeID: ElementID?,
    nearestNodeFrame: CGRect?,
    focusedElementID: ElementID?,
    focusedElementBounds: CGRect?
  ) {
    self.canvas = canvas
    self.nearestNodeID = nearestNodeID
    self.nearestNodeFrame = nearestNodeFrame
    self.focusedElementID = focusedElementID
    self.focusedElementBounds = focusedElementBounds
  }

  public func standardAction(
    focusedZoom: CGFloat,
    fitPadding: CGFloat
  ) -> FlowingCanvasViewportAction {
    if canvas.canRestoreViewport {
      return .restore
    }
    if canvas.isZoomedIn, let focusedElementBounds {
      return .fit(
        rect: focusedElementBounds,
        padding: fitPadding,
        maximumZoom: nil
      )
    }
    if let nearestNodeFrame {
      return .focus(rect: nearestNodeFrame, zoom: focusedZoom)
    }
    return .none
  }
}
