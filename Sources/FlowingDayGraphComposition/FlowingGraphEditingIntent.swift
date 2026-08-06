import FlowingDayGraphCore

public enum FlowingGraphExpansion: Hashable, Sendable {
  case collapsed
  case expanded
}

public enum FlowingGraphProjectionAction<Schema: FlowingGraphCompositionSchema> {
  public typealias InstanceSite = FlowingGraphInstanceNodeAddress<
    Schema.GraphID,
    Schema.GraphSchema.NodeID
  >

  case setExpansion(FlowingGraphExpansion, at: InstanceSite)
  case drillIn(at: InstanceSite)
  case drillOut
}

extension FlowingGraphProjectionAction: Equatable {}
extension FlowingGraphProjectionAction: Sendable
where Schema.GraphID: Sendable, Schema.GraphSchema.NodeID: Sendable {}

public struct FlowingGraphProjectionIntent<Schema: FlowingGraphCompositionSchema> {
  public let basePresentationSnapshotID: FlowingGraphPresentationSnapshotID
  public let action: FlowingGraphProjectionAction<Schema>

  public init(
    basePresentationSnapshotID: FlowingGraphPresentationSnapshotID,
    action: FlowingGraphProjectionAction<Schema>
  ) {
    self.basePresentationSnapshotID = basePresentationSnapshotID
    self.action = action
  }
}

extension FlowingGraphProjectionIntent: Equatable {}
extension FlowingGraphProjectionIntent: Sendable
where Schema.GraphID: Sendable, Schema.GraphSchema.NodeID: Sendable {}

public enum FlowingGraphDocumentEditAction<Schema: FlowingGraphCompositionSchema> {
  public typealias PortKey = FlowingGraphPortKey<Schema.GraphSchema>
  public typealias PortPosition = FlowingGraphOrderPosition<Schema.GraphSchema.PortID>
  public typealias BindingPosition = FlowingGraphOrderPosition<PortKey>

  case createInterfaceBinding(
    linkID: Schema.LinkID,
    binding: FlowingSubgraphInterfaceBinding<Schema>,
    position: BindingPosition
  )
  case removeInterfaceBinding(linkID: Schema.LinkID, externalPort: PortKey)
  case updateInterfaceBinding(
    linkID: Schema.LinkID,
    binding: FlowingSubgraphInterfaceBinding<Schema>
  )
  case addExternalPort(
    linkID: Schema.LinkID,
    portID: Schema.GraphSchema.PortID,
    value: Schema.GraphSchema.PortValue,
    position: PortPosition
  )
  case removeExternalPort(linkID: Schema.LinkID, portID: Schema.GraphSchema.PortID)
  case reorderExternalPort(
    linkID: Schema.LinkID,
    portID: Schema.GraphSchema.PortID,
    position: PortPosition
  )
}

extension FlowingGraphDocumentEditAction: Equatable
where Schema.GraphSchema.PortValue: Equatable {}
extension FlowingGraphDocumentEditAction: Sendable
where
  Schema.LinkID: Sendable,
  Schema.GraphSchema.NodeID: Sendable,
  Schema.GraphSchema.PortID: Sendable,
  Schema.GraphSchema.PortValue: Sendable
{}

public struct FlowingGraphDocumentEditIntent<Schema: FlowingGraphCompositionSchema> {
  public let baseDocumentSnapshotID: FlowingGraphDocumentSnapshotID
  public let action: FlowingGraphDocumentEditAction<Schema>

  public init(
    baseDocumentSnapshotID: FlowingGraphDocumentSnapshotID,
    action: FlowingGraphDocumentEditAction<Schema>
  ) {
    self.baseDocumentSnapshotID = baseDocumentSnapshotID
    self.action = action
  }
}

extension FlowingGraphDocumentEditIntent: Equatable
where Schema.GraphSchema.PortValue: Equatable {}
extension FlowingGraphDocumentEditIntent: Sendable
where
  Schema.LinkID: Sendable,
  Schema.GraphSchema.NodeID: Sendable,
  Schema.GraphSchema.PortID: Sendable,
  Schema.GraphSchema.PortValue: Sendable
{}

public enum FlowingGraphInspectionIntent<Schema: FlowingGraphCompositionSchema> {
  case definition(
    documentSnapshotID: FlowingGraphDocumentSnapshotID,
    graphID: Schema.GraphID
  )
  case instance(
    documentSnapshotID: FlowingGraphDocumentSnapshotID,
    presentationSnapshotID: FlowingGraphPresentationSnapshotID,
    address: FlowingGraphInstanceAddress<Schema.GraphID, Schema.GraphSchema.NodeID>
  )
}

extension FlowingGraphInspectionIntent: Equatable {}
extension FlowingGraphInspectionIntent: Sendable
where Schema.GraphID: Sendable, Schema.GraphSchema.NodeID: Sendable {}

public enum FlowingGraphEditorIntent<Schema: FlowingGraphCompositionSchema> {
  case projection(FlowingGraphProjectionIntent<Schema>)
  case documentEdit(FlowingGraphDocumentEditIntent<Schema>)
  case inspection(FlowingGraphInspectionIntent<Schema>)
}

extension FlowingGraphEditorIntent: Equatable
where Schema.GraphSchema.PortValue: Equatable {}
extension FlowingGraphEditorIntent: Sendable
where
  Schema.GraphID: Sendable,
  Schema.LinkID: Sendable,
  Schema.GraphSchema.NodeID: Sendable,
  Schema.GraphSchema.PortID: Sendable,
  Schema.GraphSchema.PortValue: Sendable
{}
