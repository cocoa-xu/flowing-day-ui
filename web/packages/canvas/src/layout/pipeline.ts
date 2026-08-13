import type { FdCanvasPoint, FdCanvasRect } from '../geometry.js'
import { canvasRectContains, unionCanvasRects } from '../geometry.js'
import type { FdGraphElementID } from '../graph/model.js'
import {
  type FdGraphLayoutInput,
  type FdGraphLayoutPortKey,
  type FdLayoutComponentIdentity,
  FdLayoutPipelineIdentity,
  FdLayoutPipelineStageRole,
  sameLayoutPipelineIdentity,
} from './model.js'

export interface FdGraphNodeFrame<NodeID extends FdGraphElementID = FdGraphElementID> {
  readonly nodeID: NodeID
  readonly frame: FdCanvasRect
}

export type FdGraphEdgePathSegment =
  | { readonly kind: 'line'; readonly end: FdCanvasPoint }
  | { readonly kind: 'quadratic'; readonly control: FdCanvasPoint; readonly end: FdCanvasPoint }
  | {
      readonly kind: 'cubic'
      readonly control1: FdCanvasPoint
      readonly control2: FdCanvasPoint
      readonly end: FdCanvasPoint
    }

export class FdGraphEdgeRoute {
  readonly start: FdCanvasPoint
  readonly segments: readonly FdGraphEdgePathSegment[]

  constructor(start: FdCanvasPoint, segments: readonly FdGraphEdgePathSegment[]) {
    this.start = start
    this.segments = segments
  }

  get conservativeBounds(): FdCanvasRect {
    const points = [this.start]
    for (const segment of this.segments) {
      if (segment.kind === 'quadratic') points.push(segment.control)
      if (segment.kind === 'cubic') points.push(segment.control1, segment.control2)
      points.push(segment.end)
    }
    let bounds: FdCanvasRect | undefined
    for (const point of points) {
      bounds = unionCanvasRects(bounds, { ...point, width: 0, height: 0 })
    }
    return bounds as FdCanvasRect
  }
}

export interface FdGraphLayoutEdgeRoute<EdgeID extends FdGraphElementID = FdGraphElementID> {
  readonly edgeID: EdgeID
  readonly route: FdGraphEdgeRoute
}

export interface FdGraphResolvedPortAnchor<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
> {
  readonly key: FdGraphLayoutPortKey<NodeID, PortID>
  readonly position: FdCanvasPoint
  readonly normal: { readonly dx: number; readonly dy: number }
}

type FdGraphNodePlacementIssueKind =
  | 'duplicateNodeFrame'
  | 'missingNodeFrame'
  | 'unknownNodeFrame'
  | 'invalidNodeFrame'
  | 'nodeFrameSizeMismatch'
  | 'invalidContentBounds'
  | 'contentBoundsExcludeNode'

export class FdGraphNodePlacementIssue extends Error {
  readonly kind: FdGraphNodePlacementIssueKind
  readonly details: Readonly<Record<string, unknown>>

  constructor(
    kind: FdGraphNodePlacementIssueKind,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(kind)
    this.name = 'FdGraphNodePlacementIssue'
    this.kind = kind
    this.details = details
  }
}

export class FdGraphNodePlacement<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly nodeFrames: readonly FdGraphNodeFrame<NodeID>[]
  readonly contentBounds: FdCanvasRect
  readonly #frameByNodeID = new Map<NodeID, FdCanvasRect>()

  constructor(
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
    nodeFrames: readonly FdGraphNodeFrame<NodeID>[],
    contentBounds: FdCanvasRect,
  ) {
    const knownNodeIDs = new Set(input.topology.nodeIDs)
    for (const entry of nodeFrames) {
      if (!knownNodeIDs.has(entry.nodeID)) this.fail('unknownNodeFrame', { nodeID: entry.nodeID })
      if (!usableRect(entry.frame)) this.fail('invalidNodeFrame', { nodeID: entry.nodeID })
      const size = input.size(entry.nodeID)
      if (!size || entry.frame.width !== size.width || entry.frame.height !== size.height) {
        this.fail('nodeFrameSizeMismatch', { nodeID: entry.nodeID })
      }
      if (this.#frameByNodeID.has(entry.nodeID)) {
        this.fail('duplicateNodeFrame', { nodeID: entry.nodeID })
      }
      this.#frameByNodeID.set(entry.nodeID, entry.frame)
    }
    for (const nodeID of input.topology.nodeIDs) {
      if (!this.#frameByNodeID.has(nodeID)) this.fail('missingNodeFrame', { nodeID })
    }
    if (!usableRect(contentBounds)) this.fail('invalidContentBounds')
    for (const nodeID of input.topology.nodeIDs) {
      const frame = this.#frameByNodeID.get(nodeID) as FdCanvasRect
      if (!canvasRectContains(contentBounds, frame)) {
        this.fail('contentBoundsExcludeNode', { nodeID })
      }
    }
    this.nodeFrames = input.topology.nodeIDs.map((nodeID) => ({
      nodeID,
      frame: this.#frameByNodeID.get(nodeID) as FdCanvasRect,
    }))
    this.contentBounds = contentBounds
  }

  frame(nodeID: NodeID): FdCanvasRect | undefined {
    return this.#frameByNodeID.get(nodeID)
  }

  private fail(kind: FdGraphNodePlacementIssueKind, details?: Record<string, unknown>): never {
    throw new FdGraphNodePlacementIssue(kind, details)
  }
}

type FdGraphLayoutResultIssueKind =
  | 'duplicateEdgeRoute'
  | 'missingEdgeRoute'
  | 'unknownEdgeRoute'
  | 'invalidEdgeRoute'
  | 'invalidContentBounds'

export class FdGraphLayoutResultIssue extends Error {
  readonly kind: FdGraphLayoutResultIssueKind
  readonly details: Readonly<Record<string, unknown>>

  constructor(kind: FdGraphLayoutResultIssueKind, details: Readonly<Record<string, unknown>> = {}) {
    super(kind)
    this.name = 'FdGraphLayoutResultIssue'
    this.kind = kind
    this.details = details
  }
}

export class FdGraphLayoutResult<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly inputID: FdGraphLayoutInput<NodeID, PortID, EdgeID>['id']
  readonly nodeFrames: readonly FdGraphNodeFrame<NodeID>[]
  readonly edgeRoutes: readonly FdGraphLayoutEdgeRoute<EdgeID>[]
  readonly resolvedPortAnchors: readonly FdGraphResolvedPortAnchor<NodeID, PortID>[]
  readonly contentBounds: FdCanvasRect
  readonly #frameByNodeID = new Map<NodeID, FdCanvasRect>()
  readonly #routeByEdgeID = new Map<EdgeID, FdGraphEdgeRoute>()

  constructor(
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
    placement: FdGraphNodePlacement<NodeID, PortID, EdgeID>,
    edgeRoutes: readonly FdGraphLayoutEdgeRoute<EdgeID>[],
  ) {
    const knownEdgeIDs = new Set(input.topology.edges.map(({ id }) => id))
    for (const entry of edgeRoutes) {
      if (!knownEdgeIDs.has(entry.edgeID)) this.fail('unknownEdgeRoute', { edgeID: entry.edgeID })
      if (!finiteRoute(entry.route) || !usableRect(entry.route.conservativeBounds)) {
        this.fail('invalidEdgeRoute', { edgeID: entry.edgeID })
      }
      if (this.#routeByEdgeID.has(entry.edgeID)) {
        this.fail('duplicateEdgeRoute', { edgeID: entry.edgeID })
      }
      this.#routeByEdgeID.set(entry.edgeID, entry.route)
    }
    for (const edge of input.topology.edges) {
      if (!this.#routeByEdgeID.has(edge.id)) this.fail('missingEdgeRoute', { edgeID: edge.id })
    }

    for (const { nodeID, frame } of placement.nodeFrames) this.#frameByNodeID.set(nodeID, frame)
    this.inputID = input.id
    this.nodeFrames = placement.nodeFrames
    this.edgeRoutes = input.topology.edges.map(({ id }) => ({
      edgeID: id,
      route: this.#routeByEdgeID.get(id) as FdGraphEdgeRoute,
    }))
    this.resolvedPortAnchors = input.topology.ports.map(({ key, nodeID }) => {
      const anchor = input.anchor(key)
      const frame = this.#frameByNodeID.get(nodeID)
      if (!anchor || !frame) throw new Error('layout result invariant failed')
      return {
        key,
        position: { x: frame.x + anchor.position.x, y: frame.y + anchor.position.y },
        normal: anchor.normal,
      }
    })
    let contentBounds = placement.contentBounds
    for (const route of this.#routeByEdgeID.values()) {
      contentBounds = unionCanvasRects(contentBounds, route.conservativeBounds)
    }
    if (!usableRect(contentBounds)) this.fail('invalidContentBounds')
    this.contentBounds = contentBounds
  }

  frame(nodeID: NodeID): FdCanvasRect | undefined {
    return this.#frameByNodeID.get(nodeID)
  }

  route(edgeID: EdgeID): FdGraphEdgeRoute | undefined {
    return this.#routeByEdgeID.get(edgeID)
  }

  private fail(kind: FdGraphLayoutResultIssueKind, details?: Record<string, unknown>): never {
    throw new FdGraphLayoutResultIssue(kind, details)
  }
}

export class FdGraphLayoutPipelineError extends Error {
  readonly kind = 'inputIdentityMismatch'

  constructor() {
    super('inputIdentityMismatch')
    this.name = 'FdGraphLayoutPipelineError'
  }
}

export interface FdGraphLayoutStrategy<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly identity: FdLayoutPipelineIdentity
  layout(
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
  ): FdGraphLayoutResult<NodeID, PortID, EdgeID>
}

export interface FdGraphNodePlacementStrategy<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly identity: FdLayoutPipelineIdentity
  place(
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
  ): FdGraphNodePlacement<NodeID, PortID, EdgeID>
}

export interface FdGraphLayoutPostprocessor<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly identity: FdLayoutComponentIdentity
  process(
    placement: FdGraphNodePlacement<NodeID, PortID, EdgeID>,
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
  ): FdGraphNodePlacement<NodeID, PortID, EdgeID>
}

export interface FdGraphEdgeRoutingStrategy<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly identity: FdLayoutComponentIdentity
  routes(
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
    placement: FdGraphNodePlacement<NodeID, PortID, EdgeID>,
  ): readonly FdGraphLayoutEdgeRoute<EdgeID>[]
}

export class FdGraphLayoutPipeline<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> implements FdGraphLayoutStrategy<NodeID, PortID, EdgeID>
{
  readonly placement: FdGraphNodePlacementStrategy<NodeID, PortID, EdgeID>
  readonly postprocessors: readonly FdGraphLayoutPostprocessor<NodeID, PortID, EdgeID>[]
  readonly edgeRouter: FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>

  constructor(
    placement: FdGraphNodePlacementStrategy<NodeID, PortID, EdgeID>,
    edgeRouter: FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>,
  )
  constructor(
    placement: FdGraphNodePlacementStrategy<NodeID, PortID, EdgeID>,
    postprocessors: readonly FdGraphLayoutPostprocessor<NodeID, PortID, EdgeID>[],
    edgeRouter: FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>,
  )
  constructor(
    placement: FdGraphNodePlacementStrategy<NodeID, PortID, EdgeID>,
    postprocessorsOrEdgeRouter:
      | readonly FdGraphLayoutPostprocessor<NodeID, PortID, EdgeID>[]
      | FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>,
    edgeRouter?: FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>,
  ) {
    this.placement = placement
    this.postprocessors = Array.isArray(postprocessorsOrEdgeRouter)
      ? postprocessorsOrEdgeRouter
      : []
    this.edgeRouter = (edgeRouter ?? postprocessorsOrEdgeRouter) as FdGraphEdgeRoutingStrategy<
      NodeID,
      PortID,
      EdgeID
    >
  }

  get identity(): FdLayoutPipelineIdentity {
    return new FdLayoutPipelineIdentity([
      {
        kind: 'group',
        role: FdLayoutPipelineStageRole.placement,
        stages: this.placement.identity.stages,
      },
      {
        kind: 'group',
        role: FdLayoutPipelineStageRole.postprocessing,
        stages: this.postprocessors.map(({ identity }) => ({
          kind: 'component',
          role: FdLayoutPipelineStageRole.postprocessor,
          identity,
        })),
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
    let placement = this.placement.place(input)
    for (const postprocessor of this.postprocessors) {
      placement = postprocessor.process(placement, input)
    }
    return new FdGraphLayoutResult(input, placement, this.edgeRouter.routes(input, placement))
  }
}

const usableRect = ({ x, y, width, height }: FdCanvasRect): boolean =>
  Number.isFinite(x) &&
  Number.isFinite(y) &&
  Number.isFinite(width) &&
  Number.isFinite(height) &&
  width >= 0 &&
  height >= 0

const finitePoint = ({ x, y }: FdCanvasPoint): boolean => Number.isFinite(x) && Number.isFinite(y)

const finiteRoute = (route: FdGraphEdgeRoute): boolean =>
  finitePoint(route.start) &&
  route.segments.every((segment) => {
    if (!finitePoint(segment.end)) return false
    if (segment.kind === 'quadratic') return finitePoint(segment.control)
    if (segment.kind === 'cubic') {
      return finitePoint(segment.control1) && finitePoint(segment.control2)
    }
    return true
  })
