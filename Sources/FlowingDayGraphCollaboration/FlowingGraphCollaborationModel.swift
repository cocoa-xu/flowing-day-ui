import CoreGraphics
import FlowingDayGraphComposition
import FlowingDayGraphCore
import Foundation

public protocol FlowingGraphCollaborationSchema: FlowingGraphCompositionSchema
where
  DocumentID: Sendable,
  GraphID: Sendable,
  EntryPointID: Sendable,
  LinkID: Sendable,
  LinkValue: Equatable & Sendable,
  GraphSchema.NodeID: Sendable,
  GraphSchema.NodeValue: Equatable & Sendable,
  GraphSchema.PortID: Sendable,
  GraphSchema.PortValue: Equatable & Sendable,
  GraphSchema.EdgeID: Sendable,
  GraphSchema.EdgeValue: Equatable & Sendable
{}

public enum FlowingGraphCollaborationOperationSchema<
  GraphSchema: FlowingGraphCollaborationSchema
>: FlowingCollaborationSchema {
  public typealias DocumentID = GraphSchema.DocumentID
  public typealias Command = FlowingGraphCollaborationCommand<GraphSchema>
}

public enum FlowingGraphCollaborationCommand<Schema: FlowingGraphCollaborationSchema>:
  Equatable,
  Sendable
{
  public typealias NodeAddress = FlowingGraphDefinitionNodeAddress<
    Schema.GraphID,
    Schema.GraphSchema.NodeID
  >

  case insertDefinition(
    id: Schema.GraphID,
    position: FlowingCollaborationSequencePosition
  )
  case removeDefinition(id: Schema.GraphID)
  case reorderDefinition(
    id: Schema.GraphID,
    position: FlowingCollaborationSequencePosition
  )
  case insertEntryPoint(
    FlowingGraphEntryPoint<Schema>,
    position: FlowingCollaborationSequencePosition
  )
  case updateEntryPoint(FlowingGraphEntryPoint<Schema>)
  case removeEntryPoint(id: Schema.EntryPointID)
  case reorderEntryPoint(
    id: Schema.EntryPointID,
    position: FlowingCollaborationSequencePosition
  )
  case setDefaultEntryPoint(id: Schema.EntryPointID)
  case insertSubgraphLink(
    FlowingSubgraphLink<Schema>,
    position: FlowingCollaborationSequencePosition
  )
  case updateSubgraphLink(FlowingSubgraphLink<Schema>)
  case removeSubgraphLink(id: Schema.LinkID)
  case reorderSubgraphLink(
    id: Schema.LinkID,
    position: FlowingCollaborationSequencePosition
  )
  case insertNode(
    graphID: Schema.GraphID,
    node: FlowingGraphNode<Schema.GraphSchema>,
    position: FlowingCollaborationSequencePosition
  )
  case updateNode(
    graphID: Schema.GraphID,
    node: FlowingGraphNode<Schema.GraphSchema>
  )
  case compareAndSetNode(
    graphID: Schema.GraphID,
    expected: FlowingGraphNode<Schema.GraphSchema>,
    replacement: FlowingGraphNode<Schema.GraphSchema>
  )
  case removeNode(graphID: Schema.GraphID, id: Schema.GraphSchema.NodeID)
  case reorderNode(
    graphID: Schema.GraphID,
    id: Schema.GraphSchema.NodeID,
    position: FlowingCollaborationSequencePosition
  )
  case insertPort(
    graphID: Schema.GraphID,
    port: FlowingGraphPort<Schema.GraphSchema>,
    position: FlowingCollaborationSequencePosition
  )
  case updatePort(
    graphID: Schema.GraphID,
    port: FlowingGraphPort<Schema.GraphSchema>
  )
  case removePort(
    graphID: Schema.GraphID,
    key: FlowingGraphPortKey<Schema.GraphSchema>
  )
  case reorderPort(
    graphID: Schema.GraphID,
    key: FlowingGraphPortKey<Schema.GraphSchema>,
    position: FlowingCollaborationSequencePosition
  )
  case insertEdge(
    graphID: Schema.GraphID,
    edge: FlowingGraphEdge<Schema.GraphSchema>,
    position: FlowingCollaborationSequencePosition
  )
  case updateEdge(
    graphID: Schema.GraphID,
    edge: FlowingGraphEdge<Schema.GraphSchema>
  )
  case removeEdge(graphID: Schema.GraphID, id: Schema.GraphSchema.EdgeID)
  case reorderEdge(
    graphID: Schema.GraphID,
    id: Schema.GraphSchema.EdgeID,
    position: FlowingCollaborationSequencePosition
  )
  case setSharedNodePlacement(address: NodeAddress, position: CGPoint)
  case translateSharedNodePlacement(address: NodeAddress, delta: CGSize)
  case clearSharedNodePlacement(address: NodeAddress)
  case compareAndSetSharedNodePlacement(
    address: NodeAddress,
    expected: CGPoint?,
    replacement: CGPoint?
  )
}

public enum FlowingGraphCollaborationElement<Schema: FlowingGraphCollaborationSchema>:
  Hashable,
  Sendable
{
  case definition(Schema.GraphID)
  case entryPoint(Schema.EntryPointID)
  case subgraphLink(Schema.LinkID)
  case graphElement(
    graphID: Schema.GraphID,
    elementID: FlowingGraphLocalElementID<Schema.GraphSchema>
  )
}

public enum FlowingGraphCollaborationFailure<Schema: FlowingGraphCollaborationSchema>:
  Error,
  Equatable,
  Sendable
{
  case duplicateElement(FlowingGraphCollaborationElement<Schema>)
  case tombstonedElement(FlowingGraphCollaborationElement<Schema>)
  case unknownElement(FlowingGraphCollaborationElement<Schema>)
  case duplicatePosition
  case sequenceKeyLimitExceeded(maximum: Int, actual: Int)
  case graphMutation(
    graphID: Schema.GraphID,
    issue: FlowingGraphMutationIssue<Schema.GraphSchema>
  )
  case documentValidation([FlowingGraphDocumentValidationIssue<Schema>])
  case compareAndSetConflict(FlowingGraphCollaborationElement<Schema>)
  case placementConflict(
    FlowingGraphDefinitionNodeAddress<Schema.GraphID, Schema.GraphSchema.NodeID>
  )
}

public struct FlowingGraphCollaborationState<Schema: FlowingGraphCollaborationSchema>:
  Sendable
{
  public internal(set) var document: FlowingGraphDocument<Schema>
  public internal(set) var sharedNodePlacements:
    [FlowingGraphDefinitionNodeAddress<Schema.GraphID, Schema.GraphSchema.NodeID>: CGPoint]

  var definitionPositions: [Schema.GraphID: FlowingCollaborationSequencePosition]
  var entryPointPositions: [Schema.EntryPointID: FlowingCollaborationSequencePosition]
  var subgraphLinkPositions: [Schema.LinkID: FlowingCollaborationSequencePosition]
  var nodePositions:
    [Schema.GraphID: [Schema.GraphSchema.NodeID: FlowingCollaborationSequencePosition]]
  var portPositions:
    [Schema.GraphID: [FlowingGraphPortKey<Schema.GraphSchema>:
      FlowingCollaborationSequencePosition]]
  var edgePositions:
    [Schema.GraphID: [Schema.GraphSchema.EdgeID: FlowingCollaborationSequencePosition]]
  var tombstonedDefinitions: Set<Schema.GraphID> = []
  var tombstonedEntryPoints: Set<Schema.EntryPointID> = []
  var tombstonedSubgraphLinks: Set<Schema.LinkID> = []
  var tombstonedGraphElements:
    [Schema.GraphID: Set<FlowingGraphLocalElementID<Schema.GraphSchema>>] = [:]

  public init(
    document: FlowingGraphDocument<Schema>,
    sharedNodePlacements: [FlowingGraphDefinitionNodeAddress<
      Schema.GraphID, Schema.GraphSchema.NodeID
    >: CGPoint] = [:]
  ) throws {
    let issues = FlowingGraphDocumentValidator.issues(in: document)
    guard issues.isEmpty else {
      throw FlowingGraphCollaborationFailure<Schema>.documentValidation(issues)
    }
    self.document = document
    self.sharedNodePlacements = sharedNodePlacements
    definitionPositions = try Self.initialPositions(document.definitions.map(\.id))
    entryPointPositions = try Self.initialPositions(document.entryPoints.map(\.id))
    subgraphLinkPositions = try Self.initialPositions(document.subgraphLinks.map(\.id))
    nodePositions = [:]
    portPositions = [:]
    edgePositions = [:]
    for definition in document.definitions {
      nodePositions[definition.id] = try Self.initialPositions(definition.graph.nodeIDs)
      portPositions[definition.id] = try Self.initialPositions(definition.graph.portKeys)
      edgePositions[definition.id] = try Self.initialPositions(definition.graph.edgeIDs)
    }
  }

  private static func initialPositions<ID: Hashable & Sendable>(
    _ ids: [ID]
  ) throws -> [ID: FlowingCollaborationSequencePosition] {
    let replicaID = FlowingReplicaID(
      UUID(uuidString: "00000000-0000-0000-0000-00000000C011")!
    )
    var result: [ID: FlowingCollaborationSequencePosition] = [:]
    result.reserveCapacity(ids.count)
    var lower: FlowingCollaborationSequencePosition?
    for (index, id) in ids.enumerated() {
      let counter = UInt64(index) + 1
      let position = try FlowingCollaborationSequence.position(
        between: lower,
        and: nil,
        discriminator: .init(
          operationID: .init(replicaID: replicaID, counter: counter),
          commandIndex: 0
        )
      )
      result[id] = position
      lower = position
    }
    return result
  }
}
