import type { FdCanvasPoint, FdCanvasSize } from '../geometry.js'
import type { FdGraphElementID } from '../graph/model.js'
import { graphElementKey } from '../graph/model.js'

export type FdGraphPresentationSnapshotID = string | number

export class FdLayoutRevision {}

export class FdLayoutComponentIdentity {
  readonly id: string
  readonly revision: number

  constructor(id: string = crypto.randomUUID(), revision = 0) {
    if (!Number.isSafeInteger(revision) || revision < 0) {
      throw new RangeError('layout component revision must be a nonnegative safe integer')
    }
    this.id = id
    this.revision = revision
  }
}

export class FdLayoutPipelineStageRole {
  readonly rawValue: string

  constructor(rawValue: string) {
    if (rawValue.length === 0) throw new RangeError('layout pipeline stage role must not be empty')
    this.rawValue = rawValue
  }

  static readonly strategy = new FdLayoutPipelineStageRole('strategy')
  static readonly placement = new FdLayoutPipelineStageRole('placement')
  static readonly layerAssignment = new FdLayoutPipelineStageRole('layer-assignment')
  static readonly layerOrdering = new FdLayoutPipelineStageRole('layer-ordering')
  static readonly coordinateAssignment = new FdLayoutPipelineStageRole('coordinate-assignment')
  static readonly levelLayout = new FdLayoutPipelineStageRole('level-layout')
  static readonly containerGeometry = new FdLayoutPipelineStageRole('container-geometry')
  static readonly postprocessing = new FdLayoutPipelineStageRole('postprocessing')
  static readonly postprocessor = new FdLayoutPipelineStageRole('postprocessor')
  static readonly edgeRouting = new FdLayoutPipelineStageRole('edge-routing')
}

export type FdLayoutPipelineStageIdentity =
  | {
      readonly kind: 'component'
      readonly role: FdLayoutPipelineStageRole
      readonly identity: FdLayoutComponentIdentity
    }
  | {
      readonly kind: 'group'
      readonly role: FdLayoutPipelineStageRole
      readonly stages: readonly FdLayoutPipelineStageIdentity[]
    }

export class FdLayoutPipelineIdentity {
  readonly stages: readonly FdLayoutPipelineStageIdentity[]

  constructor(stages: readonly FdLayoutPipelineStageIdentity[])
  constructor(component: FdLayoutComponentIdentity, role?: FdLayoutPipelineStageRole)
  constructor(
    stagesOrComponent: readonly FdLayoutPipelineStageIdentity[] | FdLayoutComponentIdentity,
    role = FdLayoutPipelineStageRole.strategy,
  ) {
    this.stages = Array.isArray(stagesOrComponent)
      ? stagesOrComponent
      : [{ kind: 'component', role, identity: stagesOrComponent as FdLayoutComponentIdentity }]
  }
}

export class FdLayoutInputID {
  readonly presentationSnapshotID: FdGraphPresentationSnapshotID
  readonly pipelineIdentity: FdLayoutPipelineIdentity
  readonly nodeSizeRevision: FdLayoutComponentIdentity
  readonly portAnchorRevision: FdLayoutComponentIdentity
  readonly layoutStateRevision: FdLayoutRevision

  constructor(
    presentationSnapshotID: FdGraphPresentationSnapshotID,
    pipelineIdentity: FdLayoutPipelineIdentity,
    nodeSizeRevision: FdLayoutComponentIdentity,
    portAnchorRevision: FdLayoutComponentIdentity,
    layoutStateRevision: FdLayoutRevision,
  ) {
    this.presentationSnapshotID = presentationSnapshotID
    this.pipelineIdentity = pipelineIdentity
    this.nodeSizeRevision = nodeSizeRevision
    this.portAnchorRevision = portAnchorRevision
    this.layoutStateRevision = layoutStateRevision
  }
}

export interface FdGraphLayoutPortKey<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
> {
  readonly nodeID: NodeID
  readonly portID: PortID
}

export class FdGraphLayoutPort<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
> {
  readonly key: FdGraphLayoutPortKey<NodeID, PortID>

  constructor(id: PortID, nodeID: NodeID)
  constructor(key: FdGraphLayoutPortKey<NodeID, PortID>)
  constructor(idOrKey: PortID | FdGraphLayoutPortKey<NodeID, PortID>, nodeID?: NodeID) {
    this.key = typeof idOrKey === 'object' ? idOrKey : { nodeID: nodeID as NodeID, portID: idOrKey }
  }

  get id(): PortID {
    return this.key.portID
  }

  get nodeID(): NodeID {
    return this.key.nodeID
  }
}

export type FdGraphLayoutEndpoint<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
> =
  | { readonly kind: 'node'; readonly nodeID: NodeID }
  | { readonly kind: 'port'; readonly key: FdGraphLayoutPortKey<NodeID, PortID> }

export type FdGraphLayoutEdgeEndpoints<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
> =
  | {
      readonly kind: 'directed'
      readonly source: FdGraphLayoutEndpoint<NodeID, PortID>
      readonly target: FdGraphLayoutEndpoint<NodeID, PortID>
    }
  | {
      readonly kind: 'undirected'
      readonly first: FdGraphLayoutEndpoint<NodeID, PortID>
      readonly second: FdGraphLayoutEndpoint<NodeID, PortID>
    }

export interface FdGraphLayoutEdge<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly id: EdgeID
  readonly endpoints: FdGraphLayoutEdgeEndpoints<NodeID, PortID>
}

export interface FdGraphLayoutContainment<NodeID extends FdGraphElementID = FdGraphElementID> {
  readonly containerNodeID: NodeID
  readonly memberNodeIDs: readonly NodeID[]
}

type FdGraphLayoutTopologyIssueKind =
  | 'duplicateNodeID'
  | 'duplicatePortKey'
  | 'duplicateEdgeID'
  | 'unknownPortNode'
  | 'unknownNodeEndpoint'
  | 'unknownPortEndpoint'
  | 'duplicateContainmentContainer'
  | 'unknownContainmentContainer'
  | 'duplicateContainmentMember'
  | 'unknownContainmentMember'
  | 'selfContainment'
  | 'multipleContainmentParents'
  | 'containmentCycle'

export class FdGraphLayoutTopologyIssue extends Error {
  readonly kind: FdGraphLayoutTopologyIssueKind
  readonly details: Readonly<Record<string, unknown>>

  constructor(kind: FdGraphLayoutTopologyIssueKind, details: Readonly<Record<string, unknown>>) {
    super(kind)
    this.name = 'FdGraphLayoutTopologyIssue'
    this.kind = kind
    this.details = details
  }
}

interface FdGraphLayoutTopologyOptions<
  NodeID extends FdGraphElementID,
  PortID extends FdGraphElementID,
  EdgeID extends FdGraphElementID,
> {
  readonly snapshotID?: FdGraphPresentationSnapshotID
  readonly nodeIDs: readonly NodeID[]
  readonly ports: readonly FdGraphLayoutPort<NodeID, PortID>[]
  readonly edges: readonly FdGraphLayoutEdge<NodeID, PortID, EdgeID>[]
  readonly containments?: readonly FdGraphLayoutContainment<NodeID>[]
}

export class FdGraphLayoutTopology<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly snapshotID: FdGraphPresentationSnapshotID
  readonly nodeIDs: readonly NodeID[]
  readonly ports: readonly FdGraphLayoutPort<NodeID, PortID>[]
  readonly edges: readonly FdGraphLayoutEdge<NodeID, PortID, EdgeID>[]
  readonly containments: readonly FdGraphLayoutContainment<NodeID>[]
  readonly #successorsByNodeID = new Map<NodeID, NodeID[]>()
  readonly #predecessorsByNodeID = new Map<NodeID, NodeID[]>()
  readonly #adjacentNodeIDsByNodeID = new Map<NodeID, NodeID[]>()
  readonly #membersByContainerNodeID = new Map<NodeID, readonly NodeID[]>()
  readonly #containerByMemberNodeID = new Map<NodeID, NodeID>()

  constructor(options: FdGraphLayoutTopologyOptions<NodeID, PortID, EdgeID>) {
    const knownNodeIDs = new Map<string, NodeID>()
    for (const nodeID of options.nodeIDs) {
      const key = graphElementKey(nodeID)
      if (knownNodeIDs.has(key)) this.fail('duplicateNodeID', { nodeID })
      knownNodeIDs.set(key, nodeID)
    }

    const portByKey = new Map<string, FdGraphLayoutPort<NodeID, PortID>>()
    for (const port of options.ports) {
      if (!knownNodeIDs.has(graphElementKey(port.nodeID))) {
        this.fail('unknownPortNode', { portID: port.id, nodeID: port.nodeID })
      }
      const key = layoutPortKey(port.key)
      if (portByKey.has(key)) this.fail('duplicatePortKey', { key: port.key })
      portByKey.set(key, port)
    }

    const knownEdgeIDs = new Set<string>()
    for (const edge of options.edges) {
      const edgeKey = graphElementKey(edge.id)
      if (knownEdgeIDs.has(edgeKey)) this.fail('duplicateEdgeID', { edgeID: edge.id })
      knownEdgeIDs.add(edgeKey)
      const endpoints = edgeEndpoints(edge.endpoints)
      for (const endpoint of endpoints) this.validateEndpoint(endpoint, knownNodeIDs, portByKey)
      const first = this.nodeID(endpoints[0])
      const second = this.nodeID(endpoints[1])
      append(this.#adjacentNodeIDsByNodeID, first, second)
      if (first !== second) append(this.#adjacentNodeIDsByNodeID, second, first)
      if (edge.endpoints.kind === 'directed') {
        append(this.#successorsByNodeID, first, second)
        append(this.#predecessorsByNodeID, second, first)
      }
    }

    for (const containment of options.containments ?? []) {
      const container = containment.containerNodeID
      if (!knownNodeIDs.has(graphElementKey(container))) {
        this.fail('unknownContainmentContainer', { container })
      }
      if (this.#membersByContainerNodeID.has(container)) {
        this.fail('duplicateContainmentContainer', { container })
      }
      const knownMembers = new Set<string>()
      for (const member of containment.memberNodeIDs) {
        if (!knownNodeIDs.has(graphElementKey(member))) {
          this.fail('unknownContainmentMember', { container, member })
        }
        if (member === container) this.fail('selfContainment', { nodeID: container })
        const memberKey = graphElementKey(member)
        if (knownMembers.has(memberKey)) {
          this.fail('duplicateContainmentMember', { container, member })
        }
        knownMembers.add(memberKey)
        const firstContainer = this.#containerByMemberNodeID.get(member)
        if (firstContainer !== undefined) {
          this.fail('multipleContainmentParents', {
            member,
            firstContainer,
            secondContainer: container,
          })
        }
        this.#containerByMemberNodeID.set(member, container)
      }
      this.#membersByContainerNodeID.set(container, [...containment.memberNodeIDs])
    }

    const cycle = containmentCycle(options.nodeIDs, this.#containerByMemberNodeID)
    if (cycle) this.fail('containmentCycle', { nodeIDs: cycle })

    this.snapshotID = options.snapshotID ?? crypto.randomUUID()
    this.nodeIDs = [...options.nodeIDs]
    this.ports = [...options.ports]
    this.edges = [...options.edges]
    this.containments = [...(options.containments ?? [])]
  }

  nodeID(endpoint: FdGraphLayoutEndpoint<NodeID, PortID>): NodeID {
    return endpoint.kind === 'node' ? endpoint.nodeID : endpoint.key.nodeID
  }

  directedSuccessorNodeIDs(nodeID: NodeID): readonly NodeID[] {
    return this.#successorsByNodeID.get(nodeID) ?? []
  }

  directedPredecessorNodeIDs(nodeID: NodeID): readonly NodeID[] {
    return this.#predecessorsByNodeID.get(nodeID) ?? []
  }

  adjacentNodeIDs(nodeID: NodeID): readonly NodeID[] {
    return this.#adjacentNodeIDsByNodeID.get(nodeID) ?? []
  }

  memberNodeIDs(containerNodeID: NodeID): readonly NodeID[] {
    return this.#membersByContainerNodeID.get(containerNodeID) ?? []
  }

  containerNodeID(memberNodeID: NodeID): NodeID | undefined {
    return this.#containerByMemberNodeID.get(memberNodeID)
  }

  get rootNodeIDs(): readonly NodeID[] {
    return this.nodeIDs.filter((nodeID) => !this.#containerByMemberNodeID.has(nodeID))
  }

  weaklyConnectedComponents(): readonly (readonly NodeID[])[] {
    const visited = new Set<NodeID>()
    const components: NodeID[][] = []
    for (const root of this.nodeIDs) {
      if (visited.has(root)) continue
      visited.add(root)
      const component: NodeID[] = []
      const stack = [root]
      while (stack.length > 0) {
        const nodeID = stack.pop()
        if (nodeID === undefined) break
        component.push(nodeID)
        const adjacent = this.adjacentNodeIDs(nodeID)
        for (let index = adjacent.length - 1; index >= 0; index -= 1) {
          const candidate = adjacent[index]
          if (candidate === undefined || visited.has(candidate)) continue
          visited.add(candidate)
          stack.push(candidate)
        }
      }
      components.push(component)
    }
    return components
  }

  private validateEndpoint(
    endpoint: FdGraphLayoutEndpoint<NodeID, PortID>,
    knownNodeIDs: ReadonlyMap<string, NodeID>,
    portByKey: ReadonlyMap<string, FdGraphLayoutPort<NodeID, PortID>>,
  ): void {
    if (endpoint.kind === 'node') {
      if (!knownNodeIDs.has(graphElementKey(endpoint.nodeID))) {
        this.fail('unknownNodeEndpoint', { nodeID: endpoint.nodeID })
      }
    } else if (!portByKey.has(layoutPortKey(endpoint.key))) {
      this.fail('unknownPortEndpoint', { key: endpoint.key })
    }
  }

  private fail(kind: FdGraphLayoutTopologyIssueKind, details: Record<string, unknown>): never {
    throw new FdGraphLayoutTopologyIssue(kind, details)
  }
}

export interface FdGraphLayoutNodeSize<NodeID extends FdGraphElementID = FdGraphElementID> {
  readonly nodeID: NodeID
  readonly size: FdCanvasSize
}

export interface FdGraphPortAnchor<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
> {
  readonly key: FdGraphLayoutPortKey<NodeID, PortID>
  readonly position: FdCanvasPoint
  readonly normal: { readonly dx: number; readonly dy: number }
}

export interface FdGraphNodePlacementState<NodeID extends FdGraphElementID = FdGraphElementID> {
  readonly nodeID: NodeID
  readonly offset: FdCanvasSize
}

type FdGraphLayoutInputIssueKind =
  | 'presentationSnapshotIdentityMismatch'
  | 'duplicateNodeSize'
  | 'missingNodeSize'
  | 'unknownNodeSize'
  | 'invalidNodeSize'
  | 'duplicatePortAnchor'
  | 'missingPortAnchor'
  | 'unknownPortAnchor'
  | 'invalidPortAnchor'
  | 'duplicatePlacementState'
  | 'unknownPlacementState'
  | 'invalidPlacementState'

export class FdGraphLayoutInputIssue extends Error {
  readonly kind: FdGraphLayoutInputIssueKind
  readonly details: Readonly<Record<string, unknown>>

  constructor(kind: FdGraphLayoutInputIssueKind, details: Readonly<Record<string, unknown>> = {}) {
    super(kind)
    this.name = 'FdGraphLayoutInputIssue'
    this.kind = kind
    this.details = details
  }
}

interface FdGraphLayoutInputOptions<
  NodeID extends FdGraphElementID,
  PortID extends FdGraphElementID,
  EdgeID extends FdGraphElementID,
> {
  readonly id: FdLayoutInputID
  readonly topology: FdGraphLayoutTopology<NodeID, PortID, EdgeID>
  readonly nodeSizes: readonly FdGraphLayoutNodeSize<NodeID>[]
  readonly portAnchors: readonly FdGraphPortAnchor<NodeID, PortID>[]
  readonly placementState?: readonly FdGraphNodePlacementState<NodeID>[]
}

export class FdGraphLayoutInput<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly id: FdLayoutInputID
  readonly topology: FdGraphLayoutTopology<NodeID, PortID, EdgeID>
  readonly nodeSizes: readonly FdGraphLayoutNodeSize<NodeID>[]
  readonly portAnchors: readonly FdGraphPortAnchor<NodeID, PortID>[]
  readonly placementState: readonly FdGraphNodePlacementState<NodeID>[]
  readonly #nodeSizeByID = new Map<NodeID, FdCanvasSize>()
  readonly #portAnchorByKey = new Map<string, FdGraphPortAnchor<NodeID, PortID>>()
  readonly #placementOffsetByID = new Map<NodeID, FdCanvasSize>()

  constructor(options: FdGraphLayoutInputOptions<NodeID, PortID, EdgeID>) {
    if (options.id.presentationSnapshotID !== options.topology.snapshotID) {
      this.fail('presentationSnapshotIdentityMismatch')
    }
    const knownNodeIDs = new Set(options.topology.nodeIDs)
    const knownPortKeys = new Set(options.topology.ports.map(({ key }) => layoutPortKey(key)))

    for (const entry of options.nodeSizes) {
      if (!knownNodeIDs.has(entry.nodeID)) this.fail('unknownNodeSize', { nodeID: entry.nodeID })
      if (!validSize(entry.size)) this.fail('invalidNodeSize', { nodeID: entry.nodeID })
      if (this.#nodeSizeByID.has(entry.nodeID)) {
        this.fail('duplicateNodeSize', { nodeID: entry.nodeID })
      }
      this.#nodeSizeByID.set(entry.nodeID, entry.size)
    }
    for (const nodeID of options.topology.nodeIDs) {
      if (!this.#nodeSizeByID.has(nodeID)) this.fail('missingNodeSize', { nodeID })
    }

    for (const anchor of options.portAnchors) {
      const key = layoutPortKey(anchor.key)
      if (!knownPortKeys.has(key)) this.fail('unknownPortAnchor', { key: anchor.key })
      if (!validPoint(anchor.position) || !validVector(anchor.normal)) {
        this.fail('invalidPortAnchor', { key: anchor.key })
      }
      if (this.#portAnchorByKey.has(key)) this.fail('duplicatePortAnchor', { key: anchor.key })
      this.#portAnchorByKey.set(key, anchor)
    }
    for (const port of options.topology.ports) {
      if (!this.#portAnchorByKey.has(layoutPortKey(port.key))) {
        this.fail('missingPortAnchor', { key: port.key })
      }
    }

    for (const state of options.placementState ?? []) {
      if (!knownNodeIDs.has(state.nodeID)) {
        this.fail('unknownPlacementState', { nodeID: state.nodeID })
      }
      if (!validOffset(state.offset)) {
        this.fail('invalidPlacementState', { nodeID: state.nodeID })
      }
      if (this.#placementOffsetByID.has(state.nodeID)) {
        this.fail('duplicatePlacementState', { nodeID: state.nodeID })
      }
      this.#placementOffsetByID.set(state.nodeID, state.offset)
    }

    this.id = options.id
    this.topology = options.topology
    this.nodeSizes = options.topology.nodeIDs.map((nodeID) => ({
      nodeID,
      size: this.#nodeSizeByID.get(nodeID) as FdCanvasSize,
    }))
    this.portAnchors = options.topology.ports.map(
      ({ key }) =>
        this.#portAnchorByKey.get(layoutPortKey(key)) as FdGraphPortAnchor<NodeID, PortID>,
    )
    this.placementState = options.topology.nodeIDs.flatMap((nodeID) => {
      const offset = this.#placementOffsetByID.get(nodeID)
      return offset ? [{ nodeID, offset }] : []
    })
  }

  size(nodeID: NodeID): FdCanvasSize | undefined {
    return this.#nodeSizeByID.get(nodeID)
  }

  anchor(key: FdGraphLayoutPortKey<NodeID, PortID>): FdGraphPortAnchor<NodeID, PortID> | undefined {
    return this.#portAnchorByKey.get(layoutPortKey(key))
  }

  placementOffset(nodeID: NodeID): FdCanvasSize | undefined {
    if (!this.#nodeSizeByID.has(nodeID)) return undefined
    return this.#placementOffsetByID.get(nodeID) ?? { width: 0, height: 0 }
  }

  private fail(kind: FdGraphLayoutInputIssueKind, details?: Record<string, unknown>): never {
    throw new FdGraphLayoutInputIssue(kind, details)
  }
}

const layoutPortKey = <NodeID extends FdGraphElementID, PortID extends FdGraphElementID>(
  key: FdGraphLayoutPortKey<NodeID, PortID>,
): string => `${graphElementKey(key.nodeID)}:${graphElementKey(key.portID)}`

const edgeEndpoints = <NodeID extends FdGraphElementID, PortID extends FdGraphElementID>(
  endpoints: FdGraphLayoutEdgeEndpoints<NodeID, PortID>,
): readonly [FdGraphLayoutEndpoint<NodeID, PortID>, FdGraphLayoutEndpoint<NodeID, PortID>] =>
  endpoints.kind === 'directed'
    ? [endpoints.source, endpoints.target]
    : [endpoints.first, endpoints.second]

const append = <ID>(map: Map<ID, ID[]>, key: ID, value: ID): void => {
  const values = map.get(key) ?? []
  values.push(value)
  map.set(key, values)
}

const validPoint = ({ x, y }: FdCanvasPoint): boolean => Number.isFinite(x) && Number.isFinite(y)

const validVector = ({ dx, dy }: { readonly dx: number; readonly dy: number }): boolean =>
  Number.isFinite(dx) && Number.isFinite(dy)

const validOffset = ({ width, height }: FdCanvasSize): boolean =>
  Number.isFinite(width) && Number.isFinite(height)

const validSize = (size: FdCanvasSize): boolean =>
  validOffset(size) && size.width >= 0 && size.height >= 0

const containmentCycle = <NodeID>(
  nodeIDs: readonly NodeID[],
  containerByMemberNodeID: ReadonlyMap<NodeID, NodeID>,
): readonly NodeID[] | undefined => {
  const complete = new Set<NodeID>()
  for (const root of nodeIDs) {
    if (complete.has(root)) continue
    const path: NodeID[] = []
    const pathIndexByNodeID = new Map<NodeID, number>()
    let current: NodeID | undefined = root
    while (current !== undefined && !complete.has(current)) {
      const cycleStart = pathIndexByNodeID.get(current)
      if (cycleStart !== undefined) return [...path.slice(cycleStart), current]
      pathIndexByNodeID.set(current, path.length)
      path.push(current)
      current = containerByMemberNodeID.get(current)
    }
    for (const nodeID of path) complete.add(nodeID)
  }
  return undefined
}
