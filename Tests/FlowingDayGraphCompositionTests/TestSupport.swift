import FlowingDayGraphComposition
import FlowingDayGraphCore

enum TestGraphSchema: FlowingGraphSchema {
  typealias NodeID = String
  typealias NodeValue = String
  typealias PortID = String
  typealias PortValue = String
  typealias EdgeID = String
  typealias EdgeValue = String
}

enum TestCompositionSchema: FlowingGraphCompositionSchema {
  typealias DocumentID = String
  typealias GraphID = String
  typealias EntryPointID = String
  typealias LinkID = String
  typealias LinkValue = String
  typealias GraphSchema = TestGraphSchema
}

typealias TestGraph = FlowingGraph<TestGraphSchema>
typealias TestDocument = FlowingGraphDocument<TestCompositionSchema>
typealias TestLink = FlowingSubgraphLink<TestCompositionSchema>
typealias TestSite = FlowingGraphInstanceNodeAddress<String, String>
typealias TestInstance = FlowingGraphInstanceAddress<String, String>

func makeGraph(
  nodes: [String],
  ports: [FlowingGraphPort<TestGraphSchema>] = [],
  edges: [FlowingGraphEdge<TestGraphSchema>] = []
) -> TestGraph {
  var graph = TestGraph()
  let result = graph.update { transaction in
    for nodeID in nodes {
      transaction.insert(FlowingGraphNode(id: nodeID, value: nodeID))
    }
    for port in ports {
      transaction.insert(port)
    }
    for edge in edges {
      transaction.insert(edge)
    }
  }
  guard case .committed = result else {
    preconditionFailure("Invalid test graph")
  }
  return graph
}

func makeDefinition(
  _ id: String,
  nodes: [String]
) -> FlowingGraphDefinition<TestCompositionSchema> {
  FlowingGraphDefinition(id: id, graph: makeGraph(nodes: nodes))
}

func makeLink(
  _ id: String,
  from graphID: String,
  nodeID: String,
  to targetGraphID: String,
  ownership: FlowingSubgraphOwnership = .reference
) -> TestLink {
  FlowingSubgraphLink(
    id: id,
    site: FlowingGraphDefinitionNodeAddress(graphID: graphID, nodeID: nodeID),
    ownership: ownership,
    targetGraphID: targetGraphID,
    value: id
  )
}

func makeDocument(
  defaultEntryPointID: String = "main",
  entryPoints: [FlowingGraphEntryPoint<TestCompositionSchema>]? = nil,
  definitions: [FlowingGraphDefinition<TestCompositionSchema>],
  links: [TestLink] = []
) -> TestDocument {
  TestDocument(
    id: "document",
    defaultEntryPointID: defaultEntryPointID,
    entryPoints: entryPoints ?? [
      FlowingGraphEntryPoint(id: "main", name: "Main", graphID: definitions[0].id)
    ],
    definitions: definitions,
    subgraphLinks: links
  )
}

func instance(
  graphID: String,
  components: [(graphID: String, nodeID: String)] = []
) -> TestInstance {
  FlowingGraphInstanceAddress(
    path: FlowingGraphInstancePath(
      components: components.map {
        FlowingGraphDefinitionNodeAddress(graphID: $0.graphID, nodeID: $0.nodeID)
      }
    ),
    graphID: graphID
  )
}

func site(
  graphID: String,
  nodeID: String,
  components: [(graphID: String, nodeID: String)] = []
) -> TestSite {
  FlowingGraphInstanceNodeAddress(
    instance: instance(graphID: graphID, components: components),
    nodeID: nodeID
  )
}
