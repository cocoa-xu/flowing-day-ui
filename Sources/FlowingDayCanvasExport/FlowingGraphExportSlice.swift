import CoreGraphics
import FlowingDayGraphCanvas
import FlowingDayGraphComposition
import FlowingDayGraphCore
import FlowingDayGraphLayout
import Foundation

public struct FlowingGraphExportInclusion: OptionSet, Hashable, Sendable {
  public let rawValue: UInt16

  public init(rawValue: UInt16) {
    self.rawValue = rawValue
  }

  public static let selectedElements = Self(rawValue: 1 << 0)
  public static let directedAncestors = Self(rawValue: 1 << 1)
  public static let directedDescendants = Self(rawValue: 1 << 2)
  public static let containingAncestors = Self(rawValue: 1 << 3)
  public static let containedDescendants = Self(rawValue: 1 << 4)
  public static let nodePorts = Self(rawValue: 1 << 5)
  public static let connectingEdges = Self(rawValue: 1 << 6)
  public static let contextRecords = Self(rawValue: 1 << 7)

  public static let standard: Self = [
    .selectedElements,
    .nodePorts,
    .connectingEdges,
    .contextRecords,
  ]
}

public enum FlowingGraphExportScope<Schema: FlowingGraphCanvasSchema> {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>

  case completePresentation
  case selection(Set<ElementID>, inclusion: FlowingGraphExportInclusion)
}

extension FlowingGraphExportScope: Sendable {}

public enum FlowingGraphExportScopeIssue<Schema: FlowingGraphCanvasSchema>: Error {
  case selectionDoesNotBelongToPresentation
  case emptyScope
}

extension FlowingGraphExportScopeIssue: Equatable {}
extension FlowingGraphExportScopeIssue: Sendable {}

public struct FlowingGraphExportSlice<Schema: FlowingGraphCanvasSchema>: Sendable {
  public typealias ElementID = FlowingGraphCompositionElementID<Schema>
  public typealias LocalElementID = FlowingGraphPresentationLocalElementID<Schema>

  public let inputID: FlowingLayoutInputID
  public let nodeLocalIDs: [LocalElementID]
  public let portLocalIDs: [LocalElementID]
  public let edgeLocalIDs: [LocalElementID]
  public let contextLocalIDs: [LocalElementID]
  public let elementIDs: Set<ElementID>
  public let contentBounds: CGRect

  private let localElementIDs: Set<LocalElementID>

  init(
    inputID: FlowingLayoutInputID,
    nodeLocalIDs: [LocalElementID],
    portLocalIDs: [LocalElementID],
    edgeLocalIDs: [LocalElementID],
    contextLocalIDs: [LocalElementID],
    elementIDs: Set<ElementID>,
    contentBounds: CGRect
  ) {
    self.inputID = inputID
    self.nodeLocalIDs = nodeLocalIDs
    self.portLocalIDs = portLocalIDs
    self.edgeLocalIDs = edgeLocalIDs
    self.contextLocalIDs = contextLocalIDs
    self.elementIDs = elementIDs
    self.contentBounds = contentBounds
    localElementIDs = Set(nodeLocalIDs + portLocalIDs + edgeLocalIDs + contextLocalIDs)
  }

  public func contains(_ elementID: ElementID) -> Bool {
    elementIDs.contains(elementID)
  }

  public func contains(localID: LocalElementID) -> Bool {
    localElementIDs.contains(localID)
  }
}

public enum FlowingGraphExportSliceResolver {
  public static func resolve<Schema: FlowingGraphCanvasSchema>(
    content: FlowingGraphCanvasContent<Schema>,
    scope: FlowingGraphExportScope<Schema>
  ) throws -> FlowingGraphExportSlice<Schema> {
    switch scope {
    case .completePresentation:
      return try completeSlice(content: content)
    case .selection(let elementIDs, let inclusion):
      return try selectedSlice(
        content: content,
        selectedElementIDs: elementIDs,
        inclusion: inclusion
      )
    }
  }

  private static func completeSlice<Schema: FlowingGraphCanvasSchema>(
    content: FlowingGraphCanvasContent<Schema>
  ) throws -> FlowingGraphExportSlice<Schema> {
    try makeSlice(
      content: content,
      nodeLocalIDs: content.presentation.nodes.map(\.localID),
      portLocalIDs: content.presentation.ports.map(\.localID),
      edgeLocalIDs: content.presentation.edges.map(\.localID),
      contextLocalIDs: content.presentation.contextEdges.map(\.localID)
    )
  }

  private static func selectedSlice<Schema: FlowingGraphCanvasSchema>(
    content: FlowingGraphCanvasContent<Schema>,
    selectedElementIDs: Set<FlowingGraphCompositionElementID<Schema>>,
    inclusion: FlowingGraphExportInclusion
  ) throws -> FlowingGraphExportSlice<Schema> {
    typealias LocalElementID = FlowingGraphPresentationLocalElementID<Schema>

    guard selectedElementIDs.isSubset(of: content.elementIDs) else {
      throw FlowingGraphExportScopeIssue<Schema>.selectionDoesNotBelongToPresentation
    }
    let selectedLocalIDs = Set(selectedElementIDs.compactMap(content.localID))

    var rootNodeIDs: Set<LocalElementID> = []
    var selectedNodeIDs: Set<LocalElementID> = []
    var selectedPortIDs: Set<LocalElementID> = []
    var selectedEdgeIDs: Set<LocalElementID> = []
    let selectedContextIDs = Set(
      content.presentation.contextEdges.lazy.map(\.localID).filter(selectedLocalIDs.contains)
    )

    for localID in selectedLocalIDs {
      if content.node(for: localID) != nil {
        rootNodeIDs.insert(localID)
        selectedNodeIDs.insert(localID)
      } else if content.port(for: localID) != nil {
        selectedPortIDs.insert(localID)
        if let nodeID = content.nodeLocalID(for: localID) {
          rootNodeIDs.insert(nodeID)
        }
      } else if content.edge(for: localID) != nil {
        selectedEdgeIDs.insert(localID)
        if let endpoints = content.endpointNodeLocalIDs(for: localID) {
          rootNodeIDs.insert(endpoints.first)
          rootNodeIDs.insert(endpoints.second)
        }
      }
    }

    let topology = content.layoutInput.topology
    let traversalRoots = Array(topology.nodeIDs.filter(rootNodeIDs.contains).reversed())
    func closure(
      neighbors: (LocalElementID) -> [LocalElementID]
    ) -> Set<LocalElementID> {
      var visited = rootNodeIDs
      var stack = traversalRoots
      while let nodeID = stack.popLast() {
        for relatedNodeID in neighbors(nodeID).reversed()
        where visited.insert(relatedNodeID).inserted {
          stack.append(relatedNodeID)
        }
      }
      return visited
    }

    var visitedNodeIDs = rootNodeIDs
    if inclusion.contains(.directedAncestors) {
      visitedNodeIDs.formUnion(
        closure(neighbors: topology.directedPredecessorNodeIDs)
      )
    }
    if inclusion.contains(.directedDescendants) {
      visitedNodeIDs.formUnion(
        closure(neighbors: topology.directedSuccessorNodeIDs)
      )
    }
    if inclusion.contains(.containingAncestors) {
      visitedNodeIDs.formUnion(
        closure { topology.containerNodeID(of: $0).map { [$0] } ?? [] }
      )
    }
    if inclusion.contains(.containedDescendants) {
      visitedNodeIDs.formUnion(
        closure(neighbors: topology.memberNodeIDs)
      )
    }

    var includedNodeIDs = visitedNodeIDs
    if !inclusion.contains(.selectedElements) {
      includedNodeIDs.subtract(rootNodeIDs)
    }
    if inclusion.contains(.selectedElements) {
      includedNodeIDs.formUnion(selectedNodeIDs)
    }

    var includedPortIDs = inclusion.contains(.selectedElements) ? selectedPortIDs : []
    if inclusion.contains(.nodePorts) {
      for port in content.presentation.ports {
        if let nodeID = content.nodeLocalID(for: port.localID),
          includedNodeIDs.contains(nodeID)
        {
          includedPortIDs.insert(port.localID)
        }
      }
    }

    var includedEdgeIDs = inclusion.contains(.selectedElements) ? selectedEdgeIDs : []
    if inclusion.contains(.connectingEdges) {
      for edge in content.presentation.edges {
        guard let endpoints = content.endpointNodeLocalIDs(for: edge.localID),
          includedNodeIDs.contains(endpoints.first),
          includedNodeIDs.contains(endpoints.second)
        else {
          continue
        }
        includedEdgeIDs.insert(edge.localID)
      }
    }

    var includedContextIDs = inclusion.contains(.selectedElements) ? selectedContextIDs : []
    if inclusion.contains(.contextRecords), !content.presentation.contextEdges.isEmpty {
      let nodeIDsByInstance = Dictionary(
        grouping: content.presentation.nodes.compactMap {
          node -> (
            FlowingGraphInstanceHandle,
            LocalElementID
          )? in
          guard case .source(let handle, _, _) = node.localID else { return nil }
          return (handle, node.localID)
        },
        by: \.0
      ).mapValues { $0.map(\.1) }
      for context in content.presentation.contextEdges {
        let containerID = LocalElementID.source(
          instanceHandle: context.sourceInstanceHandle,
          elementID: .node(context.site.nodeID),
          occurrenceID: nil
        )
        let memberIDs = context.targetInstanceHandle.flatMap { nodeIDsByInstance[$0] } ?? []
        if includedNodeIDs.contains(containerID)
          || memberIDs.contains(where: includedNodeIDs.contains)
        {
          includedContextIDs.insert(context.localID)
        }
      }
    }

    return try makeSlice(
      content: content,
      nodeLocalIDs: content.presentation.nodes.map(\.localID).filter(includedNodeIDs.contains),
      portLocalIDs: content.presentation.ports.map(\.localID).filter(includedPortIDs.contains),
      edgeLocalIDs: content.presentation.edges.map(\.localID).filter(includedEdgeIDs.contains),
      contextLocalIDs: content.presentation.contextEdges.map(\.localID)
        .filter(includedContextIDs.contains)
    )
  }

  private static func makeSlice<Schema: FlowingGraphCanvasSchema>(
    content: FlowingGraphCanvasContent<Schema>,
    nodeLocalIDs: [FlowingGraphPresentationLocalElementID<Schema>],
    portLocalIDs: [FlowingGraphPresentationLocalElementID<Schema>],
    edgeLocalIDs: [FlowingGraphPresentationLocalElementID<Schema>],
    contextLocalIDs: [FlowingGraphPresentationLocalElementID<Schema>]
  ) throws -> FlowingGraphExportSlice<Schema> {
    let localIDs = nodeLocalIDs + portLocalIDs + edgeLocalIDs + contextLocalIDs
    let elementIDs = Set(localIDs.compactMap(content.elementID))
    let bounds = (nodeLocalIDs + portLocalIDs + edgeLocalIDs)
      .compactMap(content.bounds(forLocalID:))
      .reduce(nil as CGRect?) { current, next in current?.union(next) ?? next }
    guard let bounds else {
      throw FlowingGraphExportScopeIssue<Schema>.emptyScope
    }
    return FlowingGraphExportSlice(
      inputID: content.id,
      nodeLocalIDs: nodeLocalIDs,
      portLocalIDs: portLocalIDs,
      edgeLocalIDs: edgeLocalIDs,
      contextLocalIDs: contextLocalIDs,
      elementIDs: elementIDs,
      contentBounds: bounds
    )
  }
}
