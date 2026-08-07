import Foundation

public protocol FlowingGraphSchema {
  associatedtype NodeID: Hashable
  associatedtype NodeValue
  associatedtype PortID: Hashable
  associatedtype PortValue
  associatedtype EdgeID: Hashable
  associatedtype EdgeValue
}

public struct FlowingGraphSnapshotID: Hashable, Sendable {
  private let rawValue = UUID()
}

public struct FlowingGraphPresentationSnapshotID: Hashable, Sendable {
  private let rawValue = UUID()

  public init() {}
}

public struct FlowingGraphPortKey<Schema: FlowingGraphSchema>: Hashable {
  public let nodeID: Schema.NodeID
  public let portID: Schema.PortID

  public init(nodeID: Schema.NodeID, portID: Schema.PortID) {
    self.nodeID = nodeID
    self.portID = portID
  }
}

extension FlowingGraphPortKey: Sendable
where Schema.NodeID: Sendable, Schema.PortID: Sendable {}

public enum FlowingGraphEndpoint<Schema: FlowingGraphSchema>: Hashable {
  case node(Schema.NodeID)
  case port(FlowingGraphPortKey<Schema>)
}

extension FlowingGraphEndpoint: Sendable
where Schema.NodeID: Sendable, Schema.PortID: Sendable {}

public enum FlowingGraphEdgeEndpoints<Schema: FlowingGraphSchema>: Equatable {
  case directed(
    source: FlowingGraphEndpoint<Schema>,
    target: FlowingGraphEndpoint<Schema>
  )
  case undirected(FlowingGraphEndpoint<Schema>, FlowingGraphEndpoint<Schema>)

  public static func == (
    lhs: FlowingGraphEdgeEndpoints,
    rhs: FlowingGraphEdgeEndpoints
  ) -> Bool {
    switch (lhs, rhs) {
    case (.directed(let leftSource, let leftTarget), .directed(let rightSource, let rightTarget)):
      leftSource == rightSource && leftTarget == rightTarget
    case (.undirected(let leftFirst, let leftSecond), .undirected(let rightFirst, let rightSecond)):
      (leftFirst == rightFirst && leftSecond == rightSecond)
        || (leftFirst == rightSecond && leftSecond == rightFirst)
    default:
      false
    }
  }
}

extension FlowingGraphEdgeEndpoints: Sendable
where Schema.NodeID: Sendable, Schema.PortID: Sendable {}

public struct FlowingGraphNode<Schema: FlowingGraphSchema> {
  public let id: Schema.NodeID
  public var value: Schema.NodeValue

  public init(id: Schema.NodeID, value: Schema.NodeValue) {
    self.id = id
    self.value = value
  }
}

extension FlowingGraphNode: Equatable where Schema.NodeValue: Equatable {}
extension FlowingGraphNode: Sendable
where Schema.NodeID: Sendable, Schema.NodeValue: Sendable {}

public struct FlowingGraphPort<Schema: FlowingGraphSchema> {
  public let key: FlowingGraphPortKey<Schema>
  public var value: Schema.PortValue

  public init(key: FlowingGraphPortKey<Schema>, value: Schema.PortValue) {
    self.key = key
    self.value = value
  }
}

extension FlowingGraphPort: Equatable where Schema.PortValue: Equatable {}
extension FlowingGraphPort: Sendable
where Schema.NodeID: Sendable, Schema.PortID: Sendable, Schema.PortValue: Sendable {}

public struct FlowingGraphEdge<Schema: FlowingGraphSchema> {
  public let id: Schema.EdgeID
  public var endpoints: FlowingGraphEdgeEndpoints<Schema>
  public var value: Schema.EdgeValue

  public init(
    id: Schema.EdgeID,
    endpoints: FlowingGraphEdgeEndpoints<Schema>,
    value: Schema.EdgeValue
  ) {
    self.id = id
    self.endpoints = endpoints
    self.value = value
  }
}

extension FlowingGraphEdge: Equatable where Schema.EdgeValue: Equatable {}
extension FlowingGraphEdge: Sendable
where
  Schema.NodeID: Sendable,
  Schema.PortID: Sendable,
  Schema.EdgeID: Sendable,
  Schema.EdgeValue: Sendable
{}

public enum FlowingGraphOrderPosition<ID: Hashable>: Hashable {
  case first
  case last
  case before(ID)
  case after(ID)
}

extension FlowingGraphOrderPosition: Sendable where ID: Sendable {}

public struct FlowingGraphDefinitionNodeAddress<
  GraphID: Hashable,
  NodeID: Hashable
>: Hashable {
  public let graphID: GraphID
  public let nodeID: NodeID

  public init(graphID: GraphID, nodeID: NodeID) {
    self.graphID = graphID
    self.nodeID = nodeID
  }
}

extension FlowingGraphDefinitionNodeAddress: Sendable
where GraphID: Sendable, NodeID: Sendable {}

public struct FlowingGraphInstancePath<GraphID: Hashable, NodeID: Hashable>: Hashable {
  public let components: [FlowingGraphDefinitionNodeAddress<GraphID, NodeID>]

  public init(components: [FlowingGraphDefinitionNodeAddress<GraphID, NodeID>]) {
    self.components = components
  }

  public static var root: Self {
    Self(components: [])
  }
}

extension FlowingGraphInstancePath: Sendable
where GraphID: Sendable, NodeID: Sendable {}

public enum FlowingGraphLocalElementID<Schema: FlowingGraphSchema>: Hashable {
  case node(Schema.NodeID)
  case port(FlowingGraphPortKey<Schema>)
  case edge(Schema.EdgeID)
}

extension FlowingGraphLocalElementID: Sendable
where Schema.NodeID: Sendable, Schema.PortID: Sendable, Schema.EdgeID: Sendable {}

public struct FlowingGraphElementAddress<
  GraphID: Hashable,
  Schema: FlowingGraphSchema
>: Hashable {
  public let instancePath: FlowingGraphInstancePath<GraphID, Schema.NodeID>
  public let graphID: GraphID
  public let elementID: FlowingGraphLocalElementID<Schema>

  public init(
    instancePath: FlowingGraphInstancePath<GraphID, Schema.NodeID>,
    graphID: GraphID,
    elementID: FlowingGraphLocalElementID<Schema>
  ) {
    self.instancePath = instancePath
    self.graphID = graphID
    self.elementID = elementID
  }
}

extension FlowingGraphElementAddress: Sendable
where
  GraphID: Sendable,
  Schema.NodeID: Sendable,
  Schema.PortID: Sendable,
  Schema.EdgeID: Sendable
{}

public enum FlowingPresentationElementID<
  GraphID: Hashable,
  Schema: FlowingGraphSchema,
  OccurrenceID: Hashable,
  SyntheticRole: Hashable
>: Hashable {
  public typealias Address = FlowingGraphElementAddress<GraphID, Schema>

  case source(address: Address, occurrenceID: OccurrenceID?)
  case synthetic(
    role: SyntheticRole,
    sourceAddresses: [Address],
    occurrenceID: OccurrenceID?
  )
}

extension FlowingPresentationElementID: Sendable
where
  GraphID: Sendable,
  Schema.NodeID: Sendable,
  Schema.PortID: Sendable,
  Schema.EdgeID: Sendable,
  OccurrenceID: Sendable,
  SyntheticRole: Sendable
{}
