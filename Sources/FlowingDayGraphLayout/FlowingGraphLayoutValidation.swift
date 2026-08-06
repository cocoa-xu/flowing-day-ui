import FlowingDayGraphCore

public enum FlowingGraphLayoutDAGValidationIssue<
  Schema: FlowingGraphLayoutSchema
>: Error, Equatable, Sendable {
  case cycle(edgePath: [Schema.EdgeID])
  case undirectedEdges([Schema.EdgeID])
}

public struct FlowingGraphLayoutDAGView<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let input: FlowingGraphLayoutInput<Schema>
  public let topologicalNodeIDs: [Schema.NodeID]

  public var snapshotID: FlowingGraphPresentationSnapshotID {
    input.topology.snapshotID
  }

  init(
    input: FlowingGraphLayoutInput<Schema>,
    topologicalNodeIDs: [Schema.NodeID]
  ) {
    self.input = input
    self.topologicalNodeIDs = topologicalNodeIDs
  }
}

public enum FlowingGraphLayoutDAGValidationResult<
  Schema: FlowingGraphLayoutSchema
>: Sendable {
  case valid(FlowingGraphLayoutDAGView<Schema>)
  case invalid(FlowingGraphLayoutDAGValidationIssue<Schema>)
}

public extension FlowingGraphLayoutInput {
  func validateDAG() -> FlowingGraphLayoutDAGValidationResult<Schema> {
    var graph = FlowingGraph<FlowingLayoutValidationSchema<Schema>>()
    let result = graph.update { transaction in
      for nodeID in topology.nodeIDs {
        transaction.insert(FlowingGraphNode(id: nodeID, value: ()))
      }
      for port in topology.ports {
        transaction.insert(
          FlowingGraphPort(
            key: FlowingGraphPortKey(nodeID: port.nodeID, portID: port.id),
            value: ()
          )
        )
      }
      for edge in topology.edges {
        transaction.insert(
          FlowingGraphEdge(
            id: edge.id,
            endpoints: edge.endpoints.coreEndpoints(topology: topology),
            value: ()
          )
        )
      }
    }
    guard case .committed = result else {
      preconditionFailure("Validated layout topology failed graph materialization")
    }

    switch graph.validateDAG() {
    case let .valid(view):
      return .valid(
        FlowingGraphLayoutDAGView(
          input: self,
          topologicalNodeIDs: view.topologicalNodeIDs
        )
      )
    case let .invalid(.cycle(edgePath)):
      return .invalid(.cycle(edgePath: edgePath))
    case let .invalid(.undirectedEdges(edgeIDs)):
      return .invalid(.undirectedEdges(edgeIDs))
    }
  }
}

private enum FlowingLayoutValidationSchema<
  LayoutSchema: FlowingGraphLayoutSchema
>: FlowingGraphSchema {
  typealias NodeID = LayoutSchema.NodeID
  typealias NodeValue = Void
  typealias PortID = LayoutSchema.PortID
  typealias PortValue = Void
  typealias EdgeID = LayoutSchema.EdgeID
  typealias EdgeValue = Void
}

private extension FlowingGraphLayoutEdgeEndpoints {
  typealias ValidationSchema = FlowingLayoutValidationSchema<Schema>

  func coreEndpoints(
    topology: FlowingGraphLayoutTopology<Schema>
  ) -> FlowingGraphEdgeEndpoints<ValidationSchema> {
    switch self {
    case let .directed(source, target):
      .directed(
        source: source.coreEndpoint(topology: topology),
        target: target.coreEndpoint(topology: topology)
      )
    case let .undirected(first, second):
      .undirected(
        first.coreEndpoint(topology: topology),
        second.coreEndpoint(topology: topology)
      )
    }
  }
}

private extension FlowingGraphLayoutEndpoint {
  typealias ValidationSchema = FlowingLayoutValidationSchema<Schema>

  func coreEndpoint(
    topology: FlowingGraphLayoutTopology<Schema>
  ) -> FlowingGraphEndpoint<ValidationSchema> {
    switch self {
    case let .node(nodeID):
      .node(nodeID)
    case let .port(key):
      .port(
        FlowingGraphPortKey(
          nodeID: key.nodeID,
          portID: key.portID
        )
      )
    }
  }
}
