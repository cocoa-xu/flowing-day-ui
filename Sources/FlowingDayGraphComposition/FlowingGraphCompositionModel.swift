import FlowingDayGraphCore
import Foundation

public protocol FlowingGraphCompositionSchema {
  associatedtype DocumentID: Hashable
  associatedtype GraphID: Hashable
  associatedtype EntryPointID: Hashable
  associatedtype LinkID: Hashable
  associatedtype LinkValue
  associatedtype OccurrenceID: Hashable = Never
  associatedtype GraphSchema: FlowingGraphSchema
}

public struct FlowingGraphDocumentSnapshotID: Hashable, Sendable {
  private let rawValue = UUID()

  public init() {}
}

public struct FlowingGraphEntryPoint<Schema: FlowingGraphCompositionSchema> {
  public let id: Schema.EntryPointID
  public let name: String
  public let graphID: Schema.GraphID

  public init(id: Schema.EntryPointID, name: String, graphID: Schema.GraphID) {
    self.id = id
    self.name = name
    self.graphID = graphID
  }
}

extension FlowingGraphEntryPoint: Equatable {}
extension FlowingGraphEntryPoint: Sendable
where Schema.EntryPointID: Sendable, Schema.GraphID: Sendable {}

public struct FlowingGraphDefinition<Schema: FlowingGraphCompositionSchema> {
  public let id: Schema.GraphID
  public let graph: FlowingGraph<Schema.GraphSchema>

  public init(id: Schema.GraphID, graph: FlowingGraph<Schema.GraphSchema>) {
    self.id = id
    self.graph = graph
  }
}

extension FlowingGraphDefinition: Sendable
where
  Schema.GraphID: Sendable,
  Schema.GraphSchema.NodeID: Sendable,
  Schema.GraphSchema.NodeValue: Sendable,
  Schema.GraphSchema.PortID: Sendable,
  Schema.GraphSchema.PortValue: Sendable,
  Schema.GraphSchema.EdgeID: Sendable,
  Schema.GraphSchema.EdgeValue: Sendable
{}

public enum FlowingSubgraphOwnership: Hashable, Sendable {
  case owned
  case reference
}

public struct FlowingSubgraphLink<Schema: FlowingGraphCompositionSchema> {
  public typealias Site = FlowingGraphDefinitionNodeAddress<
    Schema.GraphID,
    Schema.GraphSchema.NodeID
  >

  public let id: Schema.LinkID
  public let site: Site
  public let ownership: FlowingSubgraphOwnership
  public let targetGraphID: Schema.GraphID
  public let value: Schema.LinkValue

  public init(
    id: Schema.LinkID,
    site: Site,
    ownership: FlowingSubgraphOwnership,
    targetGraphID: Schema.GraphID,
    value: Schema.LinkValue
  ) {
    self.id = id
    self.site = site
    self.ownership = ownership
    self.targetGraphID = targetGraphID
    self.value = value
  }
}

extension FlowingSubgraphLink: Equatable where Schema.LinkValue: Equatable {}
extension FlowingSubgraphLink: Sendable
where
  Schema.LinkID: Sendable,
  Schema.GraphID: Sendable,
  Schema.GraphSchema.NodeID: Sendable,
  Schema.LinkValue: Sendable
{}

public struct FlowingGraphDocument<Schema: FlowingGraphCompositionSchema> {
  public let snapshotID: FlowingGraphDocumentSnapshotID
  public let id: Schema.DocumentID
  public let defaultEntryPointID: Schema.EntryPointID
  public let entryPoints: [FlowingGraphEntryPoint<Schema>]
  public let definitions: [FlowingGraphDefinition<Schema>]
  public let subgraphLinks: [FlowingSubgraphLink<Schema>]

  public init(
    snapshotID: FlowingGraphDocumentSnapshotID = .init(),
    id: Schema.DocumentID,
    defaultEntryPointID: Schema.EntryPointID,
    entryPoints: [FlowingGraphEntryPoint<Schema>],
    definitions: [FlowingGraphDefinition<Schema>],
    subgraphLinks: [FlowingSubgraphLink<Schema>]
  ) {
    self.snapshotID = snapshotID
    self.id = id
    self.defaultEntryPointID = defaultEntryPointID
    self.entryPoints = entryPoints
    self.definitions = definitions
    self.subgraphLinks = subgraphLinks
  }
}

extension FlowingGraphDocument: Sendable
where
  Schema.DocumentID: Sendable,
  Schema.GraphID: Sendable,
  Schema.EntryPointID: Sendable,
  Schema.LinkID: Sendable,
  Schema.LinkValue: Sendable,
  Schema.GraphSchema.NodeID: Sendable,
  Schema.GraphSchema.NodeValue: Sendable,
  Schema.GraphSchema.PortID: Sendable,
  Schema.GraphSchema.PortValue: Sendable,
  Schema.GraphSchema.EdgeID: Sendable,
  Schema.GraphSchema.EdgeValue: Sendable
{}

public struct FlowingGraphInstanceAddress<
  GraphID: Hashable,
  NodeID: Hashable
>: Hashable {
  public let path: FlowingGraphInstancePath<GraphID, NodeID>
  public let graphID: GraphID

  public init(path: FlowingGraphInstancePath<GraphID, NodeID>, graphID: GraphID) {
    self.path = path
    self.graphID = graphID
  }
}

extension FlowingGraphInstanceAddress: Sendable
where GraphID: Sendable, NodeID: Sendable {}

public struct FlowingGraphInstanceNodeAddress<
  GraphID: Hashable,
  NodeID: Hashable
>: Hashable {
  public let instance: FlowingGraphInstanceAddress<GraphID, NodeID>
  public let nodeID: NodeID

  public init(instance: FlowingGraphInstanceAddress<GraphID, NodeID>, nodeID: NodeID) {
    self.instance = instance
    self.nodeID = nodeID
  }
}

extension FlowingGraphInstanceNodeAddress: Sendable
where GraphID: Sendable, NodeID: Sendable {}

public struct FlowingGraphInstanceHandle: RawRepresentable, Hashable, Sendable {
  public let rawValue: Int

  public init(rawValue: Int) {
    self.rawValue = rawValue
  }
}

public enum FlowingGraphCompositionSyntheticRole<LinkID: Hashable>: Hashable {
  case subgraphContext(LinkID)
}

extension FlowingGraphCompositionSyntheticRole: Sendable where LinkID: Sendable {}

public typealias FlowingGraphCompositionElementID<Schema: FlowingGraphCompositionSchema> =
  FlowingPresentationElementID<
    Schema.GraphID,
    Schema.GraphSchema,
    Schema.OccurrenceID,
    FlowingGraphCompositionSyntheticRole<Schema.LinkID>
  >

public enum FlowingGraphPresentationLocalElementID<
  Schema: FlowingGraphCompositionSchema
>: Hashable {
  case source(
    instanceHandle: FlowingGraphInstanceHandle,
    elementID: FlowingGraphLocalElementID<Schema.GraphSchema>,
    occurrenceID: Schema.OccurrenceID?
  )
  case subgraphContext(
    instanceHandle: FlowingGraphInstanceHandle,
    linkID: Schema.LinkID
  )
}

extension FlowingGraphPresentationLocalElementID: Sendable
where
  Schema.LinkID: Sendable,
  Schema.OccurrenceID: Sendable,
  Schema.GraphSchema.NodeID: Sendable,
  Schema.GraphSchema.PortID: Sendable,
  Schema.GraphSchema.EdgeID: Sendable
{}

public struct FlowingGraphProjectionState<
  Schema: FlowingGraphCompositionSchema
>: Hashable {
  public typealias InstancePath = FlowingGraphInstancePath<
    Schema.GraphID,
    Schema.GraphSchema.NodeID
  >
  public typealias SiteAddress = FlowingGraphInstanceNodeAddress<
    Schema.GraphID,
    Schema.GraphSchema.NodeID
  >

  public let entryPointID: Schema.EntryPointID
  public let focusPath: InstancePath
  public let expandedSites: Set<SiteAddress>

  public init(
    entryPointID: Schema.EntryPointID,
    focusPath: InstancePath = .root,
    expandedSites: Set<SiteAddress> = []
  ) {
    self.entryPointID = entryPointID
    self.focusPath = focusPath
    self.expandedSites = expandedSites
  }
}

extension FlowingGraphProjectionState: Sendable
where
  Schema.EntryPointID: Sendable,
  Schema.GraphID: Sendable,
  Schema.GraphSchema.NodeID: Sendable
{}

public enum FlowingGraphProjectionBudgetDimension: Hashable, Sendable {
  case instances
  case depth
  case nodes
  case ports
  case edges
  case expansionWork
}

public struct FlowingGraphProjectionBudget: Hashable, Sendable {
  public let maxInstances: Int
  public let maxDepth: Int
  public let maxNodes: Int
  public let maxPorts: Int
  public let maxEdges: Int
  public let maxExpansionWork: Int

  public init(
    maxInstances: Int,
    maxDepth: Int,
    maxNodes: Int,
    maxPorts: Int,
    maxEdges: Int,
    maxExpansionWork: Int
  ) {
    self.maxInstances = maxInstances
    self.maxDepth = maxDepth
    self.maxNodes = maxNodes
    self.maxPorts = maxPorts
    self.maxEdges = maxEdges
    self.maxExpansionWork = maxExpansionWork
  }

  public static let standard = Self(
    maxInstances: 10_000,
    maxDepth: 64,
    maxNodes: 100_000,
    maxPorts: 200_000,
    maxEdges: 200_000,
    maxExpansionWork: 500_000
  )
}

public struct FlowingGraphPresentationInstance<Schema: FlowingGraphCompositionSchema> {
  public typealias Address = FlowingGraphInstanceAddress<
    Schema.GraphID,
    Schema.GraphSchema.NodeID
  >
  public typealias SiteAddress = FlowingGraphInstanceNodeAddress<
    Schema.GraphID,
    Schema.GraphSchema.NodeID
  >

  public let handle: FlowingGraphInstanceHandle
  public let address: Address
  public let parentSite: SiteAddress?
  public let parentInstanceHandle: FlowingGraphInstanceHandle?
  public let depth: Int
}

extension FlowingGraphPresentationInstance: Equatable {}
extension FlowingGraphPresentationInstance: Sendable
where Schema.GraphID: Sendable, Schema.GraphSchema.NodeID: Sendable {}

public struct FlowingGraphPresentationNode<Schema: FlowingGraphCompositionSchema> {
  public typealias ID = FlowingGraphCompositionElementID<Schema>
  public typealias Address = FlowingGraphElementAddress<Schema.GraphID, Schema.GraphSchema>

  public let id: ID
  public let localID: FlowingGraphPresentationLocalElementID<Schema>
  public let address: Address
  public let value: Schema.GraphSchema.NodeValue
}

extension FlowingGraphPresentationNode: Equatable
where Schema.GraphSchema.NodeValue: Equatable {}
extension FlowingGraphPresentationNode: Sendable
where
  Schema.GraphID: Sendable,
  Schema.LinkID: Sendable,
  Schema.OccurrenceID: Sendable,
  Schema.GraphSchema.NodeID: Sendable,
  Schema.GraphSchema.PortID: Sendable,
  Schema.GraphSchema.EdgeID: Sendable,
  Schema.GraphSchema.NodeValue: Sendable
{}

public struct FlowingGraphPresentationPort<Schema: FlowingGraphCompositionSchema> {
  public typealias ID = FlowingGraphCompositionElementID<Schema>
  public typealias Address = FlowingGraphElementAddress<Schema.GraphID, Schema.GraphSchema>

  public let id: ID
  public let localID: FlowingGraphPresentationLocalElementID<Schema>
  public let address: Address
  public let value: Schema.GraphSchema.PortValue
}

extension FlowingGraphPresentationPort: Equatable
where Schema.GraphSchema.PortValue: Equatable {}
extension FlowingGraphPresentationPort: Sendable
where
  Schema.GraphID: Sendable,
  Schema.LinkID: Sendable,
  Schema.OccurrenceID: Sendable,
  Schema.GraphSchema.NodeID: Sendable,
  Schema.GraphSchema.PortID: Sendable,
  Schema.GraphSchema.EdgeID: Sendable,
  Schema.GraphSchema.PortValue: Sendable
{}

public enum FlowingGraphPresentationEndpoint<Schema: FlowingGraphCompositionSchema>: Hashable {
  case node(FlowingGraphCompositionElementID<Schema>)
  case port(FlowingGraphCompositionElementID<Schema>)
}

extension FlowingGraphPresentationEndpoint: Sendable
where
  Schema.GraphID: Sendable,
  Schema.LinkID: Sendable,
  Schema.OccurrenceID: Sendable,
  Schema.GraphSchema.NodeID: Sendable,
  Schema.GraphSchema.PortID: Sendable,
  Schema.GraphSchema.EdgeID: Sendable
{}

public enum FlowingGraphPresentationEdgeEndpoints<
  Schema: FlowingGraphCompositionSchema
>: Equatable {
  case directed(
    source: FlowingGraphPresentationEndpoint<Schema>,
    target: FlowingGraphPresentationEndpoint<Schema>
  )
  case undirected(
    FlowingGraphPresentationEndpoint<Schema>,
    FlowingGraphPresentationEndpoint<Schema>
  )

  public static func == (
    lhs: FlowingGraphPresentationEdgeEndpoints,
    rhs: FlowingGraphPresentationEdgeEndpoints
  ) -> Bool {
    switch (lhs, rhs) {
    case let (.directed(leftSource, leftTarget), .directed(rightSource, rightTarget)):
      leftSource == rightSource && leftTarget == rightTarget
    case let (.undirected(leftFirst, leftSecond), .undirected(rightFirst, rightSecond)):
      (leftFirst == rightFirst && leftSecond == rightSecond) ||
        (leftFirst == rightSecond && leftSecond == rightFirst)
    default:
      false
    }
  }
}

extension FlowingGraphPresentationEdgeEndpoints: Sendable
where
  Schema.GraphID: Sendable,
  Schema.LinkID: Sendable,
  Schema.OccurrenceID: Sendable,
  Schema.GraphSchema.NodeID: Sendable,
  Schema.GraphSchema.PortID: Sendable,
  Schema.GraphSchema.EdgeID: Sendable
{}

public struct FlowingGraphPresentationEdge<Schema: FlowingGraphCompositionSchema> {
  public typealias ID = FlowingGraphCompositionElementID<Schema>
  public typealias Address = FlowingGraphElementAddress<Schema.GraphID, Schema.GraphSchema>

  public let id: ID
  public let localID: FlowingGraphPresentationLocalElementID<Schema>
  public let address: Address
  public let endpoints: FlowingGraphPresentationEdgeEndpoints<Schema>
  public let value: Schema.GraphSchema.EdgeValue
}

extension FlowingGraphPresentationEdge: Equatable
where Schema.GraphSchema.EdgeValue: Equatable {}
extension FlowingGraphPresentationEdge: Sendable
where
  Schema.GraphID: Sendable,
  Schema.LinkID: Sendable,
  Schema.OccurrenceID: Sendable,
  Schema.GraphSchema.NodeID: Sendable,
  Schema.GraphSchema.PortID: Sendable,
  Schema.GraphSchema.EdgeID: Sendable,
  Schema.GraphSchema.EdgeValue: Sendable
{}

public enum FlowingGraphSubgraphBoundaryReason<GraphID: Hashable>: Hashable {
  case collapsed
  case recursiveReference(GraphID)
  case budgetExceeded(FlowingGraphProjectionBudgetDimension)
}

extension FlowingGraphSubgraphBoundaryReason: Sendable where GraphID: Sendable {}

public enum FlowingGraphSubgraphContextState<Schema: FlowingGraphCompositionSchema> {
  public typealias InstanceAddress = FlowingGraphInstanceAddress<
    Schema.GraphID,
    Schema.GraphSchema.NodeID
  >

  case expanded(InstanceAddress)
  case boundary(FlowingGraphSubgraphBoundaryReason<Schema.GraphID>)
}

extension FlowingGraphSubgraphContextState: Equatable {}
extension FlowingGraphSubgraphContextState: Sendable
where Schema.GraphID: Sendable, Schema.GraphSchema.NodeID: Sendable {}

public struct FlowingGraphPresentationContextEdge<Schema: FlowingGraphCompositionSchema> {
  public typealias ID = FlowingGraphCompositionElementID<Schema>
  public typealias SiteAddress = FlowingGraphInstanceNodeAddress<
    Schema.GraphID,
    Schema.GraphSchema.NodeID
  >

  public let id: ID
  public let localID: FlowingGraphPresentationLocalElementID<Schema>
  public let linkID: Schema.LinkID
  public let sourceInstanceHandle: FlowingGraphInstanceHandle
  public let site: SiteAddress
  public let targetGraphID: Schema.GraphID
  public var targetInstanceHandle: FlowingGraphInstanceHandle?
  public var state: FlowingGraphSubgraphContextState<Schema>
}

extension FlowingGraphPresentationContextEdge: Equatable {}
extension FlowingGraphPresentationContextEdge: Sendable
where
  Schema.GraphID: Sendable,
  Schema.LinkID: Sendable,
  Schema.OccurrenceID: Sendable,
  Schema.GraphSchema.NodeID: Sendable,
  Schema.GraphSchema.PortID: Sendable,
  Schema.GraphSchema.EdgeID: Sendable
{}

public struct FlowingGraphPresentation<Schema: FlowingGraphCompositionSchema> {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  public let snapshotID: FlowingGraphPresentationSnapshotID
  public let documentSnapshotID: FlowingGraphDocumentSnapshotID
  public let entryPointID: Schema.EntryPointID
  public let focusPath: FlowingGraphInstancePath<Schema.GraphID, Schema.GraphSchema.NodeID>
  public let instances: [FlowingGraphPresentationInstance<Schema>]
  public let nodes: [FlowingGraphPresentationNode<Schema>]
  public let ports: [FlowingGraphPresentationPort<Schema>]
  public let edges: [FlowingGraphPresentationEdge<Schema>]
  public let contextEdges: [FlowingGraphPresentationContextEdge<Schema>]

  init(
    snapshotID: FlowingGraphPresentationSnapshotID = .init(),
    documentSnapshotID: FlowingGraphDocumentSnapshotID,
    entryPointID: Schema.EntryPointID,
    focusPath: FlowingGraphInstancePath<Schema.GraphID, Schema.GraphSchema.NodeID>,
    instances: [FlowingGraphPresentationInstance<Schema>],
    nodes: [FlowingGraphPresentationNode<Schema>],
    ports: [FlowingGraphPresentationPort<Schema>],
    edges: [FlowingGraphPresentationEdge<Schema>],
    contextEdges: [FlowingGraphPresentationContextEdge<Schema>]
  ) {
    self.snapshotID = snapshotID
    self.documentSnapshotID = documentSnapshotID
    self.entryPointID = entryPointID
    self.focusPath = focusPath
    self.instances = instances
    self.nodes = nodes
    self.ports = ports
    self.edges = edges
    self.contextEdges = contextEdges
  }
}

extension FlowingGraphPresentation: Sendable
where
  Schema.EntryPointID: Sendable,
  Schema.GraphID: Sendable,
  Schema.LinkID: Sendable,
  Schema.OccurrenceID: Sendable,
  Schema.GraphSchema.NodeID: Sendable,
  Schema.GraphSchema.NodeValue: Sendable,
  Schema.GraphSchema.PortID: Sendable,
  Schema.GraphSchema.PortValue: Sendable,
  Schema.GraphSchema.EdgeID: Sendable,
  Schema.GraphSchema.EdgeValue: Sendable
{}
