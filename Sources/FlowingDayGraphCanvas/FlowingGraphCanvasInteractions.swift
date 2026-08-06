import FlowingDayGraphComposition
import FlowingDayGraphCore

public enum FlowingGraphCanvasNodeDraggingMode: Hashable, Sendable {
  case disabled
  case single
  case multiple
}

public struct FlowingGraphCanvasNodeCapabilities: OptionSet, Hashable, Sendable {
  public let rawValue: UInt8

  public init(rawValue: UInt8) {
    self.rawValue = rawValue
  }

  public static let draggable = Self(rawValue: 1 << 0)
  public static let arrangementParticipant = Self(rawValue: 1 << 1)
  public static let keyboardNavigable = Self(rawValue: 1 << 2)
  public static let standard: Self = [
    .draggable,
    .arrangementParticipant,
    .keyboardNavigable,
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
