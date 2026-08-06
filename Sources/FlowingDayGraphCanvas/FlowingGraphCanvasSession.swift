import CoreGraphics
import FlowingDayCanvas
import FlowingDayGraphComposition
import FlowingDayGraphCore
import FlowingDayGraphLayout
import Foundation

public struct FlowingGraphCanvasSessionID: Hashable, Sendable {
  public let rawValue: UUID

  public init(rawValue: UUID = UUID()) {
    self.rawValue = rawValue
  }
}

public enum FlowingGraphCanvasTool: Hashable, Sendable {
  case select
  case pan
}

public enum FlowingGraphCanvasSelectionMode: Hashable, Sendable {
  case replace
  case additive
  case toggle
}

public struct FlowingGraphCanvasMarquee: Equatable, Sendable {
  public let startLocation: CGPoint
  public let location: CGPoint

  public init(startLocation: CGPoint, location: CGPoint) {
    self.startLocation = startLocation
    self.location = location
  }

  public var rect: CGRect {
    CGRect(
      x: min(startLocation.x, location.x),
      y: min(startLocation.y, location.y),
      width: abs(location.x - startLocation.x),
      height: abs(location.y - startLocation.y)
    )
  }
}

public struct FlowingGraphCanvasTransientNodeDrag<
  Schema: FlowingGraphCanvasSchema
>: Equatable, Sendable {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  public let nodeID: ElementID
  public let nodeIDs: Set<ElementID>
  public let basePresentationSnapshotID: FlowingGraphPresentationSnapshotID
  public let baseLayoutInputID: FlowingLayoutInputID
  public let baseBounds: CGRect?
  public var translation: CGSize
  public var guides: [FlowingGraphCanvasGuide]

  public init(
    nodeID: ElementID,
    nodeIDs: Set<ElementID>? = nil,
    basePresentationSnapshotID: FlowingGraphPresentationSnapshotID,
    baseLayoutInputID: FlowingLayoutInputID,
    baseBounds: CGRect? = nil,
    translation: CGSize = .zero,
    guides: [FlowingGraphCanvasGuide] = []
  ) {
    let resolvedNodeIDs = nodeIDs ?? [nodeID]
    precondition(resolvedNodeIDs.contains(nodeID))
    self.nodeID = nodeID
    self.nodeIDs = resolvedNodeIDs
    self.basePresentationSnapshotID = basePresentationSnapshotID
    self.baseLayoutInputID = baseLayoutInputID
    self.baseBounds = baseBounds
    self.translation = translation
    self.guides = guides
  }
}

public struct FlowingGraphCanvasSessionState<
  Schema: FlowingGraphCanvasSchema
>: Equatable, Sendable {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  public var viewport: FlowingCanvasViewport
  public var selection: Set<ElementID>
  public var focusedElementID: ElementID?
  public var hoveredElementID: ElementID?
  public var tool: FlowingGraphCanvasTool
  public var marquee: FlowingGraphCanvasMarquee?
  public var transientNodeDrag: FlowingGraphCanvasTransientNodeDrag<Schema>?

  public init(
    viewport: FlowingCanvasViewport = .init(),
    selection: Set<ElementID> = [],
    focusedElementID: ElementID? = nil,
    hoveredElementID: ElementID? = nil,
    tool: FlowingGraphCanvasTool = .select,
    marquee: FlowingGraphCanvasMarquee? = nil,
    transientNodeDrag: FlowingGraphCanvasTransientNodeDrag<Schema>? = nil
  ) {
    self.viewport = viewport
    self.selection = selection
    self.focusedElementID = focusedElementID
    self.hoveredElementID = hoveredElementID
    self.tool = tool
    self.marquee = marquee
    self.transientNodeDrag = transientNodeDrag
  }
}

public enum FlowingGraphCanvasSelectionCommand<
  Schema: FlowingGraphCanvasSchema
>: Equatable, Sendable {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  case replace(Set<ElementID>)
  case add(Set<ElementID>)
  case remove(Set<ElementID>)
  case toggle(Set<ElementID>)
  case clear
}

public enum FlowingGraphCanvasFitScope<
  Schema: FlowingGraphCanvasSchema
>: Equatable, Sendable {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  case presentation
  case selection
  case elements(Set<ElementID>)
}

public enum FlowingGraphCanvasSessionCommandAction<
  Schema: FlowingGraphCanvasSchema
>: Equatable, Sendable {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  case focus(elementID: ElementID, zoom: CGFloat? = nil)
  case pan(
    worldPoint: CGPoint,
    viewportPoint: CGPoint? = nil,
    zoom: CGFloat? = nil
  )
  case restoreViewport(FlowingCanvasTransform)
  case select(FlowingGraphCanvasSelectionCommand<Schema>)
  case fit(
    scope: FlowingGraphCanvasFitScope<Schema>,
    padding: CGFloat,
    maximumZoom: CGFloat? = nil
  )
  case inspect(ElementID)
  case arrange(FlowingGraphCanvasArrangementAction)
}

public struct FlowingGraphCanvasSessionCommand<
  Schema: FlowingGraphCanvasSchema
>: Equatable, Identifiable, Sendable {
  public let id: UUID
  public let targetSessionID: FlowingGraphCanvasSessionID
  public let action: FlowingGraphCanvasSessionCommandAction<Schema>
  public let animated: Bool

  public init(
    id: UUID = UUID(),
    targetSessionID: FlowingGraphCanvasSessionID,
    action: FlowingGraphCanvasSessionCommandAction<Schema>,
    animated: Bool = true
  ) {
    self.id = id
    self.targetSessionID = targetSessionID
    self.action = action
    self.animated = animated
  }

  public func targets(_ sessionID: FlowingGraphCanvasSessionID) -> Bool {
    targetSessionID == sessionID
  }
}

public enum FlowingGraphCanvasElementAction: Hashable, Sendable {
  case collapse
  case expand
  case drillIn
  case inspect
}

public struct FlowingGraphCanvasNodeDragIntent<
  Schema: FlowingGraphCanvasSchema
>: Equatable, Sendable {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  public let nodeID: ElementID
  public let nodeIDs: Set<ElementID>
  public let basePresentationSnapshotID: FlowingGraphPresentationSnapshotID
  public let baseLayoutInputID: FlowingLayoutInputID
  public let translation: CGSize

  public init(
    nodeID: ElementID,
    nodeIDs: Set<ElementID>? = nil,
    basePresentationSnapshotID: FlowingGraphPresentationSnapshotID,
    baseLayoutInputID: FlowingLayoutInputID,
    translation: CGSize
  ) {
    let resolvedNodeIDs = nodeIDs ?? [nodeID]
    precondition(resolvedNodeIDs.contains(nodeID))
    self.nodeID = nodeID
    self.nodeIDs = resolvedNodeIDs
    self.basePresentationSnapshotID = basePresentationSnapshotID
    self.baseLayoutInputID = baseLayoutInputID
    self.translation = translation
  }
}

public struct FlowingGraphCanvasElementActionIntent<
  Schema: FlowingGraphCanvasSchema
>: Equatable, Sendable {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  public let action: FlowingGraphCanvasElementAction
  public let elementID: ElementID
  public let basePresentationSnapshotID: FlowingGraphPresentationSnapshotID

  public init(
    action: FlowingGraphCanvasElementAction,
    elementID: ElementID,
    basePresentationSnapshotID: FlowingGraphPresentationSnapshotID
  ) {
    self.action = action
    self.elementID = elementID
    self.basePresentationSnapshotID = basePresentationSnapshotID
  }
}

public enum FlowingGraphCanvasInteractionIntent<
  Schema: FlowingGraphCanvasSchema
>: Equatable, Sendable {
  case nodeDragCompleted(FlowingGraphCanvasNodeDragIntent<Schema>)
  case nodeArrangementRequested(FlowingGraphCanvasNodeArrangementIntent<Schema>)
  case elementAction(FlowingGraphCanvasElementActionIntent<Schema>)
}

public enum FlowingGraphCanvasSessionReducer {
  public static func apply<Schema: FlowingGraphCanvasSchema>(
    _ command: FlowingGraphCanvasSelectionCommand<Schema>,
    to selection: inout Set<FlowingGraphCompositionElementID<Schema>>
  ) {
    switch command {
    case .replace(let elementIDs):
      selection = elementIDs
    case .add(let elementIDs):
      selection.formUnion(elementIDs)
    case .remove(let elementIDs):
      selection.subtract(elementIDs)
    case .toggle(let elementIDs):
      for elementID in elementIDs {
        if !selection.insert(elementID).inserted {
          selection.remove(elementID)
        }
      }
    case .clear:
      selection.removeAll(keepingCapacity: true)
    }
  }
}
