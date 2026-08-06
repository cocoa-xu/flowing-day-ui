import FlowingDayGraphCore

public enum FlowingGraphProjectionError<
  Schema: FlowingGraphCompositionSchema
>: Error, Equatable {
  public typealias DefinitionSite = FlowingGraphDefinitionNodeAddress<
    Schema.GraphID,
    Schema.GraphSchema.NodeID
  >

  case unknownEntryPoint(Schema.EntryPointID)
  case invalidFocusPath(componentIndex: Int, site: DefinitionSite)
  case invalidBudget(dimension: FlowingGraphProjectionBudgetDimension, value: Int)
  case rootExceedsBudget(
    dimension: FlowingGraphProjectionBudgetDimension,
    required: Int,
    limit: Int
  )
  case resourceCountOverflow(FlowingGraphProjectionBudgetDimension)
  case inconsistentValidatedDocument
}

extension FlowingGraphProjectionError: Sendable
where
  Schema.EntryPointID: Sendable,
  Schema.GraphID: Sendable,
  Schema.GraphSchema.NodeID: Sendable
{}

public struct FlowingGraphProjector<Schema: FlowingGraphCompositionSchema> {
  public let validatedDocument: FlowingValidatedGraphDocument<Schema>

  public init(validatedDocument: FlowingValidatedGraphDocument<Schema>) {
    self.validatedDocument = validatedDocument
  }

  public init(document: FlowingGraphDocument<Schema>) throws {
    validatedDocument = try FlowingGraphDocumentValidator.validate(document)
  }

  public func projectDefault(
    focusPath: FlowingGraphInstancePath<Schema.GraphID, Schema.GraphSchema.NodeID> = .root,
    expandedSites: Set<
      FlowingGraphInstanceNodeAddress<Schema.GraphID, Schema.GraphSchema.NodeID>
    > = [],
    budget: FlowingGraphProjectionBudget = .standard
  ) throws -> FlowingGraphPresentation<Schema> {
    try project(
      state: FlowingGraphProjectionState(
        entryPointID: validatedDocument.document.defaultEntryPointID,
        focusPath: focusPath,
        expandedSites: expandedSites
      ),
      budget: budget
    )
  }

  public func project(
    state: FlowingGraphProjectionState<Schema>,
    budget: FlowingGraphProjectionBudget = .standard
  ) throws -> FlowingGraphPresentation<Schema> {
    try validate(budget)
    guard let entryPoint = validatedDocument.index.entryPointsByID[state.entryPointID]
    else {
      throw FlowingGraphProjectionError<Schema>.unknownEntryPoint(state.entryPointID)
    }

    let focus = try resolveFocus(
      entryGraphID: entryPoint.graphID,
      path: state.focusPath
    )
    guard let rootDefinition = validatedDocument.index.definitionsByID[focus.graphID]
    else {
      throw FlowingGraphProjectionError<Schema>.inconsistentValidatedDocument
    }

    let rootCost = try directCost(of: rootDefinition)
    if let exceeded = rootCost.firstExceeded(budget: budget) {
      throw FlowingGraphProjectionError<Schema>.rootExceedsBudget(
        dimension: exceeded.dimension,
        required: exceeded.required,
        limit: exceeded.limit
      )
    }

    var builder = FlowingGraphPresentationBuilder<Schema>(
      documentSnapshotID: validatedDocument.document.snapshotID,
      entryPointID: state.entryPointID,
      focusPath: state.focusPath,
      counts: rootCost
    )
    var activeDefinitionCounts: [Schema.GraphID: Int] = [:]
    for graphID in focus.ancestorGraphIDs {
      activeDefinitionCounts[graphID, default: 0] += 1
    }

    let rootAddress = FlowingGraphInstanceAddress(
      path: state.focusPath,
      graphID: focus.graphID
    )
    let rootHandle = builder.allocateInstanceHandle()
    var work: [FlowingGraphProjectionWorkItem<Schema>] = [
      .enter(
        FlowingGraphPendingInstance(
          handle: rootHandle,
          address: rootAddress,
          parentSite: parentSite(for: rootAddress),
          parentInstanceHandle: nil,
          depth: 0
        )
      )
    ]

    while let item = work.popLast() {
      switch item {
      case let .enter(instance):
        guard let definition = validatedDocument.index.definitionsByID[
          instance.address.graphID
        ] else {
          throw FlowingGraphProjectionError<Schema>.inconsistentValidatedDocument
        }
        activeDefinitionCounts[instance.address.graphID, default: 0] += 1
        builder.append(instance: instance, definition: definition)

        let links = validatedDocument.index.linksBySourceGraphID[
          instance.address.graphID,
          default: []
        ]
        var expansions: [FlowingGraphPendingExpansion<Schema>] = []
        expansions.reserveCapacity(links.count)
        for link in links {
          let contextIndex = builder.appendContext(
            link: link,
            parentInstance: instance.address,
            parentInstanceHandle: instance.handle
          )
          expansions.append(
            FlowingGraphPendingExpansion(
              contextIndex: contextIndex,
              parentInstance: instance.address,
              parentInstanceHandle: instance.handle,
              link: link,
              childDepth: instance.depth + 1
            )
          )
        }

        work.append(.exit(instance.address.graphID))
        for expansion in expansions.reversed() {
          work.append(.expand(expansion))
        }

      case let .expand(expansion):
        let site = FlowingGraphInstanceNodeAddress(
          instance: expansion.parentInstance,
          nodeID: expansion.link.site.nodeID
        )
        guard state.expandedSites.contains(site) else { continue }

        if activeDefinitionCounts[expansion.link.targetGraphID, default: 0] > 0 {
          builder.setBoundary(
            at: expansion.contextIndex,
            reason: .recursiveReference(expansion.link.targetGraphID)
          )
          continue
        }
        guard let definition = validatedDocument.index.definitionsByID[
          expansion.link.targetGraphID
        ] else {
          throw FlowingGraphProjectionError<Schema>.inconsistentValidatedDocument
        }

        let childCost = try directCost(of: definition)
        if expansion.childDepth > budget.maxDepth {
          builder.setBoundary(at: expansion.contextIndex, reason: .budgetExceeded(.depth))
          continue
        }
        if let exceeded = builder.counts.firstExceeded(
          afterAdding: childCost,
          budget: budget
        ) {
          builder.setBoundary(
            at: expansion.contextIndex,
            reason: .budgetExceeded(exceeded)
          )
          continue
        }

        let component = FlowingGraphDefinitionNodeAddress(
          graphID: expansion.parentInstance.graphID,
          nodeID: expansion.link.site.nodeID
        )
        let childPath = FlowingGraphInstancePath(
          components: expansion.parentInstance.path.components + [component]
        )
        let childAddress = FlowingGraphInstanceAddress(
          path: childPath,
          graphID: expansion.link.targetGraphID
        )
        let childHandle = builder.allocateInstanceHandle()
        builder.reserve(childCost)
        builder.setExpanded(
          at: expansion.contextIndex,
          child: childAddress,
          childHandle: childHandle
        )
        work.append(
          .enter(
            FlowingGraphPendingInstance(
              handle: childHandle,
              address: childAddress,
              parentSite: site,
              parentInstanceHandle: expansion.parentInstanceHandle,
              depth: expansion.childDepth
            )
          )
        )

      case let .exit(graphID):
        guard let count = activeDefinitionCounts[graphID] else {
          throw FlowingGraphProjectionError<Schema>.inconsistentValidatedDocument
        }
        if count == 1 {
          activeDefinitionCounts.removeValue(forKey: graphID)
        } else {
          activeDefinitionCounts[graphID] = count - 1
        }
      }
    }

    return builder.presentation()
  }

  private func validate(_ budget: FlowingGraphProjectionBudget) throws {
    let values: [(FlowingGraphProjectionBudgetDimension, Int)] = [
      (.instances, budget.maxInstances),
      (.depth, budget.maxDepth),
      (.nodes, budget.maxNodes),
      (.ports, budget.maxPorts),
      (.edges, budget.maxEdges),
      (.expansionWork, budget.maxExpansionWork),
    ]
    if let invalid = values.first(where: { $0.1 < 0 }) {
      throw FlowingGraphProjectionError<Schema>.invalidBudget(
        dimension: invalid.0,
        value: invalid.1
      )
    }
  }

  private func resolveFocus(
    entryGraphID: Schema.GraphID,
    path: FlowingGraphInstancePath<Schema.GraphID, Schema.GraphSchema.NodeID>
  ) throws -> FlowingGraphResolvedFocus<Schema> {
    var graphID = entryGraphID
    var ancestors: [Schema.GraphID] = []
    ancestors.reserveCapacity(path.components.count)
    for (index, component) in path.components.enumerated() {
      guard component.graphID == graphID,
        let link = validatedDocument.index.linksBySite[component]
      else {
        throw FlowingGraphProjectionError<Schema>.invalidFocusPath(
          componentIndex: index,
          site: component
        )
      }
      ancestors.append(graphID)
      graphID = link.targetGraphID
    }
    return FlowingGraphResolvedFocus(graphID: graphID, ancestorGraphIDs: ancestors)
  }

  private func parentSite(
    for instance: FlowingGraphInstanceAddress<Schema.GraphID, Schema.GraphSchema.NodeID>
  ) -> FlowingGraphInstanceNodeAddress<Schema.GraphID, Schema.GraphSchema.NodeID>? {
    guard let component = instance.path.components.last else { return nil }
    let parentPath = FlowingGraphInstancePath(
      components: Array(instance.path.components.dropLast())
    )
    return FlowingGraphInstanceNodeAddress(
      instance: FlowingGraphInstanceAddress(
        path: parentPath,
        graphID: component.graphID
      ),
      nodeID: component.nodeID
    )
  }

  private func directCost(
    of definition: FlowingGraphDefinition<Schema>
  ) throws -> FlowingGraphProjectionCounts {
    let graph = definition.graph
    let contextCount = validatedDocument.index.linksBySourceGraphID[
      definition.id,
      default: []
    ].count
    let edgeCount = try checkedAdd(
      graph.edgeCount,
      contextCount,
      dimension: .edges
    )
    var work = 1
    work = try checkedAdd(work, graph.nodeCount, dimension: .expansionWork)
    work = try checkedAdd(work, graph.portCount, dimension: .expansionWork)
    work = try checkedAdd(work, edgeCount, dimension: .expansionWork)
    return FlowingGraphProjectionCounts(
      instances: 1,
      nodes: graph.nodeCount,
      ports: graph.portCount,
      edges: edgeCount,
      expansionWork: work
    )
  }

  private func checkedAdd(
    _ lhs: Int,
    _ rhs: Int,
    dimension: FlowingGraphProjectionBudgetDimension
  ) throws -> Int {
    let result = lhs.addingReportingOverflow(rhs)
    guard !result.overflow else {
      throw FlowingGraphProjectionError<Schema>.resourceCountOverflow(dimension)
    }
    return result.partialValue
  }
}

extension FlowingGraphProjector: Sendable
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

private struct FlowingGraphResolvedFocus<Schema: FlowingGraphCompositionSchema> {
  let graphID: Schema.GraphID
  let ancestorGraphIDs: [Schema.GraphID]
}

private struct FlowingGraphPendingInstance<Schema: FlowingGraphCompositionSchema> {
  typealias Address = FlowingGraphInstanceAddress<
    Schema.GraphID,
    Schema.GraphSchema.NodeID
  >
  typealias SiteAddress = FlowingGraphInstanceNodeAddress<
    Schema.GraphID,
    Schema.GraphSchema.NodeID
  >

  let handle: FlowingGraphInstanceHandle
  let address: Address
  let parentSite: SiteAddress?
  let parentInstanceHandle: FlowingGraphInstanceHandle?
  let depth: Int
}

private struct FlowingGraphPendingExpansion<Schema: FlowingGraphCompositionSchema> {
  typealias InstanceAddress = FlowingGraphInstanceAddress<
    Schema.GraphID,
    Schema.GraphSchema.NodeID
  >

  let contextIndex: Int
  let parentInstance: InstanceAddress
  let parentInstanceHandle: FlowingGraphInstanceHandle
  let link: FlowingSubgraphLink<Schema>
  let childDepth: Int
}

private enum FlowingGraphProjectionWorkItem<Schema: FlowingGraphCompositionSchema> {
  case enter(FlowingGraphPendingInstance<Schema>)
  case expand(FlowingGraphPendingExpansion<Schema>)
  case exit(Schema.GraphID)
}

private struct FlowingGraphProjectionCounts {
  var instances: Int
  var nodes: Int
  var ports: Int
  var edges: Int
  var expansionWork: Int

  func firstExceeded(
    budget: FlowingGraphProjectionBudget
  ) -> (dimension: FlowingGraphProjectionBudgetDimension, required: Int, limit: Int)? {
    let values: [(FlowingGraphProjectionBudgetDimension, Int, Int)] = [
      (.instances, instances, budget.maxInstances),
      (.nodes, nodes, budget.maxNodes),
      (.ports, ports, budget.maxPorts),
      (.edges, edges, budget.maxEdges),
      (.expansionWork, expansionWork, budget.maxExpansionWork),
    ]
    return values.first { $0.1 > $0.2 }
  }

  func firstExceeded(
    afterAdding other: Self,
    budget: FlowingGraphProjectionBudget
  ) -> FlowingGraphProjectionBudgetDimension? {
    let values: [(FlowingGraphProjectionBudgetDimension, Int, Int, Int)] = [
      (.instances, instances, other.instances, budget.maxInstances),
      (.nodes, nodes, other.nodes, budget.maxNodes),
      (.ports, ports, other.ports, budget.maxPorts),
      (.edges, edges, other.edges, budget.maxEdges),
      (.expansionWork, expansionWork, other.expansionWork, budget.maxExpansionWork),
    ]
    for (dimension, current, added, limit) in values {
      let result = current.addingReportingOverflow(added)
      if result.overflow || result.partialValue > limit {
        return dimension
      }
    }
    return nil
  }

  mutating func add(_ other: Self) {
    instances += other.instances
    nodes += other.nodes
    ports += other.ports
    edges += other.edges
    expansionWork += other.expansionWork
  }
}

private struct FlowingGraphPresentationBuilder<Schema: FlowingGraphCompositionSchema> {
  let documentSnapshotID: FlowingGraphDocumentSnapshotID
  let entryPointID: Schema.EntryPointID
  let focusPath: FlowingGraphInstancePath<Schema.GraphID, Schema.GraphSchema.NodeID>
  var counts: FlowingGraphProjectionCounts
  var instances: [FlowingGraphPresentationInstance<Schema>] = []
  var nodes: [FlowingGraphPresentationNode<Schema>] = []
  var ports: [FlowingGraphPresentationPort<Schema>] = []
  var edges: [FlowingGraphPresentationEdge<Schema>] = []
  var contextEdges: [FlowingGraphPresentationContextEdge<Schema>] = []
  var nextInstanceHandleRawValue = 0

  mutating func allocateInstanceHandle() -> FlowingGraphInstanceHandle {
    defer { nextInstanceHandleRawValue += 1 }
    return FlowingGraphInstanceHandle(rawValue: nextInstanceHandleRawValue)
  }

  mutating func reserve(_ cost: FlowingGraphProjectionCounts) {
    counts.add(cost)
  }

  mutating func append(
    instance: FlowingGraphPendingInstance<Schema>,
    definition: FlowingGraphDefinition<Schema>
  ) {
    instances.append(
      FlowingGraphPresentationInstance(
        handle: instance.handle,
        address: instance.address,
        parentSite: instance.parentSite,
        parentInstanceHandle: instance.parentInstanceHandle,
        depth: instance.depth
      )
    )
    let graph = definition.graph
    nodes.reserveCapacity(nodes.count + graph.nodeCount)
    ports.reserveCapacity(ports.count + graph.portCount)
    edges.reserveCapacity(edges.count + graph.edgeCount)

    for node in graph.nodes {
      let address = elementAddress(
        instance: instance.address,
        elementID: .node(node.id)
      )
      nodes.append(
        FlowingGraphPresentationNode(
          id: .source(address: address, occurrenceID: nil),
          localID: .source(instanceHandle: instance.handle, elementID: .node(node.id)),
          address: address,
          value: node.value
        )
      )
    }
    for port in graph.ports {
      let address = elementAddress(
        instance: instance.address,
        elementID: .port(port.key)
      )
      ports.append(
        FlowingGraphPresentationPort(
          id: .source(address: address, occurrenceID: nil),
          localID: .source(instanceHandle: instance.handle, elementID: .port(port.key)),
          address: address,
          value: port.value
        )
      )
    }
    for edge in graph.edges {
      let address = elementAddress(
        instance: instance.address,
        elementID: .edge(edge.id)
      )
      edges.append(
        FlowingGraphPresentationEdge(
          id: .source(address: address, occurrenceID: nil),
          localID: .source(instanceHandle: instance.handle, elementID: .edge(edge.id)),
          address: address,
          endpoints: presentationEndpoints(
            edge.endpoints,
            instance: instance.address
          ),
          value: edge.value
        )
      )
    }
  }

  mutating func appendContext(
    link: FlowingSubgraphLink<Schema>,
    parentInstance: FlowingGraphInstanceAddress<
      Schema.GraphID,
      Schema.GraphSchema.NodeID
    >,
    parentInstanceHandle: FlowingGraphInstanceHandle
  ) -> Int {
    let site = FlowingGraphInstanceNodeAddress(
      instance: parentInstance,
      nodeID: link.site.nodeID
    )
    let sourceAddress = elementAddress(
      instance: parentInstance,
      elementID: .node(link.site.nodeID)
    )
    let id = FlowingGraphCompositionElementID<Schema>.synthetic(
      role: .subgraphContext(link.id),
      sourceAddresses: [sourceAddress],
      occurrenceID: nil
    )
    contextEdges.append(
      FlowingGraphPresentationContextEdge(
        id: id,
        localID: .subgraphContext(
          instanceHandle: parentInstanceHandle,
          linkID: link.id
        ),
        linkID: link.id,
        sourceInstanceHandle: parentInstanceHandle,
        site: site,
        targetGraphID: link.targetGraphID,
        targetInstanceHandle: nil,
        state: .boundary(.collapsed)
      )
    )
    return contextEdges.count - 1
  }

  mutating func setBoundary(
    at index: Int,
    reason: FlowingGraphSubgraphBoundaryReason<Schema.GraphID>
  ) {
    contextEdges[index].state = .boundary(reason)
  }

  mutating func setExpanded(
    at index: Int,
    child: FlowingGraphInstanceAddress<Schema.GraphID, Schema.GraphSchema.NodeID>,
    childHandle: FlowingGraphInstanceHandle
  ) {
    contextEdges[index].targetInstanceHandle = childHandle
    contextEdges[index].state = .expanded(child)
  }

  func presentation() -> FlowingGraphPresentation<Schema> {
    FlowingGraphPresentation(
      documentSnapshotID: documentSnapshotID,
      entryPointID: entryPointID,
      focusPath: focusPath,
      instances: instances,
      nodes: nodes,
      ports: ports,
      edges: edges,
      contextEdges: contextEdges
    )
  }

  private func elementAddress(
    instance: FlowingGraphInstanceAddress<Schema.GraphID, Schema.GraphSchema.NodeID>,
    elementID: FlowingGraphLocalElementID<Schema.GraphSchema>
  ) -> FlowingGraphElementAddress<Schema.GraphID, Schema.GraphSchema> {
    FlowingGraphElementAddress(
      instancePath: instance.path,
      graphID: instance.graphID,
      elementID: elementID
    )
  }

  private func presentationEndpoint(
    _ endpoint: FlowingGraphEndpoint<Schema.GraphSchema>,
    instance: FlowingGraphInstanceAddress<Schema.GraphID, Schema.GraphSchema.NodeID>
  ) -> FlowingGraphPresentationEndpoint<Schema> {
    switch endpoint {
    case let .node(nodeID):
      let address = elementAddress(instance: instance, elementID: .node(nodeID))
      return .node(.source(address: address, occurrenceID: nil))
    case let .port(key):
      let address = elementAddress(instance: instance, elementID: .port(key))
      return .port(.source(address: address, occurrenceID: nil))
    }
  }

  private func presentationEndpoints(
    _ endpoints: FlowingGraphEdgeEndpoints<Schema.GraphSchema>,
    instance: FlowingGraphInstanceAddress<Schema.GraphID, Schema.GraphSchema.NodeID>
  ) -> FlowingGraphPresentationEdgeEndpoints<Schema> {
    switch endpoints {
    case let .directed(source, target):
      .directed(
        source: presentationEndpoint(source, instance: instance),
        target: presentationEndpoint(target, instance: instance)
      )
    case let .undirected(first, second):
      .undirected(
        presentationEndpoint(first, instance: instance),
        presentationEndpoint(second, instance: instance)
      )
    }
  }
}
