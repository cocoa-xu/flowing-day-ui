import type { FdCanvasPoint } from '../geometry.js'
import type { FdGraphCanvasConnectionEditingConfiguration } from '../graph/configuration.js'
import type {
  FdAnyGraphEdge,
  FdGraphElementID,
  FdGraphSnapshotEndpoint,
  FdGraphSnapshotPort,
} from '../graph/model.js'
import { graphPortPoint } from '../graph/model.js'
import type { FdGraphSnapshotIndex } from '../graph/snapshot-index.js'

export type FdGraphCanvasConnectionEndpoint = FdGraphSnapshotEndpoint<FdGraphElementID> & {
  readonly portID: FdGraphElementID
}

export type FdGraphCanvasConnectionOrigin =
  | { readonly kind: 'new'; readonly source: FdGraphCanvasConnectionEndpoint }
  | {
      readonly kind: 'reconnect'
      readonly edgeID: FdGraphElementID
      readonly endpoint: FdGraphCanvasEdgeEndpoint
      readonly original: FdGraphCanvasConnectionEndpoint
      readonly fixed: FdGraphCanvasConnectionEndpoint
    }

export type FdGraphCanvasEdgeEndpoint = 'first' | 'second'

export interface FdGraphCanvasConnectionFeedback {
  readonly message?: string
}

export type FdGraphCanvasConnectionValidation =
  | { readonly kind: 'valid' }
  | { readonly kind: 'invalid'; readonly feedback?: FdGraphCanvasConnectionFeedback }

export interface FdGraphCanvasConnectionValidationRequest {
  readonly origin: FdGraphCanvasConnectionOrigin
  readonly target: FdGraphCanvasConnectionEndpoint
  readonly basePresentationSnapshotID: string | number
  readonly baseLayoutInputID: string | number
}

interface FdGraphCanvasConnectionPolicyOptions {
  readonly canBegin?: (origin: FdGraphCanvasConnectionOrigin) => boolean
  readonly validate?: (
    request: FdGraphCanvasConnectionValidationRequest,
  ) => FdGraphCanvasConnectionValidation
}

export class FdGraphCanvasConnectionPolicy {
  private readonly beginAdmission: (origin: FdGraphCanvasConnectionOrigin) => boolean
  private readonly validation: (
    request: FdGraphCanvasConnectionValidationRequest,
  ) => FdGraphCanvasConnectionValidation

  constructor(options: FdGraphCanvasConnectionPolicyOptions = {}) {
    this.beginAdmission = options.canBegin ?? (() => true)
    this.validation = options.validate ?? (() => ({ kind: 'valid' }))
  }

  canBegin(origin: FdGraphCanvasConnectionOrigin): boolean {
    return this.beginAdmission(origin)
  }

  validate(request: FdGraphCanvasConnectionValidationRequest): FdGraphCanvasConnectionValidation {
    return this.validation(request)
  }

  static get standard(): FdGraphCanvasConnectionPolicy {
    return new FdGraphCanvasConnectionPolicy()
  }
}

export interface FdResolvedGraphCanvasConnectionEditingConfiguration {
  readonly isEnabled: boolean
  readonly allowsReconnection: boolean
  readonly minimumDragDistance: number
  readonly sourceHitPadding: number
  readonly targetHitRadius: number
  readonly rendersDefaultPreview: boolean
  readonly policy: FdGraphCanvasConnectionPolicy
}

export interface FdGraphCanvasConnectionTarget {
  readonly endpoint: FdGraphCanvasConnectionEndpoint
  readonly point: FdCanvasPoint
}

export interface FdGraphCanvasTransientConnection {
  readonly origin: FdGraphCanvasConnectionOrigin
  readonly basePresentationSnapshotID: string | number
  readonly baseLayoutInputID: string | number
  readonly stationaryPoint: FdCanvasPoint
  readonly originalMovingPoint: FdCanvasPoint
  readonly movingPoint: FdCanvasPoint
  readonly candidate?: FdGraphCanvasConnectionTarget
  readonly validation?: FdGraphCanvasConnectionValidation
}

export type FdGraphCanvasConnectionOperation =
  | {
      readonly kind: 'create'
      readonly source: FdGraphCanvasConnectionEndpoint
      readonly target: FdGraphCanvasConnectionEndpoint
    }
  | {
      readonly kind: 'reconnect'
      readonly edgeID: FdGraphElementID
      readonly endpoint: FdGraphCanvasEdgeEndpoint
      readonly target: FdGraphCanvasConnectionEndpoint
    }

export type FdGraphCanvasConnectionCancellationReason =
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'noTarget' }
  | { readonly kind: 'invalidTarget'; readonly feedback?: FdGraphCanvasConnectionFeedback }

export interface FdGraphCanvasConnectionCompletionIntent {
  readonly operation: FdGraphCanvasConnectionOperation
  readonly basePresentationSnapshotID: string | number
  readonly baseLayoutInputID: string | number
}

export interface FdGraphCanvasConnectionCancellationIntent {
  readonly origin: FdGraphCanvasConnectionOrigin
  readonly reason: FdGraphCanvasConnectionCancellationReason
  readonly basePresentationSnapshotID: string | number
  readonly baseLayoutInputID: string | number
}

export type FdGraphCanvasConnectionResolution =
  | { readonly kind: 'completed'; readonly intent: FdGraphCanvasConnectionCompletionIntent }
  | { readonly kind: 'cancelled'; readonly intent: FdGraphCanvasConnectionCancellationIntent }

const nonnegative = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must not be negative`)
  return value
}

const positive = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive`)
  return value
}

export function resolveGraphConnectionEditingConfiguration(
  configuration: FdGraphCanvasConnectionEditingConfiguration = { isEnabled: false },
  policy: FdGraphCanvasConnectionPolicy = FdGraphCanvasConnectionPolicy.standard,
): FdResolvedGraphCanvasConnectionEditingConfiguration {
  return {
    isEnabled: configuration.isEnabled,
    allowsReconnection: configuration.allowsReconnection ?? true,
    minimumDragDistance: nonnegative(
      configuration.minimumDragDistance ?? 2,
      'connection minimum drag distance',
    ),
    sourceHitPadding: nonnegative(
      configuration.sourceHitPadding ?? 6,
      'connection source hit padding',
    ),
    targetHitRadius: positive(configuration.targetHitRadius ?? 18, 'connection target hit radius'),
    rendersDefaultPreview: configuration.rendersDefaultPreview ?? true,
    policy,
  }
}

export function graphConnectionEndpoint(
  nodeID: FdGraphElementID,
  port: FdGraphSnapshotPort,
): FdGraphCanvasConnectionEndpoint {
  return { nodeID, portID: port.id }
}

export function graphConnectionOriginForEdge(
  edge: FdAnyGraphEdge,
  endpoint: FdGraphCanvasEdgeEndpoint,
): FdGraphCanvasConnectionOrigin | undefined {
  const originalKey = endpoint === 'first' ? 'source' : 'target'
  const fixedKey = endpoint === 'first' ? 'target' : 'source'
  const original = edge[originalKey]
  const fixed = edge[fixedKey]
  if (original.portID === undefined || fixed.portID === undefined) return undefined
  return {
    kind: 'reconnect',
    edgeID: edge.id,
    endpoint,
    original: { nodeID: original.nodeID, portID: original.portID },
    fixed: { nodeID: fixed.nodeID, portID: fixed.portID },
  }
}

export function beginGraphConnection(
  origin: FdGraphCanvasConnectionOrigin,
  snapshotID: string | number,
  index: FdGraphSnapshotIndex,
  configuration: FdResolvedGraphCanvasConnectionEditingConfiguration,
): FdGraphCanvasTransientConnection | undefined {
  if (!configuration.isEnabled || !configuration.policy.canBegin(origin)) return undefined
  if (origin.kind === 'reconnect' && !configuration.allowsReconnection) return undefined
  const stationaryEndpoint = origin.kind === 'new' ? origin.source : origin.fixed
  const movingEndpoint = origin.kind === 'new' ? origin.source : origin.original
  const stationaryPoint = connectionEndpointPoint(index, stationaryEndpoint)
  const movingPoint = connectionEndpointPoint(index, movingEndpoint)
  if (!stationaryPoint || !movingPoint) return undefined
  return {
    origin,
    basePresentationSnapshotID: snapshotID,
    baseLayoutInputID: snapshotID,
    stationaryPoint,
    originalMovingPoint: movingPoint,
    movingPoint,
  }
}

export function updateGraphConnection(
  connection: FdGraphCanvasTransientConnection,
  worldPoint: FdCanvasPoint,
  snapshotID: string | number,
  index: FdGraphSnapshotIndex,
  targetHitRadius: number,
  configuration: FdResolvedGraphCanvasConnectionEditingConfiguration,
): FdGraphCanvasTransientConnection {
  if (
    connection.basePresentationSnapshotID !== snapshotID ||
    connection.baseLayoutInputID !== snapshotID
  ) {
    return connection
  }
  const candidate = nearestGraphConnectionTarget(
    index,
    worldPoint,
    targetHitRadius,
    movingEndpoint(connection.origin),
  )
  if (!candidate) {
    return {
      origin: connection.origin,
      basePresentationSnapshotID: connection.basePresentationSnapshotID,
      baseLayoutInputID: connection.baseLayoutInputID,
      stationaryPoint: connection.stationaryPoint,
      originalMovingPoint: connection.originalMovingPoint,
      movingPoint: worldPoint,
    }
  }
  return {
    ...connection,
    movingPoint: candidate.point,
    candidate,
    validation: configuration.policy.validate({
      origin: connection.origin,
      target: candidate.endpoint,
      basePresentationSnapshotID: connection.basePresentationSnapshotID,
      baseLayoutInputID: connection.baseLayoutInputID,
    }),
  }
}

export function resolveGraphConnection(
  connection: FdGraphCanvasTransientConnection,
): FdGraphCanvasConnectionResolution {
  if (!connection.candidate) return cancelGraphConnection(connection, { kind: 'noTarget' })
  if (connection.validation?.kind !== 'valid') {
    return cancelGraphConnection(connection, {
      kind: 'invalidTarget',
      ...(connection.validation?.feedback ? { feedback: connection.validation.feedback } : {}),
    })
  }
  const operation: FdGraphCanvasConnectionOperation =
    connection.origin.kind === 'new'
      ? {
          kind: 'create',
          source: connection.origin.source,
          target: connection.candidate.endpoint,
        }
      : {
          kind: 'reconnect',
          edgeID: connection.origin.edgeID,
          endpoint: connection.origin.endpoint,
          target: connection.candidate.endpoint,
        }
  return completedGraphConnection(connection, operation)
}

export function cancelGraphConnection(
  connection: FdGraphCanvasTransientConnection,
  reason: FdGraphCanvasConnectionCancellationReason = { kind: 'cancelled' },
): FdGraphCanvasConnectionResolution {
  return {
    kind: 'cancelled',
    intent: {
      origin: connection.origin,
      reason,
      basePresentationSnapshotID: connection.basePresentationSnapshotID,
      baseLayoutInputID: connection.baseLayoutInputID,
    },
  }
}

export function nearestGraphConnectionTarget(
  index: FdGraphSnapshotIndex,
  point: FdCanvasPoint,
  radius: number,
  excluded?: FdGraphCanvasConnectionEndpoint,
): FdGraphCanvasConnectionTarget | undefined {
  nonnegative(radius, 'connection target radius')
  const nodes = index.nodesIn({
    x: point.x - radius,
    y: point.y - radius,
    width: radius * 2,
    height: radius * 2,
  })
  const maximumDistanceSquared = radius * radius
  let best:
    | { readonly target: FdGraphCanvasConnectionTarget; readonly distanceSquared: number }
    | undefined
  for (const node of nodes) {
    for (const port of node.ports ?? []) {
      const endpoint = graphConnectionEndpoint(node.id, port)
      if (excluded && connectionEndpointsEqual(endpoint, excluded)) continue
      const targetPoint = graphPortPoint(node, port.id)
      const distanceSquared = (targetPoint.x - point.x) ** 2 + (targetPoint.y - point.y) ** 2
      if (distanceSquared > maximumDistanceSquared) continue
      if (!best || distanceSquared < best.distanceSquared) {
        best = { target: { endpoint, point: targetPoint }, distanceSquared }
      }
    }
  }
  return best?.target
}

export function connectionEndpointsEqual(
  first: FdGraphCanvasConnectionEndpoint,
  second: FdGraphCanvasConnectionEndpoint,
): boolean {
  return first.nodeID === second.nodeID && first.portID === second.portID
}

function movingEndpoint(origin: FdGraphCanvasConnectionOrigin): FdGraphCanvasConnectionEndpoint {
  return origin.kind === 'new' ? origin.source : origin.original
}

function completedGraphConnection(
  connection: FdGraphCanvasTransientConnection,
  operation: FdGraphCanvasConnectionOperation,
): FdGraphCanvasConnectionResolution {
  return {
    kind: 'completed',
    intent: {
      operation,
      basePresentationSnapshotID: connection.basePresentationSnapshotID,
      baseLayoutInputID: connection.baseLayoutInputID,
    },
  }
}

function connectionEndpointPoint(
  index: FdGraphSnapshotIndex,
  endpoint: FdGraphCanvasConnectionEndpoint,
): FdCanvasPoint | undefined {
  const node = index.nodes.get(endpoint.nodeID)
  if (!node?.ports?.some(({ id }) => id === endpoint.portID)) return undefined
  return graphPortPoint(node, endpoint.portID)
}
