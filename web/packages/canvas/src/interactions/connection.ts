import type { FdCanvasPoint } from '../geometry.js'
import type {
  FdAnyGraphEdge,
  FdGraphElementID,
  FdGraphEndpoint,
  FdGraphPort,
} from '../graph/model.js'
import { graphPortPoint } from '../graph/model.js'
import type { FdGraphSnapshotIndex } from '../graph/snapshot-index.js'

export type FdGraphConnectionEndpoint = FdGraphEndpoint<FdGraphElementID> & {
  readonly portID: FdGraphElementID
}

export type FdGraphConnectionOrigin =
  | { readonly kind: 'new'; readonly source: FdGraphConnectionEndpoint }
  | {
      readonly kind: 'reconnect'
      readonly edgeID: FdGraphElementID
      readonly endpoint: 'source' | 'target'
      readonly original: FdGraphConnectionEndpoint
      readonly fixed: FdGraphConnectionEndpoint
    }

export interface FdGraphConnectionFeedback {
  readonly message?: string
}

export type FdGraphConnectionValidation =
  | { readonly kind: 'valid' }
  | { readonly kind: 'invalid'; readonly feedback?: FdGraphConnectionFeedback }

export interface FdGraphConnectionValidationRequest {
  readonly origin: FdGraphConnectionOrigin
  readonly target: FdGraphConnectionEndpoint
  readonly snapshotID: string | number
}

export interface FdGraphConnectionEditingConfiguration {
  readonly enabled?: boolean
  readonly allowsReconnection?: boolean
  readonly minimumDragDistance?: number
  readonly sourceHitPadding?: number
  readonly targetHitRadius?: number
  readonly rendersDefaultPreview?: boolean
  readonly canBegin?: (origin: FdGraphConnectionOrigin) => boolean
  readonly validate?: (request: FdGraphConnectionValidationRequest) => FdGraphConnectionValidation
}

export interface FdResolvedGraphConnectionEditingConfiguration {
  readonly enabled: boolean
  readonly allowsReconnection: boolean
  readonly minimumDragDistance: number
  readonly sourceHitPadding: number
  readonly targetHitRadius: number
  readonly rendersDefaultPreview: boolean
  readonly canBegin: (origin: FdGraphConnectionOrigin) => boolean
  readonly validate: (request: FdGraphConnectionValidationRequest) => FdGraphConnectionValidation
}

export interface FdGraphConnectionTarget {
  readonly endpoint: FdGraphConnectionEndpoint
  readonly point: FdCanvasPoint
}

export interface FdGraphTransientConnection {
  readonly snapshotID: string | number
  readonly origin: FdGraphConnectionOrigin
  readonly stationaryPoint: FdCanvasPoint
  readonly movingPoint: FdCanvasPoint
  readonly candidate?: FdGraphConnectionTarget
  readonly validation?: FdGraphConnectionValidation
}

export type FdGraphConnectionOperation =
  | {
      readonly kind: 'create'
      readonly source: FdGraphConnectionEndpoint
      readonly target: FdGraphConnectionEndpoint
    }
  | {
      readonly kind: 'reconnect'
      readonly edgeID: FdGraphElementID
      readonly endpoint: 'source' | 'target'
      readonly target: FdGraphConnectionEndpoint
    }

export type FdGraphConnectionCancellationReason =
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'noTarget' }
  | { readonly kind: 'staleSnapshot' }
  | { readonly kind: 'invalidTarget'; readonly feedback?: FdGraphConnectionFeedback }

export type FdGraphConnectionResolution =
  | { readonly kind: 'completed'; readonly operation: FdGraphConnectionOperation }
  | { readonly kind: 'cancelled'; readonly reason: FdGraphConnectionCancellationReason }

const nonnegative = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must not be negative`)
  return value
}

export function resolveGraphConnectionEditingConfiguration(
  configuration: FdGraphConnectionEditingConfiguration = {},
): FdResolvedGraphConnectionEditingConfiguration {
  return {
    enabled: configuration.enabled ?? false,
    allowsReconnection: configuration.allowsReconnection ?? true,
    minimumDragDistance: nonnegative(
      configuration.minimumDragDistance ?? 2,
      'connection minimum drag distance',
    ),
    sourceHitPadding: nonnegative(
      configuration.sourceHitPadding ?? 6,
      'connection source hit padding',
    ),
    targetHitRadius: nonnegative(
      configuration.targetHitRadius ?? 18,
      'connection target hit radius',
    ),
    rendersDefaultPreview: configuration.rendersDefaultPreview ?? true,
    canBegin: configuration.canBegin ?? (() => true),
    validate: configuration.validate ?? (() => ({ kind: 'valid' })),
  }
}

export function graphConnectionEndpoint(
  nodeID: FdGraphElementID,
  port: FdGraphPort,
): FdGraphConnectionEndpoint {
  return { nodeID, portID: port.id }
}

export function graphConnectionOriginForEdge(
  edge: FdAnyGraphEdge,
  endpoint: 'source' | 'target',
): FdGraphConnectionOrigin | undefined {
  const original = edge[endpoint]
  const fixed = edge[endpoint === 'source' ? 'target' : 'source']
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
  origin: FdGraphConnectionOrigin,
  snapshotID: string | number,
  index: FdGraphSnapshotIndex,
  configuration: FdResolvedGraphConnectionEditingConfiguration,
): FdGraphTransientConnection | undefined {
  if (!configuration.enabled || !configuration.canBegin(origin)) return undefined
  if (origin.kind === 'reconnect' && !configuration.allowsReconnection) return undefined
  const stationaryEndpoint = origin.kind === 'new' ? origin.source : origin.fixed
  const movingEndpoint = origin.kind === 'new' ? origin.source : origin.original
  const stationaryPoint = connectionEndpointPoint(index, stationaryEndpoint)
  const movingPoint = connectionEndpointPoint(index, movingEndpoint)
  if (!stationaryPoint || !movingPoint) return undefined
  return { snapshotID, origin, stationaryPoint, movingPoint }
}

export function updateGraphConnection(
  connection: FdGraphTransientConnection,
  worldPoint: FdCanvasPoint,
  snapshotID: string | number,
  index: FdGraphSnapshotIndex,
  targetHitRadius: number,
  configuration: FdResolvedGraphConnectionEditingConfiguration,
): FdGraphTransientConnection {
  if (connection.snapshotID !== snapshotID) return connection
  const candidate = nearestGraphConnectionTarget(
    index,
    worldPoint,
    targetHitRadius,
    movingEndpoint(connection.origin),
  )
  if (!candidate) {
    return {
      snapshotID: connection.snapshotID,
      origin: connection.origin,
      stationaryPoint: connection.stationaryPoint,
      movingPoint: worldPoint,
    }
  }
  return {
    ...connection,
    movingPoint: candidate.point,
    candidate,
    validation: configuration.validate({
      origin: connection.origin,
      target: candidate.endpoint,
      snapshotID,
    }),
  }
}

export function resolveGraphConnection(
  connection: FdGraphTransientConnection,
  snapshotID: string | number,
): FdGraphConnectionResolution {
  if (connection.snapshotID !== snapshotID) {
    return { kind: 'cancelled', reason: { kind: 'staleSnapshot' } }
  }
  if (!connection.candidate) return { kind: 'cancelled', reason: { kind: 'noTarget' } }
  if (connection.validation?.kind !== 'valid') {
    return {
      kind: 'cancelled',
      reason: {
        kind: 'invalidTarget',
        ...(connection.validation?.feedback ? { feedback: connection.validation.feedback } : {}),
      },
    }
  }
  if (connection.origin.kind === 'new') {
    return {
      kind: 'completed',
      operation: {
        kind: 'create',
        source: connection.origin.source,
        target: connection.candidate.endpoint,
      },
    }
  }
  return {
    kind: 'completed',
    operation: {
      kind: 'reconnect',
      edgeID: connection.origin.edgeID,
      endpoint: connection.origin.endpoint,
      target: connection.candidate.endpoint,
    },
  }
}

export function nearestGraphConnectionTarget(
  index: FdGraphSnapshotIndex,
  point: FdCanvasPoint,
  radius: number,
  excluded?: FdGraphConnectionEndpoint,
): FdGraphConnectionTarget | undefined {
  nonnegative(radius, 'connection target radius')
  const nodes = index.nodesIn({
    x: point.x - radius,
    y: point.y - radius,
    width: radius * 2,
    height: radius * 2,
  })
  const maximumDistanceSquared = radius * radius
  let best:
    | { readonly target: FdGraphConnectionTarget; readonly distanceSquared: number }
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
  first: FdGraphConnectionEndpoint,
  second: FdGraphConnectionEndpoint,
): boolean {
  return first.nodeID === second.nodeID && first.portID === second.portID
}

function movingEndpoint(origin: FdGraphConnectionOrigin): FdGraphConnectionEndpoint {
  return origin.kind === 'new' ? origin.source : origin.original
}

function connectionEndpointPoint(
  index: FdGraphSnapshotIndex,
  endpoint: FdGraphConnectionEndpoint,
): FdCanvasPoint | undefined {
  const node = index.nodes.get(endpoint.nodeID)
  if (!node?.ports?.some(({ id }) => id === endpoint.portID)) return undefined
  return graphPortPoint(node, endpoint.portID)
}
