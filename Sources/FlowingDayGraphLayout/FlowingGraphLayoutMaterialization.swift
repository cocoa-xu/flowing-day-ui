import FlowingDayGraphCore

enum FlowingLayoutCoreSchema<LayoutSchema: FlowingGraphLayoutSchema>: FlowingGraphSchema {
  typealias NodeID = LayoutSchema.NodeID
  typealias NodeValue = Void
  typealias PortID = LayoutSchema.PortID
  typealias PortValue = Void
  typealias EdgeID = LayoutSchema.EdgeID
  typealias EdgeValue = Void
}

extension FlowingGraphLayoutTopology {
  func materializedGraph() -> FlowingGraph<FlowingLayoutCoreSchema<Schema>> {
    var graph = FlowingGraph<FlowingLayoutCoreSchema<Schema>>()
    let result = graph.update { transaction in
      for nodeID in nodeIDs {
        transaction.insert(FlowingGraphNode(id: nodeID, value: ()))
      }
      for port in ports {
        transaction.insert(
          FlowingGraphPort(
            key: FlowingGraphPortKey(nodeID: port.nodeID, portID: port.id),
            value: ()
          )
        )
      }
      for edge in edges {
        transaction.insert(
          FlowingGraphEdge(
            id: edge.id,
            endpoints: edge.endpoints.coreEndpoints,
            value: ()
          )
        )
      }
    }
    guard case .committed = result else {
      preconditionFailure("Validated layout topology failed graph materialization")
    }
    return graph
  }
}

extension FlowingGraphLayoutEdgeEndpoints {
  fileprivate typealias CoreSchema = FlowingLayoutCoreSchema<Schema>

  fileprivate var coreEndpoints: FlowingGraphEdgeEndpoints<CoreSchema> {
    switch self {
    case .directed(let source, let target):
      .directed(source: source.coreEndpoint, target: target.coreEndpoint)
    case .undirected(let first, let second):
      .undirected(first.coreEndpoint, second.coreEndpoint)
    }
  }
}

extension FlowingGraphLayoutEndpoint {
  fileprivate typealias CoreSchema = FlowingLayoutCoreSchema<Schema>

  fileprivate var coreEndpoint: FlowingGraphEndpoint<CoreSchema> {
    switch self {
    case .node(let nodeID):
      .node(nodeID)
    case .port(let key):
      .port(FlowingGraphPortKey(nodeID: key.nodeID, portID: key.portID))
    }
  }
}
