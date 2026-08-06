import FlowingDayGraphCore
import Foundation

public enum FlowingGraphDocumentValidationIssue<
  Schema: FlowingGraphCompositionSchema
>: Equatable {
  public typealias Site = FlowingGraphDefinitionNodeAddress<
    Schema.GraphID,
    Schema.GraphSchema.NodeID
  >

  case duplicateDefinitionID(Schema.GraphID)
  case duplicateEntryPointID(Schema.EntryPointID)
  case duplicateLinkID(Schema.LinkID)
  case duplicateSubgraphSite(Site)
  case unknownDefaultEntryPoint(Schema.EntryPointID)
  case emptyEntryPointName(Schema.EntryPointID)
  case unknownEntryPointDefinition(
    entryPointID: Schema.EntryPointID,
    graphID: Schema.GraphID
  )
  case unknownLinkSourceDefinition(linkID: Schema.LinkID, graphID: Schema.GraphID)
  case unknownLinkSourceNode(linkID: Schema.LinkID, site: Site)
  case unknownLinkTargetDefinition(linkID: Schema.LinkID, graphID: Schema.GraphID)
  case interfaceExternalPortOutsideSite(
    linkID: Schema.LinkID,
    port: FlowingGraphPortKey<Schema.GraphSchema>
  )
  case unknownInterfaceExternalPort(
    linkID: Schema.LinkID,
    port: FlowingGraphPortKey<Schema.GraphSchema>
  )
  case duplicateInterfaceExternalPort(
    linkID: Schema.LinkID,
    port: FlowingGraphPortKey<Schema.GraphSchema>
  )
  case unknownInterfaceInternalNode(
    linkID: Schema.LinkID,
    nodeID: Schema.GraphSchema.NodeID
  )
  case unknownInterfaceInternalPort(
    linkID: Schema.LinkID,
    port: FlowingGraphPortKey<Schema.GraphSchema>
  )
  case multipleOwners(
    graphID: Schema.GraphID,
    firstLinkID: Schema.LinkID,
    secondLinkID: Schema.LinkID
  )
  case containmentCycle(linkID: Schema.LinkID)
  case ownedDefinitionUsedAsEntryPoint(
    entryPointID: Schema.EntryPointID,
    graphID: Schema.GraphID
  )
  case ownedDefinitionExternallyReferenced(
    linkID: Schema.LinkID,
    graphID: Schema.GraphID
  )
}

extension FlowingGraphDocumentValidationIssue: Sendable
where
  Schema.GraphID: Sendable,
  Schema.EntryPointID: Sendable,
  Schema.LinkID: Sendable,
  Schema.GraphSchema.NodeID: Sendable,
  Schema.GraphSchema.PortID: Sendable
{}

public struct FlowingGraphDocumentValidationError<
  Schema: FlowingGraphCompositionSchema
>: Error {
  public let issues: [FlowingGraphDocumentValidationIssue<Schema>]

  public init(issues: [FlowingGraphDocumentValidationIssue<Schema>]) {
    self.issues = issues
  }
}

extension FlowingGraphDocumentValidationError: Equatable {}
extension FlowingGraphDocumentValidationError: Sendable
where
  Schema.GraphID: Sendable,
  Schema.EntryPointID: Sendable,
  Schema.LinkID: Sendable,
  Schema.GraphSchema.NodeID: Sendable,
  Schema.GraphSchema.PortID: Sendable
{}

public enum FlowingGraphDocumentValidator {
  public static func issues<Schema: FlowingGraphCompositionSchema>(
    in document: FlowingGraphDocument<Schema>
  ) -> [FlowingGraphDocumentValidationIssue<Schema>] {
    analyze(document).issues
  }

  public static func validate<Schema: FlowingGraphCompositionSchema>(
    _ document: FlowingGraphDocument<Schema>
  ) throws -> FlowingValidatedGraphDocument<Schema> {
    let analysis = analyze(document)
    guard analysis.issues.isEmpty else {
      throw FlowingGraphDocumentValidationError(issues: analysis.issues)
    }
    guard
      let defaultEntryPoint = analysis.index.entryPointsByID[
        document.defaultEntryPointID
      ]
    else {
      throw FlowingGraphDocumentValidationError<Schema>(
        issues: [.unknownDefaultEntryPoint(document.defaultEntryPointID)]
      )
    }
    return FlowingValidatedGraphDocument(
      document: document,
      defaultEntryPoint: defaultEntryPoint,
      index: analysis.index
    )
  }

  private static func analyze<Schema: FlowingGraphCompositionSchema>(
    _ document: FlowingGraphDocument<Schema>
  ) -> FlowingGraphDocumentAnalysis<Schema> {
    var issues: [FlowingGraphDocumentValidationIssue<Schema>] = []
    var definitionsByID: [Schema.GraphID: FlowingGraphDefinition<Schema>] = [:]
    for definition in document.definitions {
      guard definitionsByID[definition.id] == nil else {
        issues.append(.duplicateDefinitionID(definition.id))
        continue
      }
      definitionsByID[definition.id] = definition
    }

    var entryPointsByID: [Schema.EntryPointID: FlowingGraphEntryPoint<Schema>] = [:]
    for entryPoint in document.entryPoints {
      if entryPointsByID[entryPoint.id] != nil {
        issues.append(.duplicateEntryPointID(entryPoint.id))
      } else {
        entryPointsByID[entryPoint.id] = entryPoint
      }
      if entryPoint.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        issues.append(.emptyEntryPointName(entryPoint.id))
      }
      if definitionsByID[entryPoint.graphID] == nil {
        issues.append(
          .unknownEntryPointDefinition(
            entryPointID: entryPoint.id,
            graphID: entryPoint.graphID
          )
        )
      }
    }
    if entryPointsByID[document.defaultEntryPointID] == nil {
      issues.append(.unknownDefaultEntryPoint(document.defaultEntryPointID))
    }

    var linksByID: [Schema.LinkID: FlowingSubgraphLink<Schema>] = [:]
    var linksBySite: [FlowingSubgraphLink<Schema>.Site: FlowingSubgraphLink<Schema>] = [:]
    var linksBySourceGraphID: [Schema.GraphID: [FlowingSubgraphLink<Schema>]] = [:]
    var validLinks: [FlowingSubgraphLink<Schema>] = []
    for link in document.subgraphLinks {
      if linksByID[link.id] != nil {
        issues.append(.duplicateLinkID(link.id))
      } else {
        linksByID[link.id] = link
      }
      if linksBySite[link.site] != nil {
        issues.append(.duplicateSubgraphSite(link.site))
      } else {
        linksBySite[link.site] = link
      }

      guard let sourceDefinition = definitionsByID[link.site.graphID] else {
        issues.append(
          .unknownLinkSourceDefinition(linkID: link.id, graphID: link.site.graphID)
        )
        if definitionsByID[link.targetGraphID] == nil {
          issues.append(
            .unknownLinkTargetDefinition(linkID: link.id, graphID: link.targetGraphID)
          )
        }
        continue
      }
      guard sourceDefinition.graph.node(id: link.site.nodeID) != nil else {
        issues.append(.unknownLinkSourceNode(linkID: link.id, site: link.site))
        if definitionsByID[link.targetGraphID] == nil {
          issues.append(
            .unknownLinkTargetDefinition(linkID: link.id, graphID: link.targetGraphID)
          )
        }
        continue
      }
      guard let targetDefinition = definitionsByID[link.targetGraphID] else {
        issues.append(
          .unknownLinkTargetDefinition(linkID: link.id, graphID: link.targetGraphID)
        )
        continue
      }
      issues.append(
        contentsOf: interfaceIssues(
          link: link,
          sourceDefinition: sourceDefinition,
          targetDefinition: targetDefinition
        )
      )
      validLinks.append(link)
      linksBySourceGraphID[link.site.graphID, default: []].append(link)
    }

    var ownedParentByGraphID: [Schema.GraphID: FlowingOwnedGraphParent<Schema>] = [:]
    var ownedChildrenByGraphID: [Schema.GraphID: [FlowingOwnedGraphChild<Schema>]] = [:]
    for link in validLinks where link.ownership == .owned {
      let parent = FlowingOwnedGraphParent<Schema>(
        graphID: link.site.graphID,
        linkID: link.id
      )
      if let existing = ownedParentByGraphID[link.targetGraphID] {
        issues.append(
          .multipleOwners(
            graphID: link.targetGraphID,
            firstLinkID: existing.linkID,
            secondLinkID: link.id
          )
        )
      } else {
        ownedParentByGraphID[link.targetGraphID] = parent
      }
      ownedChildrenByGraphID[link.site.graphID, default: []].append(
        FlowingOwnedGraphChild<Schema>(graphID: link.targetGraphID, linkID: link.id)
      )
    }

    issues.append(
      contentsOf: containmentCycleIssues(
        definitionOrder: document.definitions.map(\.id),
        childrenByGraphID: ownedChildrenByGraphID
      )
    )

    for entryPoint in document.entryPoints
    where ownedParentByGraphID[entryPoint.graphID] != nil {
      issues.append(
        .ownedDefinitionUsedAsEntryPoint(
          entryPointID: entryPoint.id,
          graphID: entryPoint.graphID
        )
      )
    }

    for link in validLinks where link.ownership == .reference {
      guard ownedParentByGraphID[link.targetGraphID] != nil else { continue }
      guard
        isInOwnedSubtree(
          link.site.graphID,
          rootedAt: link.targetGraphID,
          parentByGraphID: ownedParentByGraphID
        )
      else {
        issues.append(
          .ownedDefinitionExternallyReferenced(
            linkID: link.id,
            graphID: link.targetGraphID
          )
        )
        continue
      }
    }

    let index = FlowingGraphDocumentIndex(
      definitionsByID: definitionsByID,
      entryPointsByID: entryPointsByID,
      linksByID: linksByID,
      linksBySite: linksBySite,
      linksBySourceGraphID: linksBySourceGraphID
    )
    return FlowingGraphDocumentAnalysis(issues: issues, index: index)
  }

  private static func interfaceIssues<Schema: FlowingGraphCompositionSchema>(
    link: FlowingSubgraphLink<Schema>,
    sourceDefinition: FlowingGraphDefinition<Schema>,
    targetDefinition: FlowingGraphDefinition<Schema>
  ) -> [FlowingGraphDocumentValidationIssue<Schema>] {
    var issues: [FlowingGraphDocumentValidationIssue<Schema>] = []
    var boundExternalPorts: Set<FlowingGraphPortKey<Schema.GraphSchema>> = []
    for binding in link.interface.bindings {
      let externalPort = binding.externalPort
      if !boundExternalPorts.insert(externalPort).inserted {
        issues.append(
          .duplicateInterfaceExternalPort(linkID: link.id, port: externalPort)
        )
      }
      if externalPort.nodeID != link.site.nodeID {
        issues.append(
          .interfaceExternalPortOutsideSite(linkID: link.id, port: externalPort)
        )
      }
      if sourceDefinition.graph.port(key: externalPort) == nil {
        issues.append(
          .unknownInterfaceExternalPort(linkID: link.id, port: externalPort)
        )
      }
      switch binding.internalEndpoint {
      case .node(let nodeID):
        if targetDefinition.graph.node(id: nodeID) == nil {
          issues.append(.unknownInterfaceInternalNode(linkID: link.id, nodeID: nodeID))
        }
      case .port(let port):
        if targetDefinition.graph.port(key: port) == nil {
          issues.append(.unknownInterfaceInternalPort(linkID: link.id, port: port))
        }
      }
    }
    return issues
  }

  private static func containmentCycleIssues<Schema: FlowingGraphCompositionSchema>(
    definitionOrder: [Schema.GraphID],
    childrenByGraphID: [Schema.GraphID: [FlowingOwnedGraphChild<Schema>]]
  ) -> [FlowingGraphDocumentValidationIssue<Schema>] {
    var states: [Schema.GraphID: FlowingGraphVisitState] = [:]
    var issues: [FlowingGraphDocumentValidationIssue<Schema>] = []

    for root in definitionOrder where states[root] == nil {
      states[root] = .active
      var stack = [FlowingGraphValidationFrame(graphID: root, nextChildIndex: 0)]
      while var frame = stack.popLast() {
        let children = childrenByGraphID[frame.graphID, default: []]
        guard frame.nextChildIndex < children.count else {
          states[frame.graphID] = .complete
          continue
        }

        let child = children[frame.nextChildIndex]
        frame.nextChildIndex += 1
        stack.append(frame)
        switch states[child.graphID] {
        case .active:
          issues.append(.containmentCycle(linkID: child.linkID))
        case .complete:
          break
        case nil:
          states[child.graphID] = .active
          stack.append(
            FlowingGraphValidationFrame(graphID: child.graphID, nextChildIndex: 0)
          )
        }
      }
    }
    return issues
  }

  private static func isInOwnedSubtree<Schema: FlowingGraphCompositionSchema>(
    _ graphID: Schema.GraphID,
    rootedAt rootGraphID: Schema.GraphID,
    parentByGraphID: [Schema.GraphID: FlowingOwnedGraphParent<Schema>]
  ) -> Bool {
    var current = graphID
    var visited: Set<Schema.GraphID> = []
    while visited.insert(current).inserted {
      if current == rootGraphID {
        return true
      }
      guard let parent = parentByGraphID[current] else {
        return false
      }
      current = parent.graphID
    }
    return false
  }
}

public struct FlowingValidatedGraphDocument<Schema: FlowingGraphCompositionSchema> {
  public let document: FlowingGraphDocument<Schema>
  public let defaultEntryPoint: FlowingGraphEntryPoint<Schema>
  let index: FlowingGraphDocumentIndex<Schema>

  init(
    document: FlowingGraphDocument<Schema>,
    defaultEntryPoint: FlowingGraphEntryPoint<Schema>,
    index: FlowingGraphDocumentIndex<Schema>
  ) {
    self.document = document
    self.defaultEntryPoint = defaultEntryPoint
    self.index = index
  }

  public func definition(
    id: Schema.GraphID
  ) -> FlowingGraphDefinition<Schema>? {
    index.definitionsByID[id]
  }

  public func entryPoint(
    id: Schema.EntryPointID
  ) -> FlowingGraphEntryPoint<Schema>? {
    index.entryPointsByID[id]
  }

  public func subgraphLink(
    at site: FlowingSubgraphLink<Schema>.Site
  ) -> FlowingSubgraphLink<Schema>? {
    index.linksBySite[site]
  }

  public func subgraphLink(id: Schema.LinkID) -> FlowingSubgraphLink<Schema>? {
    index.linksByID[id]
  }
}

extension FlowingValidatedGraphDocument: Sendable
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

struct FlowingGraphDocumentIndex<Schema: FlowingGraphCompositionSchema> {
  let definitionsByID: [Schema.GraphID: FlowingGraphDefinition<Schema>]
  let entryPointsByID: [Schema.EntryPointID: FlowingGraphEntryPoint<Schema>]
  let linksByID: [Schema.LinkID: FlowingSubgraphLink<Schema>]
  let linksBySite: [FlowingSubgraphLink<Schema>.Site: FlowingSubgraphLink<Schema>]
  let linksBySourceGraphID: [Schema.GraphID: [FlowingSubgraphLink<Schema>]]
}

extension FlowingGraphDocumentIndex: Sendable
where
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

private struct FlowingGraphDocumentAnalysis<Schema: FlowingGraphCompositionSchema> {
  let issues: [FlowingGraphDocumentValidationIssue<Schema>]
  let index: FlowingGraphDocumentIndex<Schema>
}

struct FlowingOwnedGraphParent<Schema: FlowingGraphCompositionSchema> {
  let graphID: Schema.GraphID
  let linkID: Schema.LinkID
}

extension FlowingOwnedGraphParent: Sendable
where
  Schema.GraphID: Sendable,
  Schema.LinkID: Sendable
{}

private struct FlowingOwnedGraphChild<Schema: FlowingGraphCompositionSchema> {
  let graphID: Schema.GraphID
  let linkID: Schema.LinkID
}

private struct FlowingGraphValidationFrame<GraphID> {
  let graphID: GraphID
  var nextChildIndex: Int
}

private enum FlowingGraphVisitState {
  case active
  case complete
}
