import FlowingDayGraphComposition
import FlowingDayGraphCore

enum ShowcaseDocumentFactory {
  typealias Schema = ShowcaseCanvasSchema
  typealias GraphSchema = ShowcaseGraphSchema

  static func document(
    layoutStyle: ShowcaseLayoutStyle,
    externalPortOrder: [String],
    externalPortValues: [String: String],
    bindingOrder: [String],
    bindings: [String: FlowingGraphEndpoint<GraphSchema>]
  ) -> FlowingGraphDocument<Schema> {
    let externalPorts = externalPortOrder.compactMap { portID in
      externalPortValues[portID].map {
        FlowingGraphPort<GraphSchema>(
          key: FlowingGraphPortKey(nodeID: "subgraph", portID: portID),
          value: $0
        )
      }
    }
    var rootEdges: [FlowingGraphEdge<GraphSchema>] = []
    if externalPortValues["input"] != nil {
      rootEdges.append(
        FlowingGraphEdge(
          id: "source-to-subgraph",
          endpoints: .directed(
            source: .node("node-a"),
            target: .port(FlowingGraphPortKey(nodeID: "subgraph", portID: "input"))
          ),
          value: "Directed"
        )
      )
    }
    if externalPortValues["output"] != nil {
      let output = FlowingGraphEndpoint<GraphSchema>.port(
        FlowingGraphPortKey(nodeID: "subgraph", portID: "output")
      )
      let sink = FlowingGraphEndpoint<GraphSchema>.node("node-b")
      rootEdges.append(
        FlowingGraphEdge(
          id: "subgraph-to-sink",
          endpoints: layoutStyle == .mixed
            ? .undirected(output, sink)
            : .directed(source: output, target: sink),
          value: layoutStyle == .mixed ? "Undirected" : "Directed"
        )
      )
    }
    if layoutStyle == .cyclic {
      rootEdges.append(
        FlowingGraphEdge(
          id: "feedback",
          endpoints: .directed(source: .node("node-b"), target: .node("node-a")),
          value: "Feedback"
        )
      )
    }

    let root = graph(
      nodes: ["node-a", "subgraph", "node-b"],
      ports: externalPorts,
      edges: rootEdges
    )
    let inputPort = FlowingGraphPort<GraphSchema>(
      key: FlowingGraphPortKey(nodeID: "input", portID: "input"),
      value: "Input"
    )
    let outputPort = FlowingGraphPort<GraphSchema>(
      key: FlowingGraphPortKey(nodeID: "output", portID: "output"),
      value: "Output"
    )
    let inputEndpoint = FlowingGraphEndpoint<GraphSchema>.port(inputPort.key)
    let outputEndpoint = FlowingGraphEndpoint<GraphSchema>.port(outputPort.key)
    let childEdges: [FlowingGraphEdge<GraphSchema>] =
      [
        FlowingGraphEdge(
          id: "input-to-node-c",
          endpoints: .directed(source: inputEndpoint, target: .node("node-c")),
          value: "Directed"
        ),
        FlowingGraphEdge(
          id: "node-c-to-output",
          endpoints: layoutStyle == .mixed
            ? .undirected(.node("node-c"), outputEndpoint)
            : .directed(source: .node("node-c"), target: outputEndpoint),
          value: layoutStyle == .mixed ? "Undirected" : "Directed"
        ),
      ]
      + (layoutStyle == .cyclic
        ? [
          FlowingGraphEdge(
            id: "child-feedback",
            endpoints: .directed(source: outputEndpoint, target: inputEndpoint),
            value: "Feedback"
          )
        ]
        : [])
    let child = graph(
      nodes: ["input", "node-c", "output"],
      ports: [inputPort, outputPort],
      edges: childEdges
    )
    let interfaceBindings = bindingOrder.compactMap { portID in
      bindings[portID].map {
        FlowingSubgraphInterfaceBinding<Schema>(
          externalPort: FlowingGraphPortKey(nodeID: "subgraph", portID: portID),
          internalEndpoint: $0
        )
      }
    }
    return FlowingGraphDocument(
      id: "graph-canvas-showcase",
      defaultEntryPointID: "main",
      entryPoints: [FlowingGraphEntryPoint(id: "main", name: "Main", graphID: "root")],
      definitions: [
        FlowingGraphDefinition(id: "root", graph: root),
        FlowingGraphDefinition(id: "subgraph-definition", graph: child),
      ],
      subgraphLinks: [
        FlowingSubgraphLink(
          id: "subgraph-link",
          site: FlowingGraphDefinitionNodeAddress(graphID: "root", nodeID: "subgraph"),
          ownership: .owned,
          targetGraphID: "subgraph-definition",
          interface: FlowingSubgraphInterface(bindings: interfaceBindings),
          value: "Subgraph"
        )
      ]
    )
  }

  private static func graph(
    nodes: [String],
    ports: [FlowingGraphPort<GraphSchema>],
    edges: [FlowingGraphEdge<GraphSchema>]
  ) -> FlowingGraph<GraphSchema> {
    var graph = FlowingGraph<GraphSchema>()
    let result = graph.update { transaction in
      for nodeID in nodes {
        transaction.insert(FlowingGraphNode(id: nodeID, value: nodeTitle(nodeID)))
      }
      for port in ports {
        transaction.insert(port)
      }
      for edge in edges {
        transaction.insert(edge)
      }
    }
    guard case .committed = result else {
      preconditionFailure("The graph canvas example fixture is invalid")
    }
    return graph
  }

  private static func nodeTitle(_ nodeID: String) -> String {
    switch nodeID {
    case "node-a": "Node A"
    case "node-b": "Node B"
    case "node-c": "Node C"
    case "subgraph": "Subgraph"
    case "input": "Input"
    case "output": "Output"
    default: nodeID
    }
  }
}
