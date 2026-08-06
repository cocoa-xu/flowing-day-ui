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

extension FlowingGraphLayoutInput {
  public func validateDAG() -> FlowingGraphLayoutDAGValidationResult<Schema> {
    switch topology.materializedGraph().validateDAG() {
    case .valid(let view):
      return .valid(
        FlowingGraphLayoutDAGView(
          input: self,
          topologicalNodeIDs: view.topologicalNodeIDs
        )
      )
    case .invalid(.cycle(let edgePath)):
      return .invalid(.cycle(edgePath: edgePath))
    case .invalid(.undirectedEdges(let edgeIDs)):
      return .invalid(.undirectedEdges(edgeIDs))
    }
  }
}
