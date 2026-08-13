import type { FdCanvasPoint, FdCanvasRect } from '../geometry.js'
import { unionCanvasRects } from '../geometry.js'
import {
  type FdGraphLayoutEdge,
  type FdGraphLayoutEdgeEndpoints,
  type FdGraphLayoutEndpoint,
  type FdGraphLayoutInput,
  FdGraphLayoutPort,
  type FdGraphLayoutPortKey,
  FdGraphLayoutTopology,
  type FdLayoutInputID,
  sameLayoutInputID,
} from '../layout/model.js'
import type { FdGraphEdgeRoute, FdGraphLayoutResult } from '../layout/pipeline.js'
import {
  type FdGraphRenderElementIDs,
  FdGraphRenderIndex,
  FdGraphRenderIndexConfiguration,
  type FdGraphRenderSlice,
} from '../layout/render-index.js'
import type { FdGraphElementID } from './model.js'
import { graphElementKey } from './model.js'
import {
  type FdDecodedGraphPresentationLocalElementID,
  type FdGraphPresentation,
  type FdGraphPresentationEdge,
  type FdGraphPresentationEdgeEndpoints,
  type FdGraphPresentationEndpoint,
  FdGraphPresentationLocalElementID,
  type FdGraphPresentationNode,
  type FdGraphPresentationPort,
} from './presentation.js'

export type FdGraphCanvasContentIssueKind =
  | 'duplicateCanonicalIdentity'
  | 'duplicateLocalIdentity'
  | 'invalidPortOwnership'
  | 'invalidPresentationEndpoint'
  | 'presentationSnapshotIdentityMismatch'
  | 'layoutInputIdentityMismatch'
  | 'layoutTopologyMismatch'
  | 'renderIndexConstructionFailed'

export class FdGraphCanvasContentIssue extends Error {
  readonly kind: FdGraphCanvasContentIssueKind

  constructor(kind: FdGraphCanvasContentIssueKind) {
    super(kind)
    this.name = 'FdGraphCanvasContentIssue'
    this.kind = kind
  }
}

export class FdGraphCanvasAnchor {
  readonly position: FdCanvasPoint
  readonly normal: { readonly dx: number; readonly dy: number }

  constructor(
    position: FdCanvasPoint,
    normal: { readonly dx: number; readonly dy: number } = { dx: 0, dy: 0 },
  ) {
    this.position = position
    this.normal = normal
  }
}

export class FdGraphCanvasEdgeAnchors {
  readonly first: FdGraphCanvasAnchor
  readonly second: FdGraphCanvasAnchor
  readonly isDirected: boolean

  constructor(first: FdGraphCanvasAnchor, second: FdGraphCanvasAnchor, isDirected: boolean) {
    this.first = first
    this.second = second
    this.isDirected = isDirected
  }
}

export class FdGraphCanvasLayoutAdapter {
  private constructor() {}

  static topology<ElementID extends FdGraphElementID>(
    presentation: FdGraphPresentation<ElementID>,
  ): FdGraphLayoutTopology<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID
  > {
    return new FdGraphCanvasPresentationIndex(presentation).makeTopology(presentation.snapshotID)
  }
}

export class FdGraphCanvasContent<ElementID extends FdGraphElementID = FdGraphElementID> {
  readonly presentation: FdGraphPresentation<ElementID>
  readonly layoutInput: FdGraphLayoutInput<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID
  >
  readonly layoutResult: FdGraphLayoutResult<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID
  >
  readonly #renderIndex: FdGraphRenderIndex<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID
  >
  readonly #canonicalIDByLocalID: ReadonlyMap<FdGraphPresentationLocalElementID, ElementID>
  readonly #localIDByCanonicalID: ReadonlyMap<ElementID, FdGraphPresentationLocalElementID>
  readonly #nodeByLocalID: ReadonlyMap<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationNode<ElementID>
  >
  readonly #nodeOrderByLocalID: ReadonlyMap<FdGraphPresentationLocalElementID, number>
  readonly #portByLocalID: ReadonlyMap<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationPort<ElementID>
  >
  readonly #edgeByLocalID: ReadonlyMap<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationEdge<ElementID>
  >
  readonly #edgeByID: ReadonlyMap<
    FdGraphPresentationLocalElementID,
    FdGraphLayoutEdge<
      FdGraphPresentationLocalElementID,
      FdGraphPresentationLocalElementID,
      FdGraphPresentationLocalElementID
    >
  >
  readonly #portAnchorByKey: ReadonlyMap<
    string,
    {
      readonly position: FdCanvasPoint
      readonly normal: { readonly dx: number; readonly dy: number }
    }
  >
  readonly #nodeLocalIDByPortLocalID: ReadonlyMap<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID
  >
  readonly #portLocalIDsByNodeLocalID: ReadonlyMap<
    FdGraphPresentationLocalElementID,
    readonly FdGraphPresentationLocalElementID[]
  >
  readonly #incidentEdgeIDsByNodeID: ReadonlyMap<
    FdGraphPresentationLocalElementID,
    readonly FdGraphPresentationLocalElementID[]
  >

  constructor(options: {
    readonly presentation: FdGraphPresentation<ElementID>
    readonly layoutInput: FdGraphLayoutInput<
      FdGraphPresentationLocalElementID,
      FdGraphPresentationLocalElementID,
      FdGraphPresentationLocalElementID
    >
    readonly layoutResult: FdGraphLayoutResult<
      FdGraphPresentationLocalElementID,
      FdGraphPresentationLocalElementID,
      FdGraphPresentationLocalElementID
    >
    readonly renderIndexConfiguration?: FdGraphRenderIndexConfiguration
  }) {
    if (options.presentation.snapshotID !== options.layoutInput.id.presentationSnapshotID) {
      throw new FdGraphCanvasContentIssue('presentationSnapshotIdentityMismatch')
    }
    if (!sameLayoutInputID(options.layoutInput.id, options.layoutResult.inputID)) {
      throw new FdGraphCanvasContentIssue('layoutInputIdentityMismatch')
    }

    const index = new FdGraphCanvasPresentationIndex(options.presentation)
    const expectedTopology = index.makeTopology(options.presentation.snapshotID)
    if (!matchesTopology(options.layoutInput.topology, expectedTopology)) {
      throw new FdGraphCanvasContentIssue('layoutTopologyMismatch')
    }

    try {
      this.#renderIndex = new FdGraphRenderIndex(
        options.layoutInput,
        options.layoutResult,
        options.renderIndexConfiguration ?? new FdGraphRenderIndexConfiguration(),
      )
    } catch {
      throw new FdGraphCanvasContentIssue('renderIndexConstructionFailed')
    }

    this.presentation = options.presentation
    this.layoutInput = options.layoutInput
    this.layoutResult = options.layoutResult
    this.#canonicalIDByLocalID = index.canonicalIDByLocalID
    this.#localIDByCanonicalID = index.localIDByCanonicalID
    this.#nodeByLocalID = index.nodeByLocalID
    this.#nodeOrderByLocalID = new Map(
      options.presentation.nodes.map((node, order) => [node.localID, order]),
    )
    this.#portByLocalID = index.portByLocalID
    this.#edgeByLocalID = index.edgeByLocalID
    this.#nodeLocalIDByPortLocalID = index.nodeLocalIDByPortLocalID
    this.#portLocalIDsByNodeLocalID = groupPortLocalIDs(
      options.presentation.ports,
      index.nodeLocalIDByPortLocalID,
    )
    this.#edgeByID = new Map(options.layoutInput.topology.edges.map((edge) => [edge.id, edge]))
    this.#portAnchorByKey = new Map(
      options.layoutResult.resolvedPortAnchors.map((anchor) => [layoutPortKey(anchor.key), anchor]),
    )
    this.#incidentEdgeIDsByNodeID = incidentEdgeIDs(options.layoutInput.topology)
  }

  get id(): FdLayoutInputID {
    return this.layoutInput.id
  }

  get contentBounds(): FdCanvasRect {
    return this.layoutResult.contentBounds
  }

  get elementIDs(): ReadonlySet<ElementID> {
    return new Set(this.#localIDByCanonicalID.keys())
  }

  contains(elementID: ElementID): boolean {
    return this.#localIDByCanonicalID.has(elementID)
  }

  localID(elementID: ElementID): FdGraphPresentationLocalElementID | undefined {
    return this.#localIDByCanonicalID.get(elementID)
  }

  elementID(localID: FdGraphPresentationLocalElementID): ElementID | undefined {
    return this.#canonicalIDByLocalID.get(localID)
  }

  node(localID: FdGraphPresentationLocalElementID): FdGraphPresentationNode<ElementID> | undefined {
    return this.#nodeByLocalID.get(localID)
  }

  port(localID: FdGraphPresentationLocalElementID): FdGraphPresentationPort<ElementID> | undefined {
    return this.#portByLocalID.get(localID)
  }

  edge(localID: FdGraphPresentationLocalElementID): FdGraphPresentationEdge<ElementID> | undefined {
    return this.#edgeByLocalID.get(localID)
  }

  frame(nodeLocalID: FdGraphPresentationLocalElementID): FdCanvasRect | undefined {
    return this.layoutResult.frame(nodeLocalID)
  }

  nodePresentationOrder(localID: FdGraphPresentationLocalElementID): number | undefined {
    return this.#nodeOrderByLocalID.get(localID)
  }

  route(edgeLocalID: FdGraphPresentationLocalElementID): FdGraphEdgeRoute | undefined {
    return this.layoutResult.route(edgeLocalID)
  }

  anchor(portLocalID: FdGraphPresentationLocalElementID): FdGraphCanvasAnchor | undefined {
    const nodeID = this.#nodeLocalIDByPortLocalID.get(portLocalID)
    if (!nodeID) return undefined
    const entry = this.#portAnchorByKey.get(layoutPortKey({ nodeID, portID: portLocalID }))
    return entry ? new FdGraphCanvasAnchor(entry.position, entry.normal) : undefined
  }

  nodeLocalID(
    portLocalID: FdGraphPresentationLocalElementID,
  ): FdGraphPresentationLocalElementID | undefined {
    return this.#nodeLocalIDByPortLocalID.get(portLocalID)
  }

  portLocalIDs(
    nodeLocalID: FdGraphPresentationLocalElementID,
  ): readonly FdGraphPresentationLocalElementID[] {
    return this.#portLocalIDsByNodeLocalID.get(nodeLocalID) ?? []
  }

  incidentEdgeLocalIDs(
    nodeLocalID: FdGraphPresentationLocalElementID,
  ): readonly FdGraphPresentationLocalElementID[] {
    return this.#incidentEdgeIDsByNodeID.get(nodeLocalID) ?? []
  }

  edgeAnchors(
    edgeLocalID: FdGraphPresentationLocalElementID,
  ): FdGraphCanvasEdgeAnchors | undefined {
    const edge = this.#edgeByID.get(edgeLocalID)
    if (!edge) return undefined
    const [firstEndpoint, secondEndpoint] = layoutEdgeEndpoints(edge.endpoints)
    const first = this.endpointAnchor(firstEndpoint)
    const second = this.endpointAnchor(secondEndpoint)
    if (!first || !second) return undefined
    return new FdGraphCanvasEdgeAnchors(first, second, edge.endpoints.kind === 'directed')
  }

  endpointNodeLocalIDs(edgeLocalID: FdGraphPresentationLocalElementID):
    | {
        readonly first: FdGraphPresentationLocalElementID
        readonly second: FdGraphPresentationLocalElementID
      }
    | undefined {
    const edge = this.#edgeByID.get(edgeLocalID)
    if (!edge) return undefined
    const [first, second] = layoutEdgeEndpoints(edge.endpoints)
    return {
      first: this.layoutInput.topology.nodeID(first),
      second: this.layoutInput.topology.nodeID(second),
    }
  }

  renderSlice(
    intersecting: FdCanvasRect,
  ): FdGraphRenderSlice<FdGraphPresentationLocalElementID, FdGraphPresentationLocalElementID> {
    return this.#renderIndex.slice(intersecting)
  }

  renderElementIDs(
    intersecting: FdCanvasRect,
  ): FdGraphRenderElementIDs<FdGraphPresentationLocalElementID, FdGraphPresentationLocalElementID> {
    return this.#renderIndex.elementIDs(intersecting)
  }

  unorderedRenderElementIDs(
    intersecting: FdCanvasRect,
  ): FdGraphRenderElementIDs<FdGraphPresentationLocalElementID, FdGraphPresentationLocalElementID> {
    return this.#renderIndex.unorderedElementIDs(intersecting)
  }

  nearestNodeLocalID(
    point: FdCanvasPoint,
    excluding: ReadonlySet<FdGraphPresentationLocalElementID> = new Set(),
  ): FdGraphPresentationLocalElementID | undefined {
    return this.#renderIndex.nearestNodeID(point, excluding)
  }

  nodeLocalIDs(intersecting: FdCanvasRect): readonly FdGraphPresentationLocalElementID[] {
    return this.#renderIndex.nodeIDs(intersecting)
  }

  bounds(elementIDs: ReadonlySet<ElementID>): FdCanvasRect | undefined
  bounds(elementID: ElementID): FdCanvasRect | undefined
  bounds(elementIDOrIDs: ElementID | ReadonlySet<ElementID>): FdCanvasRect | undefined {
    if (elementIDOrIDs instanceof Set) {
      let result: FdCanvasRect | undefined
      for (const elementID of elementIDOrIDs) {
        const bounds = this.bounds(elementID)
        if (bounds) result = unionCanvasRects(result, bounds)
      }
      return result
    }
    const localID = this.#localIDByCanonicalID.get(elementIDOrIDs as ElementID)
    return localID ? this.boundsForLocalID(localID) : undefined
  }

  boundsForLocalID(localID: FdGraphPresentationLocalElementID): FdCanvasRect | undefined {
    const frame = this.layoutResult.frame(localID)
    if (frame) return frame
    const anchor = this.anchor(localID)
    if (anchor) return { ...anchor.position, width: 0, height: 0 }
    return this.layoutResult.route(localID)?.conservativeBounds
  }

  private endpointAnchor(
    endpoint: FdGraphLayoutEndpoint<
      FdGraphPresentationLocalElementID,
      FdGraphPresentationLocalElementID
    >,
  ): FdGraphCanvasAnchor | undefined {
    if (endpoint.kind === 'port') {
      const entry = this.#portAnchorByKey.get(layoutPortKey(endpoint.key))
      return entry ? new FdGraphCanvasAnchor(entry.position, entry.normal) : undefined
    }
    const frame = this.layoutResult.frame(endpoint.nodeID)
    return frame
      ? new FdGraphCanvasAnchor({
          x: frame.x + frame.width / 2,
          y: frame.y + frame.height / 2,
        })
      : undefined
  }
}

class FdGraphCanvasPresentationIndex<ElementID extends FdGraphElementID> {
  readonly presentation: FdGraphPresentation<ElementID>
  readonly canonicalIDByLocalID = new Map<FdGraphPresentationLocalElementID, ElementID>()
  readonly localIDByCanonicalID = new Map<ElementID, FdGraphPresentationLocalElementID>()
  readonly nodeByLocalID = new Map<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationNode<ElementID>
  >()
  readonly portByLocalID = new Map<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationPort<ElementID>
  >()
  readonly edgeByLocalID = new Map<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationEdge<ElementID>
  >()
  readonly nodeLocalIDByPortLocalID = new Map<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID
  >()

  constructor(presentation: FdGraphPresentation<ElementID>) {
    this.presentation = presentation
    for (const node of presentation.nodes) {
      this.register(node.id, node.localID)
      this.nodeByLocalID.set(node.localID, node)
    }
    for (const port of presentation.ports) {
      this.register(port.id, port.localID)
      this.portByLocalID.set(port.localID, port)
      const localID = decodeSource(port.localID, 'invalidPortOwnership')
      if (localID.elementID.kind !== 'port') {
        throw new FdGraphCanvasContentIssue('invalidPortOwnership')
      }
      const nodeLocalID = FdGraphPresentationLocalElementID.source({
        instanceHandle: localID.instanceHandle,
        elementID: { kind: 'node', nodeID: localID.elementID.key.nodeID },
        ...(localID.occurrenceID === undefined ? {} : { occurrenceID: localID.occurrenceID }),
      })
      if (!this.nodeByLocalID.has(nodeLocalID)) {
        throw new FdGraphCanvasContentIssue('invalidPortOwnership')
      }
      this.nodeLocalIDByPortLocalID.set(port.localID, nodeLocalID)
    }
    for (const edge of presentation.edges) {
      this.register(edge.id, edge.localID)
      this.edgeByLocalID.set(edge.localID, edge)
    }
    for (const context of presentation.contextEdges) this.register(context.id, context.localID)
  }

  makeTopology(
    snapshotID: string | number,
  ): FdGraphLayoutTopology<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID
  > {
    const nodeLocalIDsByInstanceHandle = new Map<number, FdGraphPresentationLocalElementID[]>()
    for (const node of this.presentation.nodes) {
      const localID = FdGraphPresentationLocalElementID.decode(node.localID)
      if (localID.kind !== 'source') continue
      append(nodeLocalIDsByInstanceHandle, localID.instanceHandle.rawValue, node.localID)
    }
    const containments = this.presentation.contextEdges.flatMap((context) => {
      if (context.state.kind !== 'expanded' || !context.targetInstanceHandle) return []
      const containerNodeID = FdGraphPresentationLocalElementID.source({
        instanceHandle: context.sourceInstanceHandle,
        elementID: { kind: 'node', nodeID: context.site.nodeID },
      })
      return [
        {
          containerNodeID,
          memberNodeIDs:
            nodeLocalIDsByInstanceHandle.get(context.targetInstanceHandle.rawValue) ?? [],
        },
      ]
    })

    return new FdGraphLayoutTopology({
      snapshotID,
      nodeIDs: this.presentation.nodes.map(({ localID }) => localID),
      ports: this.presentation.ports.map((port) => {
        const nodeID = this.nodeLocalIDByPortLocalID.get(port.localID)
        if (!nodeID) throw new FdGraphCanvasContentIssue('invalidPortOwnership')
        return new FdGraphLayoutPort({ nodeID, portID: port.localID })
      }),
      edges: this.presentation.edges.map((edge) => ({
        id: edge.localID,
        endpoints: this.layoutEndpoints(edge.endpoints),
      })),
      containments,
    })
  }

  private register(id: ElementID, localID: FdGraphPresentationLocalElementID): void {
    if (this.canonicalIDByLocalID.has(localID)) {
      throw new FdGraphCanvasContentIssue('duplicateLocalIdentity')
    }
    if (this.localIDByCanonicalID.has(id)) {
      throw new FdGraphCanvasContentIssue('duplicateCanonicalIdentity')
    }
    this.canonicalIDByLocalID.set(localID, id)
    this.localIDByCanonicalID.set(id, localID)
  }

  private layoutEndpoints(
    endpoints: FdGraphPresentationEdgeEndpoints<ElementID>,
  ): FdGraphLayoutEdgeEndpoints<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID
  > {
    return endpoints.kind === 'directed'
      ? {
          kind: 'directed',
          source: this.layoutEndpoint(endpoints.source),
          target: this.layoutEndpoint(endpoints.target),
        }
      : {
          kind: 'undirected',
          first: this.layoutEndpoint(endpoints.first),
          second: this.layoutEndpoint(endpoints.second),
        }
  }

  private layoutEndpoint(
    endpoint: FdGraphPresentationEndpoint<ElementID>,
  ): FdGraphLayoutEndpoint<FdGraphPresentationLocalElementID, FdGraphPresentationLocalElementID> {
    const localID = this.localIDByCanonicalID.get(endpoint.id)
    if (!localID) throw new FdGraphCanvasContentIssue('invalidPresentationEndpoint')
    if (endpoint.kind === 'node') {
      if (!this.nodeByLocalID.has(localID)) {
        throw new FdGraphCanvasContentIssue('invalidPresentationEndpoint')
      }
      return { kind: 'node', nodeID: localID }
    }
    const nodeID = this.nodeLocalIDByPortLocalID.get(localID)
    if (!this.portByLocalID.has(localID) || !nodeID) {
      throw new FdGraphCanvasContentIssue('invalidPresentationEndpoint')
    }
    return { kind: 'port', key: { nodeID, portID: localID } }
  }
}

const decodeSource = (
  localID: FdGraphPresentationLocalElementID,
  issue: FdGraphCanvasContentIssueKind,
): Extract<FdDecodedGraphPresentationLocalElementID, { kind: 'source' }> => {
  let decoded: FdDecodedGraphPresentationLocalElementID
  try {
    decoded = FdGraphPresentationLocalElementID.decode(localID)
  } catch {
    throw new FdGraphCanvasContentIssue(issue)
  }
  if (decoded.kind !== 'source') throw new FdGraphCanvasContentIssue(issue)
  return decoded
}

const groupPortLocalIDs = <ElementID extends FdGraphElementID>(
  ports: readonly FdGraphPresentationPort<ElementID>[],
  ownership: ReadonlyMap<FdGraphPresentationLocalElementID, FdGraphPresentationLocalElementID>,
): ReadonlyMap<FdGraphPresentationLocalElementID, readonly FdGraphPresentationLocalElementID[]> => {
  const result = new Map<FdGraphPresentationLocalElementID, FdGraphPresentationLocalElementID[]>()
  for (const port of ports) {
    const nodeID = ownership.get(port.localID)
    if (nodeID) append(result, nodeID, port.localID)
  }
  return result
}

const incidentEdgeIDs = (
  topology: FdGraphLayoutTopology<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID
  >,
): ReadonlyMap<FdGraphPresentationLocalElementID, readonly FdGraphPresentationLocalElementID[]> => {
  const result = new Map<FdGraphPresentationLocalElementID, FdGraphPresentationLocalElementID[]>()
  for (const edge of topology.edges) {
    const nodeIDs = new Set(
      layoutEdgeEndpoints(edge.endpoints).map((item) => topology.nodeID(item)),
    )
    for (const nodeID of nodeIDs) append(result, nodeID, edge.id)
  }
  return result
}

const matchesTopology = (
  first: FdGraphLayoutTopology<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID
  >,
  second: FdGraphLayoutTopology<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID
  >,
): boolean =>
  first.snapshotID === second.snapshotID &&
  sameIDs(first.nodeIDs, second.nodeIDs) &&
  sameIDs(
    first.ports.map(({ key }) => layoutPortKey(key)),
    second.ports.map(({ key }) => layoutPortKey(key)),
  ) &&
  sameEdges(first.edges, second.edges) &&
  sameContainments(first.containments, second.containments)

const sameEdges = (
  first: readonly FdGraphLayoutEdge<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID
  >[],
  second: readonly FdGraphLayoutEdge<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID
  >[],
): boolean =>
  first.length === second.length &&
  first.every((edge, index) => {
    const other = second[index]
    return (
      other !== undefined &&
      edge.id === other.id &&
      sameEdgeEndpoints(edge.endpoints, other.endpoints)
    )
  })

const sameEdgeEndpoints = (
  first: FdGraphLayoutEdgeEndpoints<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID
  >,
  second: FdGraphLayoutEdgeEndpoints<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID
  >,
): boolean => {
  if (first.kind !== second.kind) return false
  if (first.kind === 'directed' && second.kind === 'directed') {
    return sameEndpoint(first.source, second.source) && sameEndpoint(first.target, second.target)
  }
  if (first.kind !== 'undirected' || second.kind !== 'undirected') return false
  return (
    (sameEndpoint(first.first, second.first) && sameEndpoint(first.second, second.second)) ||
    (sameEndpoint(first.first, second.second) && sameEndpoint(first.second, second.first))
  )
}

const sameEndpoint = (
  first: FdGraphLayoutEndpoint<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID
  >,
  second: FdGraphLayoutEndpoint<
    FdGraphPresentationLocalElementID,
    FdGraphPresentationLocalElementID
  >,
): boolean => {
  if (first.kind !== second.kind) return false
  return first.kind === 'node' && second.kind === 'node'
    ? first.nodeID === second.nodeID
    : first.kind === 'port' &&
        second.kind === 'port' &&
        layoutPortKey(first.key) === layoutPortKey(second.key)
}

const sameContainments = (
  first: readonly {
    readonly containerNodeID: FdGraphPresentationLocalElementID
    readonly memberNodeIDs: readonly FdGraphPresentationLocalElementID[]
  }[],
  second: readonly {
    readonly containerNodeID: FdGraphPresentationLocalElementID
    readonly memberNodeIDs: readonly FdGraphPresentationLocalElementID[]
  }[],
): boolean =>
  first.length === second.length &&
  first.every((containment, index) => {
    const other = second[index]
    return (
      other !== undefined &&
      containment.containerNodeID === other.containerNodeID &&
      sameIDs(containment.memberNodeIDs, other.memberNodeIDs)
    )
  })

const layoutEdgeEndpoints = <NodeID extends FdGraphElementID, PortID extends FdGraphElementID>(
  endpoints: FdGraphLayoutEdgeEndpoints<NodeID, PortID>,
): readonly [FdGraphLayoutEndpoint<NodeID, PortID>, FdGraphLayoutEndpoint<NodeID, PortID>] =>
  endpoints.kind === 'directed'
    ? [endpoints.source, endpoints.target]
    : [endpoints.first, endpoints.second]

const layoutPortKey = <NodeID extends FdGraphElementID, PortID extends FdGraphElementID>(
  key: FdGraphLayoutPortKey<NodeID, PortID>,
): string => `${graphElementKey(key.nodeID)}:${graphElementKey(key.portID)}`

const sameIDs = <Value>(first: readonly Value[], second: readonly Value[]): boolean =>
  first.length === second.length && first.every((value, index) => value === second[index])

const append = <Key, Value>(map: Map<Key, Value[]>, key: Key, value: Value): void => {
  const values = map.get(key)
  if (values) values.push(value)
  else map.set(key, [value])
}
