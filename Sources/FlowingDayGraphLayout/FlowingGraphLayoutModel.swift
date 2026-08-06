import CoreGraphics
import FlowingDayGraphCore
import Foundation

public typealias FlowingGraphPresentationSnapshotID =
  FlowingDayGraphCore.FlowingGraphPresentationSnapshotID

public protocol FlowingGraphLayoutSchema: Sendable {
  associatedtype NodeID: Hashable & Sendable
  associatedtype PortID: Hashable & Sendable
  associatedtype EdgeID: Hashable & Sendable
}

public struct FlowingLayoutRevision: Hashable, Sendable {
  private let rawValue: UUID

  public init() {
    rawValue = UUID()
  }
}

public struct FlowingLayoutComponentIdentity: Hashable, Sendable {
  public let id: UUID
  public let revision: UInt64

  public init(id: UUID = UUID(), revision: UInt64 = 0) {
    self.id = id
    self.revision = revision
  }
}

public struct FlowingLayoutPipelineStageRole: RawRepresentable, Hashable, Sendable {
  public let rawValue: String

  public init(rawValue: String) {
    precondition(!rawValue.isEmpty)
    self.rawValue = rawValue
  }

  public static let strategy = Self(rawValue: "strategy")
  public static let placement = Self(rawValue: "placement")
  public static let layerAssignment = Self(rawValue: "layer-assignment")
  public static let layerOrdering = Self(rawValue: "layer-ordering")
  public static let coordinateAssignment = Self(rawValue: "coordinate-assignment")
  public static let levelLayout = Self(rawValue: "level-layout")
  public static let containerGeometry = Self(rawValue: "container-geometry")
  public static let postprocessing = Self(rawValue: "postprocessing")
  public static let postprocessor = Self(rawValue: "postprocessor")
  public static let edgeRouting = Self(rawValue: "edge-routing")
}

public indirect enum FlowingLayoutPipelineStageIdentity: Hashable, Sendable {
  case component(
    role: FlowingLayoutPipelineStageRole,
    identity: FlowingLayoutComponentIdentity
  )
  case group(
    role: FlowingLayoutPipelineStageRole,
    stages: [FlowingLayoutPipelineStageIdentity]
  )
}

public struct FlowingLayoutPipelineIdentity: Hashable, Sendable {
  public let stages: [FlowingLayoutPipelineStageIdentity]

  public init(stages: [FlowingLayoutPipelineStageIdentity]) {
    self.stages = stages
  }

  public init(
    role: FlowingLayoutPipelineStageRole = .strategy,
    component: FlowingLayoutComponentIdentity
  ) {
    stages = [.component(role: role, identity: component)]
  }
}

public struct FlowingLayoutInputID: Hashable, Sendable {
  public let presentationSnapshotID: FlowingGraphPresentationSnapshotID
  public let pipelineIdentity: FlowingLayoutPipelineIdentity
  public let nodeSizeRevision: FlowingLayoutComponentIdentity
  public let portAnchorRevision: FlowingLayoutComponentIdentity
  public let layoutStateRevision: FlowingLayoutRevision

  public init(
    presentationSnapshotID: FlowingGraphPresentationSnapshotID,
    pipelineIdentity: FlowingLayoutPipelineIdentity,
    nodeSizeRevision: FlowingLayoutComponentIdentity,
    portAnchorRevision: FlowingLayoutComponentIdentity,
    layoutStateRevision: FlowingLayoutRevision
  ) {
    self.presentationSnapshotID = presentationSnapshotID
    self.pipelineIdentity = pipelineIdentity
    self.nodeSizeRevision = nodeSizeRevision
    self.portAnchorRevision = portAnchorRevision
    self.layoutStateRevision = layoutStateRevision
  }
}

public struct FlowingGraphLayoutPortKey<Schema: FlowingGraphLayoutSchema>: Hashable, Sendable {
  public let nodeID: Schema.NodeID
  public let portID: Schema.PortID

  public init(nodeID: Schema.NodeID, portID: Schema.PortID) {
    self.nodeID = nodeID
    self.portID = portID
  }
}

public struct FlowingGraphLayoutPort<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let key: FlowingGraphLayoutPortKey<Schema>

  public var id: Schema.PortID {
    key.portID
  }

  public var nodeID: Schema.NodeID {
    key.nodeID
  }

  public init(id: Schema.PortID, nodeID: Schema.NodeID) {
    key = FlowingGraphLayoutPortKey(nodeID: nodeID, portID: id)
  }

  public init(key: FlowingGraphLayoutPortKey<Schema>) {
    self.key = key
  }
}

extension FlowingGraphLayoutPort: Equatable {}

public enum FlowingGraphLayoutEndpoint<Schema: FlowingGraphLayoutSchema>: Sendable {
  case node(Schema.NodeID)
  case port(FlowingGraphLayoutPortKey<Schema>)
}

extension FlowingGraphLayoutEndpoint: Equatable {}
extension FlowingGraphLayoutEndpoint: Hashable {}

public enum FlowingGraphLayoutEdgeEndpoints<Schema: FlowingGraphLayoutSchema>: Sendable {
  case directed(
    source: FlowingGraphLayoutEndpoint<Schema>,
    target: FlowingGraphLayoutEndpoint<Schema>
  )
  case undirected(
    FlowingGraphLayoutEndpoint<Schema>,
    FlowingGraphLayoutEndpoint<Schema>
  )
}

extension FlowingGraphLayoutEdgeEndpoints: Equatable {
  public static func == (
    lhs: FlowingGraphLayoutEdgeEndpoints,
    rhs: FlowingGraphLayoutEdgeEndpoints
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

public struct FlowingGraphLayoutEdge<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let id: Schema.EdgeID
  public let endpoints: FlowingGraphLayoutEdgeEndpoints<Schema>

  public init(
    id: Schema.EdgeID,
    endpoints: FlowingGraphLayoutEdgeEndpoints<Schema>
  ) {
    self.id = id
    self.endpoints = endpoints
  }
}

extension FlowingGraphLayoutEdge: Equatable {}

public struct FlowingGraphLayoutContainment<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let containerNodeID: Schema.NodeID
  public let memberNodeIDs: [Schema.NodeID]

  public init(containerNodeID: Schema.NodeID, memberNodeIDs: [Schema.NodeID]) {
    self.containerNodeID = containerNodeID
    self.memberNodeIDs = memberNodeIDs
  }
}

extension FlowingGraphLayoutContainment: Equatable {}

public enum FlowingGraphLayoutTopologyIssue<Schema: FlowingGraphLayoutSchema>: Error {
  case duplicateNodeID(Schema.NodeID)
  case duplicatePortKey(FlowingGraphLayoutPortKey<Schema>)
  case duplicateEdgeID(Schema.EdgeID)
  case unknownPortNode(portID: Schema.PortID, nodeID: Schema.NodeID)
  case unknownNodeEndpoint(Schema.NodeID)
  case unknownPortEndpoint(FlowingGraphLayoutPortKey<Schema>)
  case duplicateContainmentContainer(Schema.NodeID)
  case unknownContainmentContainer(Schema.NodeID)
  case duplicateContainmentMember(container: Schema.NodeID, member: Schema.NodeID)
  case unknownContainmentMember(container: Schema.NodeID, member: Schema.NodeID)
  case selfContainment(Schema.NodeID)
  case multipleContainmentParents(
    member: Schema.NodeID,
    firstContainer: Schema.NodeID,
    secondContainer: Schema.NodeID
  )
  case containmentCycle([Schema.NodeID])
}

extension FlowingGraphLayoutTopologyIssue: Equatable {}

public struct FlowingGraphLayoutTopology<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let snapshotID: FlowingGraphPresentationSnapshotID
  public let nodeIDs: [Schema.NodeID]
  public let ports: [FlowingGraphLayoutPort<Schema>]
  public let edges: [FlowingGraphLayoutEdge<Schema>]
  public let containments: [FlowingGraphLayoutContainment<Schema>]

  private let successorsByNodeID: [Schema.NodeID: [Schema.NodeID]]
  private let predecessorsByNodeID: [Schema.NodeID: [Schema.NodeID]]
  private let adjacentNodeIDsByNodeID: [Schema.NodeID: [Schema.NodeID]]
  private let membersByContainerNodeID: [Schema.NodeID: [Schema.NodeID]]
  private let containerByMemberNodeID: [Schema.NodeID: Schema.NodeID]

  public init(
    snapshotID: FlowingGraphPresentationSnapshotID = .init(),
    nodeIDs: [Schema.NodeID],
    ports: [FlowingGraphLayoutPort<Schema>],
    edges: [FlowingGraphLayoutEdge<Schema>],
    containments: [FlowingGraphLayoutContainment<Schema>] = []
  ) throws {
    var knownNodeIDs: Set<Schema.NodeID> = []
    for nodeID in nodeIDs where !knownNodeIDs.insert(nodeID).inserted {
      throw FlowingGraphLayoutTopologyIssue<Schema>.duplicateNodeID(nodeID)
    }

    var nextPortByKey: [FlowingGraphLayoutPortKey<Schema>: FlowingGraphLayoutPort<Schema>] = [:]
    for port in ports {
      guard knownNodeIDs.contains(port.nodeID) else {
        throw FlowingGraphLayoutTopologyIssue<Schema>.unknownPortNode(
          portID: port.id,
          nodeID: port.nodeID
        )
      }
      guard nextPortByKey.updateValue(port, forKey: port.key) == nil else {
        throw FlowingGraphLayoutTopologyIssue<Schema>.duplicatePortKey(port.key)
      }
    }

    var knownEdgeIDs: Set<Schema.EdgeID> = []
    var nextSuccessorsByNodeID: [Schema.NodeID: [Schema.NodeID]] = [:]
    var nextPredecessorsByNodeID: [Schema.NodeID: [Schema.NodeID]] = [:]
    var nextAdjacentNodeIDsByNodeID: [Schema.NodeID: [Schema.NodeID]] = [:]
    for edge in edges {
      guard knownEdgeIDs.insert(edge.id).inserted else {
        throw FlowingGraphLayoutTopologyIssue<Schema>.duplicateEdgeID(edge.id)
      }
      for endpoint in edge.endpoints.elements {
        switch endpoint {
        case .node(let nodeID) where !knownNodeIDs.contains(nodeID):
          throw FlowingGraphLayoutTopologyIssue<Schema>.unknownNodeEndpoint(nodeID)
        case .port(let key) where nextPortByKey[key] == nil:
          throw FlowingGraphLayoutTopologyIssue<Schema>.unknownPortEndpoint(key)
        default:
          break
        }
      }
      let endpointNodeIDs = edge.endpoints.elements.map { endpoint -> Schema.NodeID in
        switch endpoint {
        case .node(let nodeID):
          nodeID
        case .port(let key):
          nextPortByKey[key]!.nodeID
        }
      }
      let first = endpointNodeIDs[0]
      let second = endpointNodeIDs[1]
      nextAdjacentNodeIDsByNodeID[first, default: []].append(second)
      if first != second {
        nextAdjacentNodeIDsByNodeID[second, default: []].append(first)
      }
      if case .directed = edge.endpoints {
        nextSuccessorsByNodeID[first, default: []].append(second)
        nextPredecessorsByNodeID[second, default: []].append(first)
      }
    }

    var nextMembersByContainerNodeID: [Schema.NodeID: [Schema.NodeID]] = [:]
    var nextContainerByMemberNodeID: [Schema.NodeID: Schema.NodeID] = [:]
    for containment in containments {
      let container = containment.containerNodeID
      guard knownNodeIDs.contains(container) else {
        throw FlowingGraphLayoutTopologyIssue<Schema>.unknownContainmentContainer(container)
      }
      guard nextMembersByContainerNodeID[container] == nil else {
        throw FlowingGraphLayoutTopologyIssue<Schema>.duplicateContainmentContainer(container)
      }
      var knownMembers: Set<Schema.NodeID> = []
      for member in containment.memberNodeIDs {
        guard knownNodeIDs.contains(member) else {
          throw FlowingGraphLayoutTopologyIssue<Schema>.unknownContainmentMember(
            container: container,
            member: member
          )
        }
        guard member != container else {
          throw FlowingGraphLayoutTopologyIssue<Schema>.selfContainment(container)
        }
        guard knownMembers.insert(member).inserted else {
          throw FlowingGraphLayoutTopologyIssue<Schema>.duplicateContainmentMember(
            container: container,
            member: member
          )
        }
        if let firstContainer = nextContainerByMemberNodeID[member] {
          throw FlowingGraphLayoutTopologyIssue<Schema>.multipleContainmentParents(
            member: member,
            firstContainer: firstContainer,
            secondContainer: container
          )
        }
        nextContainerByMemberNodeID[member] = container
      }
      nextMembersByContainerNodeID[container] = containment.memberNodeIDs
    }
    if let cycle = Self.containmentCycle(
      nodeIDs: nodeIDs,
      containerByMemberNodeID: nextContainerByMemberNodeID
    ) {
      throw FlowingGraphLayoutTopologyIssue<Schema>.containmentCycle(cycle)
    }

    self.snapshotID = snapshotID
    self.nodeIDs = nodeIDs
    self.ports = ports
    self.edges = edges
    self.containments = containments
    successorsByNodeID = nextSuccessorsByNodeID
    predecessorsByNodeID = nextPredecessorsByNodeID
    adjacentNodeIDsByNodeID = nextAdjacentNodeIDsByNodeID
    membersByContainerNodeID = nextMembersByContainerNodeID
    containerByMemberNodeID = nextContainerByMemberNodeID
  }

  public func nodeID(
    for endpoint: FlowingGraphLayoutEndpoint<Schema>
  ) -> Schema.NodeID {
    switch endpoint {
    case .node(let nodeID):
      nodeID
    case .port(let key):
      key.nodeID
    }
  }

  public func directedSuccessorNodeIDs(of nodeID: Schema.NodeID) -> [Schema.NodeID] {
    successorsByNodeID[nodeID, default: []]
  }

  public func directedPredecessorNodeIDs(of nodeID: Schema.NodeID) -> [Schema.NodeID] {
    predecessorsByNodeID[nodeID, default: []]
  }

  public func adjacentNodeIDs(of nodeID: Schema.NodeID) -> [Schema.NodeID] {
    adjacentNodeIDsByNodeID[nodeID, default: []]
  }

  public func memberNodeIDs(of containerNodeID: Schema.NodeID) -> [Schema.NodeID] {
    membersByContainerNodeID[containerNodeID, default: []]
  }

  public func containerNodeID(of memberNodeID: Schema.NodeID) -> Schema.NodeID? {
    containerByMemberNodeID[memberNodeID]
  }

  public var rootNodeIDs: [Schema.NodeID] {
    nodeIDs.filter { containerByMemberNodeID[$0] == nil }
  }

  public func weaklyConnectedComponents() -> [[Schema.NodeID]] {
    var visited: Set<Schema.NodeID> = []
    var components: [[Schema.NodeID]] = []
    for root in nodeIDs where visited.insert(root).inserted {
      var component: [Schema.NodeID] = []
      var stack = [root]
      while let nodeID = stack.popLast() {
        component.append(nodeID)
        for adjacent in adjacentNodeIDs(of: nodeID).reversed()
        where visited.insert(adjacent).inserted {
          stack.append(adjacent)
        }
      }
      components.append(component)
    }
    return components
  }

  private static func containmentCycle(
    nodeIDs: [Schema.NodeID],
    containerByMemberNodeID: [Schema.NodeID: Schema.NodeID]
  ) -> [Schema.NodeID]? {
    var complete: Set<Schema.NodeID> = []
    for root in nodeIDs where !complete.contains(root) {
      var path: [Schema.NodeID] = []
      var pathIndexByNodeID: [Schema.NodeID: Int] = [:]
      var current: Schema.NodeID? = root
      while let nodeID = current, !complete.contains(nodeID) {
        if let cycleStart = pathIndexByNodeID[nodeID] {
          return Array(path[cycleStart...]) + [nodeID]
        }
        pathIndexByNodeID[nodeID] = path.count
        path.append(nodeID)
        current = containerByMemberNodeID[nodeID]
      }
      complete.formUnion(path)
    }
    return nil
  }
}

public struct FlowingGraphLayoutNodeSize<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let nodeID: Schema.NodeID
  public let size: CGSize

  public init(nodeID: Schema.NodeID, size: CGSize) {
    self.nodeID = nodeID
    self.size = size
  }
}

extension FlowingGraphLayoutNodeSize: Equatable {}

public struct FlowingGraphPortAnchor<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let key: FlowingGraphLayoutPortKey<Schema>
  public let position: CGPoint
  public let normal: CGVector

  public init(
    key: FlowingGraphLayoutPortKey<Schema>,
    position: CGPoint,
    normal: CGVector
  ) {
    self.key = key
    self.position = position
    self.normal = normal
  }
}

extension FlowingGraphPortAnchor: Equatable {}

public struct FlowingGraphNodePlacementState<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let nodeID: Schema.NodeID
  public let offset: CGSize

  public init(nodeID: Schema.NodeID, offset: CGSize) {
    self.nodeID = nodeID
    self.offset = offset
  }
}

extension FlowingGraphNodePlacementState: Equatable {}

public enum FlowingGraphLayoutInputIssue<Schema: FlowingGraphLayoutSchema>: Error {
  case presentationSnapshotIdentityMismatch
  case duplicateNodeSize(Schema.NodeID)
  case missingNodeSize(Schema.NodeID)
  case unknownNodeSize(Schema.NodeID)
  case invalidNodeSize(Schema.NodeID)
  case duplicatePortAnchor(FlowingGraphLayoutPortKey<Schema>)
  case missingPortAnchor(FlowingGraphLayoutPortKey<Schema>)
  case unknownPortAnchor(FlowingGraphLayoutPortKey<Schema>)
  case invalidPortAnchor(FlowingGraphLayoutPortKey<Schema>)
  case duplicatePlacementState(Schema.NodeID)
  case unknownPlacementState(Schema.NodeID)
  case invalidPlacementState(Schema.NodeID)
}

extension FlowingGraphLayoutInputIssue: Equatable {}

public struct FlowingGraphLayoutInput<Schema: FlowingGraphLayoutSchema>: Sendable {
  public let id: FlowingLayoutInputID
  public let topology: FlowingGraphLayoutTopology<Schema>
  public let nodeSizes: [FlowingGraphLayoutNodeSize<Schema>]
  public let portAnchors: [FlowingGraphPortAnchor<Schema>]
  public let placementState: [FlowingGraphNodePlacementState<Schema>]

  private let nodeSizeByID: [Schema.NodeID: CGSize]
  private let portAnchorByKey: [FlowingGraphLayoutPortKey<Schema>: FlowingGraphPortAnchor<Schema>]
  private let placementOffsetByID: [Schema.NodeID: CGSize]

  public init(
    id: FlowingLayoutInputID,
    topology: FlowingGraphLayoutTopology<Schema>,
    nodeSizes: [FlowingGraphLayoutNodeSize<Schema>],
    portAnchors: [FlowingGraphPortAnchor<Schema>],
    placementState: [FlowingGraphNodePlacementState<Schema>] = []
  ) throws {
    guard id.presentationSnapshotID == topology.snapshotID else {
      throw FlowingGraphLayoutInputIssue<Schema>.presentationSnapshotIdentityMismatch
    }
    let knownNodeIDs = Set(topology.nodeIDs)
    let knownPortKeys = Set(topology.ports.map(\.key))
    var nextNodeSizeByID: [Schema.NodeID: CGSize] = [:]
    for entry in nodeSizes {
      guard knownNodeIDs.contains(entry.nodeID) else {
        throw FlowingGraphLayoutInputIssue<Schema>.unknownNodeSize(entry.nodeID)
      }
      guard entry.size.isFinite, entry.size.width >= 0, entry.size.height >= 0 else {
        throw FlowingGraphLayoutInputIssue<Schema>.invalidNodeSize(entry.nodeID)
      }
      guard nextNodeSizeByID.updateValue(entry.size, forKey: entry.nodeID) == nil else {
        throw FlowingGraphLayoutInputIssue<Schema>.duplicateNodeSize(entry.nodeID)
      }
    }
    for nodeID in topology.nodeIDs where nextNodeSizeByID[nodeID] == nil {
      throw FlowingGraphLayoutInputIssue<Schema>.missingNodeSize(nodeID)
    }

    var nextPortAnchorByKey: [FlowingGraphLayoutPortKey<Schema>: FlowingGraphPortAnchor<Schema>] =
      [:]
    for anchor in portAnchors {
      guard knownPortKeys.contains(anchor.key) else {
        throw FlowingGraphLayoutInputIssue<Schema>.unknownPortAnchor(anchor.key)
      }
      guard anchor.position.isFinite, anchor.normal.isFinite else {
        throw FlowingGraphLayoutInputIssue<Schema>.invalidPortAnchor(anchor.key)
      }
      guard nextPortAnchorByKey.updateValue(anchor, forKey: anchor.key) == nil else {
        throw FlowingGraphLayoutInputIssue<Schema>.duplicatePortAnchor(anchor.key)
      }
    }
    for port in topology.ports where nextPortAnchorByKey[port.key] == nil {
      throw FlowingGraphLayoutInputIssue<Schema>.missingPortAnchor(port.key)
    }

    var nextPlacementOffsetByID: [Schema.NodeID: CGSize] = [:]
    for state in placementState {
      guard knownNodeIDs.contains(state.nodeID) else {
        throw FlowingGraphLayoutInputIssue<Schema>.unknownPlacementState(state.nodeID)
      }
      guard state.offset.isFinite else {
        throw FlowingGraphLayoutInputIssue<Schema>.invalidPlacementState(state.nodeID)
      }
      guard nextPlacementOffsetByID.updateValue(state.offset, forKey: state.nodeID) == nil else {
        throw FlowingGraphLayoutInputIssue<Schema>.duplicatePlacementState(state.nodeID)
      }
    }

    self.id = id
    self.topology = topology
    self.nodeSizes = topology.nodeIDs.map {
      FlowingGraphLayoutNodeSize(nodeID: $0, size: nextNodeSizeByID[$0]!)
    }
    self.portAnchors = topology.ports.map { nextPortAnchorByKey[$0.key]! }
    self.placementState = topology.nodeIDs.compactMap { nodeID in
      nextPlacementOffsetByID[nodeID].map {
        FlowingGraphNodePlacementState(nodeID: nodeID, offset: $0)
      }
    }
    nodeSizeByID = nextNodeSizeByID
    portAnchorByKey = nextPortAnchorByKey
    placementOffsetByID = nextPlacementOffsetByID
  }

  public func size(for nodeID: Schema.NodeID) -> CGSize? {
    nodeSizeByID[nodeID]
  }

  public func anchor(
    for key: FlowingGraphLayoutPortKey<Schema>
  ) -> FlowingGraphPortAnchor<Schema>? {
    portAnchorByKey[key]
  }

  public func placementOffset(for nodeID: Schema.NodeID) -> CGSize? {
    guard nodeSizeByID[nodeID] != nil else { return nil }
    return placementOffsetByID[nodeID] ?? .zero
  }

  func resolvedSize(for nodeID: Schema.NodeID) -> CGSize {
    nodeSizeByID[nodeID]!
  }

  func resolvedAnchor(
    for key: FlowingGraphLayoutPortKey<Schema>
  ) -> FlowingGraphPortAnchor<Schema> {
    portAnchorByKey[key]!
  }

  func resolvedPlacementOffset(for nodeID: Schema.NodeID) -> CGSize {
    placementOffsetByID[nodeID] ?? .zero
  }
}

extension FlowingGraphLayoutEdgeEndpoints {
  fileprivate var elements: [FlowingGraphLayoutEndpoint<Schema>] {
    switch self {
    case .directed(let source, let target):
      [source, target]
    case .undirected(let first, let second):
      [first, second]
    }
  }
}

extension CGPoint {
  fileprivate var isFinite: Bool {
    x.isFinite && y.isFinite
  }
}

extension CGSize {
  fileprivate var isFinite: Bool {
    width.isFinite && height.isFinite
  }
}

extension CGVector {
  fileprivate var isFinite: Bool {
    dx.isFinite && dy.isFinite
  }
}
