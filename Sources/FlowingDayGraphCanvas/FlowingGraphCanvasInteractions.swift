import CoreGraphics
import FlowingDayGraphComposition
import FlowingDayGraphCore

public enum FlowingGraphCanvasNodeDraggingMode: Hashable, Sendable {
  case disabled
  case single
  case multiple
}

public struct FlowingGraphCanvasInteractionModifiers: OptionSet, Hashable, Sendable {
  public let rawValue: UInt8

  public init(rawValue: UInt8) {
    self.rawValue = rawValue
  }

  public static let constrainDragAxis = Self(rawValue: 1 << 0)
  public static let preserveResizeAspectRatio = Self(rawValue: 1 << 1)
  public static let resizeFromCenter = Self(rawValue: 1 << 2)
  public static let disableSnapping = Self(rawValue: 1 << 3)
  public static let largeKeyboardNudge = Self(rawValue: 1 << 4)
}

public struct FlowingGraphCanvasNodeResizingConfiguration: Equatable, Sendable {
  public static let standardMinimumSize = CGSize(width: 44, height: 32)

  public let isEnabled: Bool
  public let minimumSize: CGSize

  public init(
    isEnabled: Bool,
    minimumSize: CGSize = standardMinimumSize
  ) {
    precondition(minimumSize.width >= 0 && minimumSize.width.isFinite)
    precondition(minimumSize.height >= 0 && minimumSize.height.isFinite)
    self.isEnabled = isEnabled
    self.minimumSize = minimumSize
  }

  public static let disabled = Self(isEnabled: false)
  public static let standard = Self(isEnabled: true)
}

public struct FlowingGraphCanvasNodeCapabilities: OptionSet, Hashable, Sendable {
  public let rawValue: UInt8

  public init(rawValue: UInt8) {
    self.rawValue = rawValue
  }

  public static let draggable = Self(rawValue: 1 << 0)
  public static let arrangementParticipant = Self(rawValue: 1 << 1)
  public static let keyboardNavigable = Self(rawValue: 1 << 2)
  public static let resizable = Self(rawValue: 1 << 3)
  public static let standard: Self = [
    .draggable,
    .arrangementParticipant,
    .keyboardNavigable,
    .resizable,
  ]
}

public struct FlowingGraphCanvasNodeCapabilityMap<Schema: FlowingGraphCanvasSchema>:
  Equatable, Sendable
{
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  public let defaultCapabilities: FlowingGraphCanvasNodeCapabilities
  public let overrides: [ElementID: FlowingGraphCanvasNodeCapabilities]

  public init(
    defaultCapabilities: FlowingGraphCanvasNodeCapabilities = .standard,
    overrides: [ElementID: FlowingGraphCanvasNodeCapabilities] = [:]
  ) {
    self.defaultCapabilities = defaultCapabilities
    self.overrides = overrides
  }

  public func capabilities(for nodeID: ElementID) -> FlowingGraphCanvasNodeCapabilities {
    overrides[nodeID] ?? defaultCapabilities
  }
}

public struct FlowingGraphCanvasNodeSizeConstraints: Equatable, Sendable {
  public let minimumSize: CGSize
  public let maximumSize: CGSize?

  public init(
    minimumSize: CGSize = .zero,
    maximumSize: CGSize? = nil
  ) {
    precondition(minimumSize.width >= 0 && minimumSize.width.isFinite)
    precondition(minimumSize.height >= 0 && minimumSize.height.isFinite)
    if let maximumSize {
      precondition(maximumSize.width >= minimumSize.width && maximumSize.width.isFinite)
      precondition(maximumSize.height >= minimumSize.height && maximumSize.height.isFinite)
    }
    self.minimumSize = minimumSize
    self.maximumSize = maximumSize
  }
}

public struct FlowingGraphCanvasNodeSizeConstraintMap<Schema: FlowingGraphCanvasSchema>:
  Equatable, Sendable
{
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  public let defaultConstraints: FlowingGraphCanvasNodeSizeConstraints?
  public let overrides: [ElementID: FlowingGraphCanvasNodeSizeConstraints]

  public init(
    defaultConstraints: FlowingGraphCanvasNodeSizeConstraints? = nil,
    overrides: [ElementID: FlowingGraphCanvasNodeSizeConstraints] = [:]
  ) {
    self.defaultConstraints = defaultConstraints
    self.overrides = overrides
  }

  public func constraints(
    for nodeID: ElementID,
    fallbackMinimumSize: CGSize
  ) -> FlowingGraphCanvasNodeSizeConstraints {
    overrides[nodeID]
      ?? defaultConstraints
      ?? FlowingGraphCanvasNodeSizeConstraints(minimumSize: fallbackMinimumSize)
  }
}

public struct FlowingGraphCanvasInteractionPolicy<Schema: FlowingGraphCanvasSchema> {
  public let nodeCapabilities: FlowingGraphCanvasNodeCapabilityMap<Schema>
  public let nodeSizeConstraints: FlowingGraphCanvasNodeSizeConstraintMap<Schema>
  public let snappingStrategy: FlowingGraphCanvasSnappingStrategy<Schema>
  public let connectionPolicy: FlowingGraphCanvasConnectionPolicy<Schema>

  private let nodeDragAdmission:
    @MainActor (FlowingGraphCanvasNodeDragAdmissionRequest<Schema>) ->
      FlowingGraphCanvasNodeDragAdmission<Schema>
  private let nodeResizeAdmission:
    @MainActor (FlowingGraphCanvasNodeResizeAdmissionRequest<Schema>) ->
      FlowingGraphCanvasNodeResizeAdmission<Schema>
  private let additiveSelectionState: @MainActor () -> Bool
  private let modifiers: @MainActor () -> FlowingGraphCanvasInteractionModifiers

  public init(
    nodeCapabilities: FlowingGraphCanvasNodeCapabilityMap<Schema> = .init(),
    nodeSizeConstraints: FlowingGraphCanvasNodeSizeConstraintMap<Schema> = .init(),
    snappingStrategy: FlowingGraphCanvasSnappingStrategy<Schema> = .standard,
    connectionPolicy: FlowingGraphCanvasConnectionPolicy<Schema> = .standard,
    admitNodeDrag:
      @escaping @MainActor (FlowingGraphCanvasNodeDragAdmissionRequest<Schema>) ->
      FlowingGraphCanvasNodeDragAdmission<Schema> = { _ in .allowAll },
    admitNodeResize:
      @escaping @MainActor (FlowingGraphCanvasNodeResizeAdmissionRequest<Schema>) ->
      FlowingGraphCanvasNodeResizeAdmission<Schema> = { _ in .allowAll },
    isAdditiveSelectionActive: @escaping @MainActor () -> Bool = {
      FlowingGraphCanvasPlatformInput.isAdditiveSelectionActive
    },
    interactionModifiers: @escaping @MainActor () -> FlowingGraphCanvasInteractionModifiers = {
      FlowingGraphCanvasPlatformInput.interactionModifiers
    }
  ) {
    self.nodeCapabilities = nodeCapabilities
    self.nodeSizeConstraints = nodeSizeConstraints
    self.snappingStrategy = snappingStrategy
    self.connectionPolicy = connectionPolicy
    nodeDragAdmission = admitNodeDrag
    nodeResizeAdmission = admitNodeResize
    additiveSelectionState = isAdditiveSelectionActive
    modifiers = interactionModifiers
  }

  @MainActor
  public func admission(
    for request: FlowingGraphCanvasNodeDragAdmissionRequest<Schema>
  ) -> FlowingGraphCanvasNodeDragAdmission<Schema> {
    nodeDragAdmission(request)
  }

  @MainActor
  public func admission(
    for request: FlowingGraphCanvasNodeResizeAdmissionRequest<Schema>
  ) -> FlowingGraphCanvasNodeResizeAdmission<Schema> {
    nodeResizeAdmission(request)
  }

  @MainActor
  public var isAdditiveSelectionActive: Bool {
    additiveSelectionState()
  }

  @MainActor
  public var interactionModifiers: FlowingGraphCanvasInteractionModifiers {
    modifiers()
  }

  public static var standard: Self {
    Self()
  }
}

public struct FlowingGraphCanvasNodeDragAdmissionRequest<
  Schema: FlowingGraphCanvasSchema
>: Equatable, Sendable {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  public let anchorNodeID: ElementID
  public let selectedNodeIDs: [ElementID]
  public let candidateNodeIDs: [ElementID]
  public let basePresentationSnapshotID: FlowingGraphPresentationSnapshotID

  public init(
    anchorNodeID: ElementID,
    selectedNodeIDs: [ElementID],
    candidateNodeIDs: [ElementID],
    basePresentationSnapshotID: FlowingGraphPresentationSnapshotID
  ) {
    self.anchorNodeID = anchorNodeID
    self.selectedNodeIDs = selectedNodeIDs
    self.candidateNodeIDs = candidateNodeIDs
    self.basePresentationSnapshotID = basePresentationSnapshotID
  }
}

public enum FlowingGraphCanvasNodeDragAdmission<Schema: FlowingGraphCanvasSchema>:
  Equatable, Sendable
{
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  case deny
  case allowAll
  case allowOnly(Set<ElementID>)
}

public enum FlowingGraphCanvasNodeDragResolver {
  public static func request<Schema: FlowingGraphCanvasSchema>(
    anchorNodeID: FlowingGraphCompositionElementID<Schema>,
    selection: Set<FlowingGraphCompositionElementID<Schema>>,
    presentation: FlowingGraphPresentation<Schema>,
    mode: FlowingGraphCanvasNodeDraggingMode,
    capabilities: FlowingGraphCanvasNodeCapabilityMap<Schema>
  ) -> FlowingGraphCanvasNodeDragAdmissionRequest<Schema>? {
    guard mode != .disabled else { return nil }
    guard capabilities.capabilities(for: anchorNodeID).contains(.draggable) else {
      return nil
    }

    let effectiveSelection = selection.contains(anchorNodeID) ? selection : [anchorNodeID]
    let selectedNodeIDs = presentation.nodes.map(\.id).filter(effectiveSelection.contains)
    let candidates: [FlowingGraphCompositionElementID<Schema>]
    switch mode {
    case .disabled:
      return nil
    case .single:
      candidates = [anchorNodeID]
    case .multiple:
      candidates = selectedNodeIDs.filter {
        capabilities.capabilities(for: $0).contains(.draggable)
      }
    }
    guard candidates.contains(anchorNodeID) else { return nil }
    return FlowingGraphCanvasNodeDragAdmissionRequest<Schema>(
      anchorNodeID: anchorNodeID,
      selectedNodeIDs: selectedNodeIDs,
      candidateNodeIDs: candidates,
      basePresentationSnapshotID: presentation.snapshotID
    )
  }

  public static func admittedNodeIDs<Schema: FlowingGraphCanvasSchema>(
    for request: FlowingGraphCanvasNodeDragAdmissionRequest<Schema>,
    admission: FlowingGraphCanvasNodeDragAdmission<Schema>
  ) -> Set<FlowingGraphCompositionElementID<Schema>> {
    let candidates = Set(request.candidateNodeIDs)
    let admitted: Set<FlowingGraphCompositionElementID<Schema>>
    switch admission {
    case .deny:
      return []
    case .allowAll:
      admitted = candidates
    case .allowOnly(let nodeIDs):
      admitted = candidates.intersection(nodeIDs)
    }
    guard admitted.contains(request.anchorNodeID) else { return [] }
    return admitted
  }
}

public struct FlowingGraphCanvasNodeResizeAdmissionRequest<
  Schema: FlowingGraphCanvasSchema
>: Equatable, Sendable {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  public let anchorNodeID: ElementID
  public let selectedNodeIDs: [ElementID]
  public let candidateNodeIDs: [ElementID]
  public let baseFrames: [ElementID: CGRect]
  public let edges: FlowingGraphCanvasResizeEdges
  public let basePresentationSnapshotID: FlowingGraphPresentationSnapshotID

  public init(
    anchorNodeID: ElementID,
    selectedNodeIDs: [ElementID],
    candidateNodeIDs: [ElementID],
    baseFrames: [ElementID: CGRect],
    edges: FlowingGraphCanvasResizeEdges,
    basePresentationSnapshotID: FlowingGraphPresentationSnapshotID
  ) {
    precondition(edges.isValid)
    precondition(candidateNodeIDs.allSatisfy { baseFrames[$0] != nil })
    self.anchorNodeID = anchorNodeID
    self.selectedNodeIDs = selectedNodeIDs
    self.candidateNodeIDs = candidateNodeIDs
    self.baseFrames = baseFrames
    self.edges = edges
    self.basePresentationSnapshotID = basePresentationSnapshotID
  }
}

public enum FlowingGraphCanvasNodeResizeAdmission<Schema: FlowingGraphCanvasSchema>:
  Equatable, Sendable
{
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  case deny
  case allowAll
  case allowOnly(Set<ElementID>)
}

public enum FlowingGraphCanvasNodeResizeResolver {
  public static func admittedNodeIDs<Schema: FlowingGraphCanvasSchema>(
    for request: FlowingGraphCanvasNodeResizeAdmissionRequest<Schema>,
    admission: FlowingGraphCanvasNodeResizeAdmission<Schema>
  ) -> Set<FlowingGraphCompositionElementID<Schema>> {
    let candidates = Set(request.candidateNodeIDs)
    let admitted: Set<FlowingGraphCompositionElementID<Schema>>
    switch admission {
    case .deny:
      return []
    case .allowAll:
      admitted = candidates
    case .allowOnly(let nodeIDs):
      admitted = candidates.intersection(nodeIDs)
    }
    guard admitted.contains(request.anchorNodeID) else { return [] }
    return admitted
  }
}
