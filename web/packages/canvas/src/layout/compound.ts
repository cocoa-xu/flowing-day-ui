import type { FdCanvasPoint, FdCanvasRect, FdCanvasSize } from '../geometry.js'
import { unionCanvasRects } from '../geometry.js'
import type { FdGraphElementID } from '../graph/model.js'
import { graphElementKey } from '../graph/model.js'
import type { FdLayoutInsets } from './layered.js'
import {
  type FdGraphLayoutEdge,
  FdGraphLayoutInput,
  type FdGraphLayoutPort,
  type FdGraphLayoutPortKey,
  FdGraphLayoutTopology,
  type FdGraphNodePlacementState,
  type FdGraphPortAnchor,
  FdLayoutComponentIdentity,
  FdLayoutInputID,
  FdLayoutPipelineIdentity,
  FdLayoutPipelineStageRole,
  sameLayoutPipelineIdentity,
} from './model.js'
import {
  type FdGraphEdgeRoutingStrategy,
  FdGraphLayoutPipelineError,
  type FdGraphLayoutResult,
  type FdGraphLayoutStrategy,
  type FdGraphNodeFrame,
  FdGraphNodePlacement,
  FdGraphLayoutResult as GraphLayoutResult,
} from './pipeline.js'

export class FdCompoundContainerGeometryContext<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
> {
  readonly containerNodeID: NodeID
  readonly intrinsicSize: FdCanvasSize
  readonly contentSize: FdCanvasSize
  readonly portAnchors: readonly FdGraphPortAnchor<NodeID, PortID>[]

  constructor(
    containerNodeID: NodeID,
    intrinsicSize: FdCanvasSize,
    contentSize: FdCanvasSize,
    portAnchors: readonly FdGraphPortAnchor<NodeID, PortID>[],
  ) {
    this.containerNodeID = containerNodeID
    this.intrinsicSize = intrinsicSize
    this.contentSize = contentSize
    this.portAnchors = portAnchors
  }
}

export class FdCompoundContainerGeometry<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
> {
  readonly size: FdCanvasSize
  readonly contentOrigin: FdCanvasPoint
  readonly portAnchors: readonly FdGraphPortAnchor<NodeID, PortID>[]

  constructor(
    size: FdCanvasSize,
    contentOrigin: FdCanvasPoint,
    portAnchors: readonly FdGraphPortAnchor<NodeID, PortID>[],
  ) {
    this.size = size
    this.contentOrigin = contentOrigin
    this.portAnchors = portAnchors
  }
}

export interface FdCompoundContainerGeometryResolver<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
> {
  readonly identity: FdLayoutComponentIdentity
  geometry(
    context: FdCompoundContainerGeometryContext<NodeID, PortID>,
  ): FdCompoundContainerGeometry<NodeID, PortID>
}

export class FdPaddedCompoundContainerConfiguration {
  readonly contentInsets: FdLayoutInsets
  readonly headerHeight: number

  constructor(contentInsets: FdLayoutInsets, headerHeight: number) {
    if (!Number.isFinite(headerHeight) || headerHeight < 0) {
      throw new RangeError('header height must be nonnegative and finite')
    }
    this.contentInsets = contentInsets
    this.headerHeight = headerHeight
  }
}

export class FdPaddedCompoundContainerGeometry<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
> implements FdCompoundContainerGeometryResolver<NodeID, PortID>
{
  readonly identity: FdLayoutComponentIdentity
  readonly configuration: FdPaddedCompoundContainerConfiguration

  constructor(
    configuration: FdPaddedCompoundContainerConfiguration,
    identity = new FdLayoutComponentIdentity(),
  ) {
    this.configuration = configuration
    this.identity = identity
  }

  geometry(
    context: FdCompoundContainerGeometryContext<NodeID, PortID>,
  ): FdCompoundContainerGeometry<NodeID, PortID> {
    const insets = this.configuration.contentInsets
    const contentOrigin = {
      x: insets.leading,
      y: insets.top + this.configuration.headerHeight,
    }
    const size = {
      width: Math.max(
        context.intrinsicSize.width,
        insets.leading + context.contentSize.width + insets.trailing,
      ),
      height: Math.max(
        context.intrinsicSize.height,
        contentOrigin.y + context.contentSize.height + insets.bottom,
      ),
    }
    return new FdCompoundContainerGeometry(
      size,
      contentOrigin,
      context.portAnchors.map((anchor) => resizedAnchor(anchor, context.intrinsicSize, size)),
    )
  }
}

export type FdCompoundLayoutIssueKind =
  | 'invalidContainerSize'
  | 'invalidContentOrigin'
  | 'contentExceedsContainer'
  | 'duplicatePortAnchor'
  | 'invalidPortAnchor'
  | 'missingPortAnchor'
  | 'unknownPortAnchor'
  | 'missingNodeFrame'

export class FdCompoundLayoutIssue extends Error {
  readonly kind: FdCompoundLayoutIssueKind
  readonly details: Readonly<Record<string, unknown>>

  constructor(kind: FdCompoundLayoutIssueKind, details: Readonly<Record<string, unknown>>) {
    super(kind)
    this.name = 'FdCompoundLayoutIssue'
    this.kind = kind
    this.details = details
  }
}

export class FdCompoundLayout<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> implements FdGraphLayoutStrategy<NodeID, PortID, EdgeID>
{
  readonly levelLayout: FdGraphLayoutStrategy<NodeID, PortID, EdgeID>
  readonly containerGeometry: FdCompoundContainerGeometryResolver<NodeID, PortID>
  readonly edgeRouter: FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>

  constructor(
    levelLayout: FdGraphLayoutStrategy<NodeID, PortID, EdgeID>,
    containerGeometry: FdCompoundContainerGeometryResolver<NodeID, PortID>,
    edgeRouter: FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>,
  ) {
    this.levelLayout = levelLayout
    this.containerGeometry = containerGeometry
    this.edgeRouter = edgeRouter
  }

  get identity(): FdLayoutPipelineIdentity {
    return new FdLayoutPipelineIdentity([
      {
        kind: 'group',
        role: FdLayoutPipelineStageRole.levelLayout,
        stages: this.levelLayout.identity.stages,
      },
      {
        kind: 'component',
        role: FdLayoutPipelineStageRole.containerGeometry,
        identity: this.containerGeometry.identity,
      },
      {
        kind: 'component',
        role: FdLayoutPipelineStageRole.edgeRouting,
        identity: this.edgeRouter.identity,
      },
    ])
  }

  layout(
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
  ): FdGraphLayoutResult<NodeID, PortID, EdgeID> {
    if (!sameLayoutPipelineIdentity(input.id.pipelineIdentity, this.identity)) {
      throw new FdGraphLayoutPipelineError()
    }
    const sizeByNodeID = new Map(input.nodeSizes.map(({ nodeID, size }) => [nodeID, size]))
    const anchorByKey = new Map(input.portAnchors.map((anchor) => [portKey(anchor.key), anchor]))
    const bottomUpContainerNodeIDs = bottomUpContainers(input.topology)
    const scopeIndex = new CompoundScopeIndex(input)
    const childPlacementByContainerNodeID = new Map<NodeID, readonly FdGraphNodeFrame<NodeID>[]>()

    for (const containerNodeID of bottomUpContainerNodeIDs) {
      const childResult = this.layoutScope(
        containerScope(containerNodeID),
        input.topology.memberNodeIDs(containerNodeID),
        input,
        scopeIndex,
        sizeByNodeID,
        anchorByKey,
      )
      const containerPortKeys = input.topology.ports.flatMap((port) =>
        port.nodeID === containerNodeID ? [port.key] : [],
      )
      const context = new FdCompoundContainerGeometryContext(
        containerNodeID,
        required(input.size(containerNodeID), 'compound intrinsic size'),
        {
          width: childResult.contentBounds.width,
          height: childResult.contentBounds.height,
        },
        containerPortKeys.map((key) =>
          required(anchorByKey.get(portKey(key)), 'compound port anchor'),
        ),
      )
      const geometry = this.containerGeometry.geometry(context)
      validateGeometry(geometry, context, containerPortKeys)
      sizeByNodeID.set(containerNodeID, geometry.size)
      for (const anchor of geometry.portAnchors) {
        anchorByKey.set(portKey(anchor.key), anchor)
      }
      const dx = geometry.contentOrigin.x - childResult.contentBounds.x
      const dy = geometry.contentOrigin.y - childResult.contentBounds.y
      childPlacementByContainerNodeID.set(
        containerNodeID,
        childResult.nodeFrames.map(({ nodeID, frame }) => ({
          nodeID,
          frame: offsetRect(frame, dx, dy),
        })),
      )
    }

    const rootResult = this.layoutScope(
      rootScope,
      input.topology.rootNodeIDs,
      input,
      scopeIndex,
      sizeByNodeID,
      anchorByKey,
    )
    const worldFrameByNodeID = new Map(
      rootResult.nodeFrames.map(({ nodeID, frame }) => [nodeID, frame]),
    )
    for (let index = bottomUpContainerNodeIDs.length - 1; index >= 0; index -= 1) {
      const containerNodeID = required(bottomUpContainerNodeIDs[index], 'compound container node')
      const resolvedContainerFrame =
        worldFrameByNodeID.get(containerNodeID) ??
        fail('missingNodeFrame', { nodeID: containerNodeID })
      for (const entry of childPlacementByContainerNodeID.get(containerNodeID) ?? []) {
        worldFrameByNodeID.set(
          entry.nodeID,
          offsetRect(entry.frame, resolvedContainerFrame.x, resolvedContainerFrame.y),
        )
      }
    }
    for (const nodeID of input.topology.nodeIDs) {
      if (!worldFrameByNodeID.has(nodeID)) fail('missingNodeFrame', { nodeID })
    }

    const resolvedInput = new FdGraphLayoutInput({
      id: input.id,
      topology: input.topology,
      nodeSizes: input.topology.nodeIDs.map((nodeID) => ({
        nodeID,
        size: required(sizeByNodeID.get(nodeID), 'compound node size'),
      })),
      portAnchors: input.topology.ports.map(({ key }) =>
        required(anchorByKey.get(portKey(key)), 'compound port anchor'),
      ),
      placementState: input.placementState,
    })
    let contentBounds = rootResult.contentBounds
    for (const frame of worldFrameByNodeID.values()) {
      contentBounds = unionCanvasRects(contentBounds, frame)
    }
    const placement = new FdGraphNodePlacement(
      resolvedInput,
      input.topology.nodeIDs.map((nodeID) => ({
        nodeID,
        frame: required(worldFrameByNodeID.get(nodeID), 'compound node frame'),
      })),
      contentBounds,
    )
    return new GraphLayoutResult(
      resolvedInput,
      placement,
      this.edgeRouter.routes(resolvedInput, placement),
    )
  }

  private layoutScope(
    scope: CompoundScope,
    nodeIDs: readonly NodeID[],
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
    scopeIndex: CompoundScopeIndex<NodeID, PortID, EdgeID>,
    sizeByNodeID: ReadonlyMap<NodeID, FdCanvasSize>,
    anchorByKey: ReadonlyMap<string, FdGraphPortAnchor<NodeID, PortID>>,
  ): FdGraphLayoutResult<NodeID, PortID, EdgeID> {
    const topology = new FdGraphLayoutTopology({
      snapshotID: input.topology.snapshotID,
      nodeIDs,
      ports: scopeIndex.portsByScope.get(scope) ?? [],
      edges: scopeIndex.edgesByScope.get(scope) ?? [],
    })
    return this.levelLayout.layout(
      new FdGraphLayoutInput({
        id: new FdLayoutInputID(
          topology.snapshotID,
          this.levelLayout.identity,
          input.id.nodeSizeRevision,
          input.id.portAnchorRevision,
          input.id.layoutStateRevision,
        ),
        topology,
        nodeSizes: nodeIDs.map((nodeID) => ({
          nodeID,
          size: required(sizeByNodeID.get(nodeID), 'compound scope node size'),
        })),
        portAnchors: topology.ports.map(({ key }) =>
          required(anchorByKey.get(portKey(key)), 'compound scope port anchor'),
        ),
        placementState: scopeIndex.placementStateByScope.get(scope) ?? [],
      }),
    )
  }
}

type CompoundScope = string

const rootScope = 'root'
const containerScope = (nodeID: FdGraphElementID): CompoundScope =>
  `container:${graphElementKey(nodeID)}`

class CompoundScopeIndex<
  NodeID extends FdGraphElementID,
  PortID extends FdGraphElementID,
  EdgeID extends FdGraphElementID,
> {
  readonly portsByScope = new Map<CompoundScope, FdGraphLayoutPort<NodeID, PortID>[]>()
  readonly edgesByScope = new Map<CompoundScope, FdGraphLayoutEdge<NodeID, PortID, EdgeID>[]>()
  readonly placementStateByScope = new Map<CompoundScope, FdGraphNodePlacementState<NodeID>[]>()

  constructor(input: FdGraphLayoutInput<NodeID, PortID, EdgeID>) {
    const scopeByNodeID = new Map<NodeID, CompoundScope>()
    for (const nodeID of input.topology.nodeIDs) {
      const container = input.topology.containerNodeID(nodeID)
      scopeByNodeID.set(nodeID, container === undefined ? rootScope : containerScope(container))
    }
    for (const port of input.topology.ports) {
      append(
        this.portsByScope,
        required(scopeByNodeID.get(port.nodeID), 'compound node scope'),
        port,
      )
    }
    for (const edge of input.topology.edges) {
      const endpoints = edgeEndpoints(edge)
      const firstScope = required(
        scopeByNodeID.get(input.topology.nodeID(endpoints[0])),
        'compound edge scope',
      )
      const secondScope = required(
        scopeByNodeID.get(input.topology.nodeID(endpoints[1])),
        'compound edge scope',
      )
      if (firstScope === secondScope) append(this.edgesByScope, firstScope, edge)
    }
    for (const state of input.placementState) {
      append(
        this.placementStateByScope,
        required(scopeByNodeID.get(state.nodeID), 'compound placement scope'),
        state,
      )
    }
  }
}

const bottomUpContainers = <
  NodeID extends FdGraphElementID,
  PortID extends FdGraphElementID,
  EdgeID extends FdGraphElementID,
>(
  topology: FdGraphLayoutTopology<NodeID, PortID, EdgeID>,
): readonly NodeID[] => {
  const containerNodeIDs = topology.containments.map(({ containerNodeID }) => containerNodeID)
  const knownContainers = new Set(containerNodeIDs)
  const unresolvedChildren = new Map(
    containerNodeIDs.map((containerNodeID) => [
      containerNodeID,
      topology.memberNodeIDs(containerNodeID).filter((nodeID) => knownContainers.has(nodeID))
        .length,
    ]),
  )
  const queue = containerNodeIDs.filter((nodeID) => unresolvedChildren.get(nodeID) === 0)
  const result: NodeID[] = []
  for (let index = 0; index < queue.length; index += 1) {
    const containerNodeID = required(queue[index], 'compound container queue')
    result.push(containerNodeID)
    const parent = topology.containerNodeID(containerNodeID)
    if (parent === undefined || !knownContainers.has(parent)) continue
    const remaining = required(unresolvedChildren.get(parent), 'compound child count') - 1
    unresolvedChildren.set(parent, remaining)
    if (remaining === 0) queue.push(parent)
  }
  if (result.length !== containerNodeIDs.length) {
    throw new Error('compound containment invariant failed')
  }
  return result
}

const validateGeometry = <NodeID extends FdGraphElementID, PortID extends FdGraphElementID>(
  geometry: FdCompoundContainerGeometry<NodeID, PortID>,
  context: FdCompoundContainerGeometryContext<NodeID, PortID>,
  expectedPortKeys: readonly FdGraphLayoutPortKey<NodeID, PortID>[],
): void => {
  if (!validSize(geometry.size)) {
    fail('invalidContainerSize', { nodeID: context.containerNodeID })
  }
  if (
    !validPoint(geometry.contentOrigin) ||
    geometry.contentOrigin.x < 0 ||
    geometry.contentOrigin.y < 0
  ) {
    fail('invalidContentOrigin', { nodeID: context.containerNodeID })
  }
  if (
    geometry.contentOrigin.x + context.contentSize.width > geometry.size.width ||
    geometry.contentOrigin.y + context.contentSize.height > geometry.size.height
  ) {
    fail('contentExceedsContainer', { nodeID: context.containerNodeID })
  }
  const expected = new Set(expectedPortKeys.map(portKey))
  const actual = new Set<string>()
  for (const anchor of geometry.portAnchors) {
    const key = portKey(anchor.key)
    if (!expected.has(key)) fail('unknownPortAnchor', { key: anchor.key })
    if (actual.has(key)) fail('duplicatePortAnchor', { key: anchor.key })
    actual.add(key)
    if (!validPoint(anchor.position) || !validVector(anchor.normal)) {
      fail('invalidPortAnchor', { key: anchor.key })
    }
  }
  const missing = expectedPortKeys.find((key) => !actual.has(portKey(key)))
  if (missing) fail('missingPortAnchor', { key: missing })
}

const resizedAnchor = <NodeID extends FdGraphElementID, PortID extends FdGraphElementID>(
  anchor: FdGraphPortAnchor<NodeID, PortID>,
  originalSize: FdCanvasSize,
  size: FdCanvasSize,
): FdGraphPortAnchor<NodeID, PortID> => {
  const horizontalRatio = ratio(anchor.position.x, originalSize.width)
  const verticalRatio = ratio(anchor.position.y, originalSize.height)
  let position: FdCanvasPoint
  if (Math.abs(anchor.normal.dx) >= Math.abs(anchor.normal.dy) && anchor.normal.dx !== 0) {
    position = {
      x: anchor.normal.dx > 0 ? size.width : 0,
      y: verticalRatio * size.height,
    }
  } else if (anchor.normal.dy !== 0) {
    position = {
      x: horizontalRatio * size.width,
      y: anchor.normal.dy > 0 ? size.height : 0,
    }
  } else {
    position = {
      x: horizontalRatio * size.width,
      y: verticalRatio * size.height,
    }
  }
  return { key: anchor.key, position, normal: anchor.normal }
}

const edgeEndpoints = <NodeID extends FdGraphElementID, PortID extends FdGraphElementID>(
  edge: FdGraphLayoutEdge<NodeID, PortID, FdGraphElementID>,
) =>
  edge.endpoints.kind === 'directed'
    ? ([edge.endpoints.source, edge.endpoints.target] as const)
    : ([edge.endpoints.first, edge.endpoints.second] as const)

const portKey = <NodeID extends FdGraphElementID, PortID extends FdGraphElementID>(
  key: FdGraphLayoutPortKey<NodeID, PortID>,
): string => `${graphElementKey(key.nodeID)}|${graphElementKey(key.portID)}`

const append = <Key, Value>(map: Map<Key, Value[]>, key: Key, value: Value): void => {
  const values = map.get(key)
  if (values) values.push(value)
  else map.set(key, [value])
}

const offsetRect = (rect: FdCanvasRect, dx: number, dy: number): FdCanvasRect => ({
  ...rect,
  x: rect.x + dx,
  y: rect.y + dy,
})

const validPoint = ({ x, y }: FdCanvasPoint): boolean => Number.isFinite(x) && Number.isFinite(y)
const validSize = ({ width, height }: FdCanvasSize): boolean =>
  Number.isFinite(width) && Number.isFinite(height) && width >= 0 && height >= 0
const validVector = ({ dx, dy }: { readonly dx: number; readonly dy: number }): boolean =>
  Number.isFinite(dx) && Number.isFinite(dy)
const ratio = (coordinate: number, dimension: number): number =>
  dimension > 0 ? coordinate / dimension : 0.5

const required = <Value>(value: Value | undefined, name: string): Value => {
  if (value === undefined) throw new Error(`${name} invariant failed`)
  return value
}

const fail = (kind: FdCompoundLayoutIssueKind, details: Record<string, unknown>): never => {
  throw new FdCompoundLayoutIssue(kind, details)
}
