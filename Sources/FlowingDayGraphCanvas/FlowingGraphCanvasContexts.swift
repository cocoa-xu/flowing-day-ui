import CoreGraphics
import FlowingDayCanvas
import FlowingDayGraphComposition
import FlowingDayGraphLayout
import SwiftUI

#if canImport(AppKit)
  import AppKit
#endif

public struct FlowingGraphCanvasConfiguration: Equatable, Sendable {
  public let renderingBackend: FlowingGraphCanvasRenderingBackendPreference
  public let canvas: FlowingCanvasConfiguration
  public let edgeRenderPadding: CGFloat
  public let marqueeMinimumDistance: CGFloat
  public let nodeDraggingMode: FlowingGraphCanvasNodeDraggingMode
  public let nodeResizing: FlowingGraphCanvasNodeResizingConfiguration
  public let snapping: FlowingGraphCanvasSnappingConfiguration
  public let allowsArrangementCommands: Bool
  public let keyboardNavigation: FlowingGraphCanvasKeyboardNavigationConfiguration
  public let keyboardNudging: FlowingGraphCanvasKeyboardNudgingConfiguration
  public let accessibility: FlowingGraphCanvasAccessibilityConfiguration

  public init(
    renderingBackend: FlowingGraphCanvasRenderingBackendPreference = .automatic,
    canvas: FlowingCanvasConfiguration = .init(),
    edgeRenderPadding: CGFloat = 12,
    marqueeMinimumDistance: CGFloat = 2,
    nodeDraggingMode: FlowingGraphCanvasNodeDraggingMode = .single,
    nodeResizing: FlowingGraphCanvasNodeResizingConfiguration = .disabled,
    snapping: FlowingGraphCanvasSnappingConfiguration = .disabled,
    allowsArrangementCommands: Bool = true,
    keyboardNavigation: FlowingGraphCanvasKeyboardNavigationConfiguration = .standard,
    keyboardNudging: FlowingGraphCanvasKeyboardNudgingConfiguration = .standard,
    accessibility: FlowingGraphCanvasAccessibilityConfiguration = .standard
  ) {
    precondition(edgeRenderPadding >= 0 && edgeRenderPadding.isFinite)
    precondition(marqueeMinimumDistance >= 0 && marqueeMinimumDistance.isFinite)
    self.renderingBackend = renderingBackend
    self.canvas = canvas
    self.edgeRenderPadding = edgeRenderPadding
    self.marqueeMinimumDistance = marqueeMinimumDistance
    self.nodeDraggingMode = nodeDraggingMode
    self.nodeResizing = nodeResizing
    self.snapping = snapping
    self.allowsArrangementCommands = allowsArrangementCommands
    self.keyboardNavigation = keyboardNavigation
    self.keyboardNudging = keyboardNudging
    self.accessibility = accessibility
  }
}

@MainActor
public struct FlowingGraphCanvasNodeResizeActions {
  public let isEnabled: Bool
  private let updateAction: (FlowingGraphCanvasResizeEdges, CGSize) -> Void
  private let endAction: () -> Void
  private let cancelAction: () -> Void

  init(
    isEnabled: Bool,
    update: @escaping (FlowingGraphCanvasResizeEdges, CGSize) -> Void,
    end: @escaping () -> Void,
    cancel: @escaping () -> Void
  ) {
    self.isEnabled = isEnabled
    updateAction = update
    endAction = end
    cancelAction = cancel
  }

  public func update(
    edges: FlowingGraphCanvasResizeEdges,
    renderedTranslation: CGSize
  ) {
    guard isEnabled else { return }
    updateAction(edges, renderedTranslation)
  }

  public func end() {
    guard isEnabled else { return }
    endAction()
  }

  public func cancel() {
    guard isEnabled else { return }
    cancelAction()
  }

  public static var disabled: Self {
    Self(isEnabled: false, update: { _, _ in }, end: {}, cancel: {})
  }
}

@MainActor
public struct FlowingGraphCanvasSelectionResizeContext<Schema: FlowingGraphCanvasSchema> {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  public let anchorNodeID: ElementID
  public let nodeIDs: Set<ElementID>
  public let frame: CGRect
  public let renderedFrame: CGRect
  public let renderScale: CGFloat
  public let isResizing: Bool
  public let actions: FlowingGraphCanvasNodeResizeActions

  public init(
    anchorNodeID: ElementID,
    nodeIDs: Set<ElementID>,
    frame: CGRect,
    renderedFrame: CGRect,
    renderScale: CGFloat,
    isResizing: Bool,
    actions: FlowingGraphCanvasNodeResizeActions
  ) {
    precondition(!nodeIDs.isEmpty && nodeIDs.contains(anchorNodeID))
    self.anchorNodeID = anchorNodeID
    self.nodeIDs = nodeIDs
    self.frame = frame
    self.renderedFrame = renderedFrame
    self.renderScale = renderScale
    self.isResizing = isResizing
    self.actions = actions
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

  public static var interactionModifiers: FlowingGraphCanvasInteractionModifiers {
    #if canImport(AppKit)
      let flags = NSEvent.modifierFlags
      var modifiers: FlowingGraphCanvasInteractionModifiers = []
      if flags.contains(.shift) {
        modifiers.formUnion([
          .constrainDragAxis,
          .preserveResizeAspectRatio,
          .largeKeyboardNudge,
        ])
      }
      if flags.contains(.option) {
        modifiers.insert(.resizeFromCenter)
      }
      if flags.contains(.command) {
        modifiers.insert(.disableSnapping)
      }
      return modifiers
    #else
      return []
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

  public static var disabled: Self {
    Self(select: { _ in }, send: { _ in })
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
  public let isFocused: Bool
  public let isHovered: Bool
  public let isBeingDragged: Bool
  public let isBeingResized: Bool
  public let capabilities: FlowingGraphCanvasNodeCapabilities
  public let actions: FlowingGraphCanvasElementActions<Schema>
  public let resizeActions: FlowingGraphCanvasNodeResizeActions

  public init(
    elementID: ElementID,
    localID: LocalElementID,
    baseFrame: CGRect,
    frame: CGRect,
    renderedFrame: CGRect,
    renderScale: CGFloat,
    isSelected: Bool,
    isFocused: Bool = false,
    isHovered: Bool,
    isBeingDragged: Bool,
    isBeingResized: Bool = false,
    capabilities: FlowingGraphCanvasNodeCapabilities = .standard,
    actions: FlowingGraphCanvasElementActions<Schema>,
    resizeActions: FlowingGraphCanvasNodeResizeActions = .disabled
  ) {
    self.elementID = elementID
    self.localID = localID
    self.baseFrame = baseFrame
    self.frame = frame
    self.renderedFrame = renderedFrame
    self.renderScale = renderScale
    self.isSelected = isSelected
    self.isFocused = isFocused
    self.isHovered = isHovered
    self.isBeingDragged = isBeingDragged
    self.isBeingResized = isBeingResized
    self.capabilities = capabilities
    self.actions = actions
    self.resizeActions = resizeActions
  }
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

  public init(
    elementID: ElementID,
    localID: LocalElementID,
    nodeLocalID: LocalElementID,
    anchor: FlowingGraphCanvasAnchor,
    renderedPosition: CGPoint,
    renderScale: CGFloat,
    isSelected: Bool,
    isHovered: Bool,
    actions: FlowingGraphCanvasElementActions<Schema>
  ) {
    self.elementID = elementID
    self.localID = localID
    self.nodeLocalID = nodeLocalID
    self.anchor = anchor
    self.renderedPosition = renderedPosition
    self.renderScale = renderScale
    self.isSelected = isSelected
    self.isHovered = isHovered
    self.actions = actions
  }
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

  public init(
    elementID: ElementID,
    localID: LocalElementID,
    worldRoute: FlowingGraphEdgeRoute,
    renderedRoute: FlowingGraphEdgeRoute,
    anchors: FlowingGraphCanvasEdgeAnchors,
    worldFrame: CGRect,
    renderedFrame: CGRect,
    renderScale: CGFloat,
    isSelected: Bool,
    isHovered: Bool,
    isTransient: Bool,
    actions: FlowingGraphCanvasElementActions<Schema>
  ) {
    self.elementID = elementID
    self.localID = localID
    self.worldRoute = worldRoute
    self.renderedRoute = renderedRoute
    self.anchors = anchors
    self.worldFrame = worldFrame
    self.renderedFrame = renderedFrame
    self.renderScale = renderScale
    self.isSelected = isSelected
    self.isHovered = isHovered
    self.isTransient = isTransient
    self.actions = actions
  }
}

@MainActor
public struct FlowingGraphCanvasWorldContext<Schema: FlowingGraphCanvasSchema> {
  public let content: FlowingGraphCanvasContent<Schema>
  public let session: FlowingGraphCanvasSessionState<Schema>
  public let renderContext: FlowingCanvasRenderContext
  public let surface: FlowingCanvasRenderSurface
  public let selectionResize: FlowingGraphCanvasSelectionResizeContext<Schema>?
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
