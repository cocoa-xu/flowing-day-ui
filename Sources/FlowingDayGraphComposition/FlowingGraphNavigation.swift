import FlowingDayGraphCore

public enum FlowingGraphBreadcrumbSource<Schema: FlowingGraphCompositionSchema> {
  public typealias DefinitionSite = FlowingGraphDefinitionNodeAddress<
    Schema.GraphID,
    Schema.GraphSchema.NodeID
  >

  case entryPoint(id: Schema.EntryPointID, name: String)
  case subgraph(linkID: Schema.LinkID, site: DefinitionSite)
}

extension FlowingGraphBreadcrumbSource: Equatable {}
extension FlowingGraphBreadcrumbSource: Sendable
where
  Schema.EntryPointID: Sendable,
  Schema.LinkID: Sendable,
  Schema.GraphID: Sendable,
  Schema.GraphSchema.NodeID: Sendable
{}

public struct FlowingGraphBreadcrumbSegment<Schema: FlowingGraphCompositionSchema> {
  public typealias InstancePath = FlowingGraphInstancePath<
    Schema.GraphID,
    Schema.GraphSchema.NodeID
  >

  public let graphID: Schema.GraphID
  public let focusPath: InstancePath
  public let source: FlowingGraphBreadcrumbSource<Schema>

  public init(
    graphID: Schema.GraphID,
    focusPath: InstancePath,
    source: FlowingGraphBreadcrumbSource<Schema>
  ) {
    self.graphID = graphID
    self.focusPath = focusPath
    self.source = source
  }
}

extension FlowingGraphBreadcrumbSegment: Equatable {}
extension FlowingGraphBreadcrumbSegment: Sendable
where
  Schema.EntryPointID: Sendable,
  Schema.LinkID: Sendable,
  Schema.GraphID: Sendable,
  Schema.GraphSchema.NodeID: Sendable
{}

public enum FlowingGraphNavigationError<Schema: FlowingGraphCompositionSchema>: Error, Equatable {
  public typealias DefinitionSite = FlowingGraphDefinitionNodeAddress<
    Schema.GraphID,
    Schema.GraphSchema.NodeID
  >
  public typealias InstanceSite = FlowingGraphInstanceNodeAddress<
    Schema.GraphID,
    Schema.GraphSchema.NodeID
  >

  case unknownEntryPoint(Schema.EntryPointID)
  case invalidFocusPath(componentIndex: Int, site: DefinitionSite)
  case siteOutsideFocus(InstanceSite)
}

extension FlowingGraphNavigationError: Sendable
where
  Schema.EntryPointID: Sendable,
  Schema.GraphID: Sendable,
  Schema.GraphSchema.NodeID: Sendable
{}

public struct FlowingGraphNavigator<Schema: FlowingGraphCompositionSchema> {
  public typealias State = FlowingGraphProjectionState<Schema>
  public typealias InstancePath = State.InstancePath
  public typealias InstanceSite = State.SiteAddress

  public let validatedDocument: FlowingValidatedGraphDocument<Schema>

  public init(validatedDocument: FlowingValidatedGraphDocument<Schema>) {
    self.validatedDocument = validatedDocument
  }

  public init(document: FlowingGraphDocument<Schema>) throws {
    validatedDocument = try FlowingGraphDocumentValidator.validate(document)
  }

  public func breadcrumb(
    for state: State
  ) throws -> [FlowingGraphBreadcrumbSegment<Schema>] {
    try validatedDocument.resolveNavigation(
      entryPointID: state.entryPointID,
      focusPath: state.focusPath
    ).breadcrumb
  }

  public func navigate(
    from state: State,
    to focusPath: InstancePath
  ) throws -> State {
    _ = try validatedDocument.resolveNavigation(
      entryPointID: state.entryPointID,
      focusPath: focusPath
    )
    return State(
      entryPointID: state.entryPointID,
      focusPath: focusPath,
      expandedSites: state.expandedSites
    )
  }

  public func drillIn(
    from state: State,
    at site: InstanceSite
  ) throws -> State {
    guard site.instance.path.components.starts(with: state.focusPath.components) else {
      throw FlowingGraphNavigationError<Schema>.siteOutsideFocus(site)
    }
    let component = FlowingGraphDefinitionNodeAddress(
      graphID: site.instance.graphID,
      nodeID: site.nodeID
    )
    return try navigate(
      from: state,
      to: InstancePath(components: site.instance.path.components + [component])
    )
  }

  public func drillOut(from state: State) throws -> State? {
    _ = try validatedDocument.resolveNavigation(
      entryPointID: state.entryPointID,
      focusPath: state.focusPath
    )
    guard !state.focusPath.components.isEmpty else { return nil }
    return State(
      entryPointID: state.entryPointID,
      focusPath: InstancePath(components: Array(state.focusPath.components.dropLast())),
      expandedSites: state.expandedSites
    )
  }
}

extension FlowingGraphNavigator: Sendable
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

struct FlowingResolvedGraphNavigation<Schema: FlowingGraphCompositionSchema> {
  let graphID: Schema.GraphID
  let ancestorGraphIDs: [Schema.GraphID]
  let breadcrumb: [FlowingGraphBreadcrumbSegment<Schema>]
}

extension FlowingValidatedGraphDocument {
  func resolveNavigation(
    entryPointID: Schema.EntryPointID,
    focusPath: FlowingGraphInstancePath<Schema.GraphID, Schema.GraphSchema.NodeID>
  ) throws -> FlowingResolvedGraphNavigation<Schema> {
    guard let entryPoint = index.entryPointsByID[entryPointID] else {
      throw FlowingGraphNavigationError<Schema>.unknownEntryPoint(entryPointID)
    }
    var graphID = entryPoint.graphID
    var pathComponents:
      [FlowingGraphDefinitionNodeAddress<
        Schema.GraphID,
        Schema.GraphSchema.NodeID
      >] = []
    pathComponents.reserveCapacity(focusPath.components.count)
    var ancestorGraphIDs: [Schema.GraphID] = []
    ancestorGraphIDs.reserveCapacity(focusPath.components.count)
    var breadcrumb = [
      FlowingGraphBreadcrumbSegment<Schema>(
        graphID: graphID,
        focusPath: .root,
        source: .entryPoint(id: entryPoint.id, name: entryPoint.name)
      )
    ]
    breadcrumb.reserveCapacity(focusPath.components.count + 1)

    for (index, component) in focusPath.components.enumerated() {
      guard component.graphID == graphID,
        let link = self.index.linksBySite[component]
      else {
        throw FlowingGraphNavigationError<Schema>.invalidFocusPath(
          componentIndex: index,
          site: component
        )
      }
      ancestorGraphIDs.append(graphID)
      pathComponents.append(component)
      graphID = link.targetGraphID
      breadcrumb.append(
        FlowingGraphBreadcrumbSegment(
          graphID: graphID,
          focusPath: FlowingGraphInstancePath(components: pathComponents),
          source: .subgraph(linkID: link.id, site: component)
        )
      )
    }
    return FlowingResolvedGraphNavigation(
      graphID: graphID,
      ancestorGraphIDs: ancestorGraphIDs,
      breadcrumb: breadcrumb
    )
  }
}
