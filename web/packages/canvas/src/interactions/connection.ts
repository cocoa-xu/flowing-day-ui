import type { FdCanvasPoint } from '../geometry.js'
import type {
  FdAnyGraphEdge,
  FdGraphElementID,
  FdGraphEndpoint,
  FdGraphPort,
} from '../graph/model.js'
import { graphPortPoint } from '../graph/model.js'
import type { FdGraphSnapshotIndex } from '../graph/snapshot-index.js'

export type FdGraphCanvasConnectionEndpoint = FdGraphEndpoint<FdGraphElementID> & {
  readonly portID: FdGraphElementID
}

export type FdGraphCanvasConnectionOrigin =
  | { readonly kind: 'new'; readonly source: FdGraphCanvasConnectionEndpoint }
  | {
      readonly kind: 'reconnect'
      readonly edgeID: FdGraphElementID
      readonly endpoint: 'source' | 'target'
      readonly original: FdGraphCanvasConnectionEndpoint
      readonly fixed: FdGraphCanvasConnectionEndpoint
    }

export interface FdGraphCanvasConnectionFeedback {
  readonly message?: string
}

export type FdGraphCanvasConnectionValidation =
  | { readonly kind: 'valid' }
  | { readonly kind: 'invalid'; readonly feedback?: FdGraphCanvasConnectionFeedback }

export interface FdGraphCanvasConnectionValidationRequest {
  readonly origin: FdGraphCanvasConnectionOrigin
  readonly target: FdGraphCanvasConnectionEndpoint
  readonly snapshotID: string | number
}

export interface FdGraphConnectionEditingConfiguration {
  readonly enabled?: boolean
  readonly allowsReconnection?: boolean
  readonly minimumDragDistance?: number
  readonly sourceHitPadding?: number
  readonly targetHitRadius?: number
  readonly rendersDefaultPreview?: boolean
  readonly canBegin?: (origin: FdGraphCanvasConnectionOrigin) => boolean
  readonly validate?: (
    request: FdGraphCanvasConnectionValidationRequest,
  ) => FdGraphCanvasConnectionValidation
}

export interface FdResolvedGraphConnectionEditingConfiguration {
  readonly enabled: boolean
  readonly allowsReconnection: boolean
  readonly minimumDragDistance: number
  readonly sourceHitPadding: number
  readonly targetHitRadius: number
  readonly rendersDefaultPreview: boolean
  readonly canBegin: (origin: FdGraphCanvasConnectionOrigin) => boolean
  readonly validate: (
    request: FdGraphCanvasConnectionValidationRequest,
  ) => FdGraphCanvasConnectionValidation
}

export interface FdGraphCanvasConnectionTarget {
  readonly endpoint: FdGraphCanvasConnectionEndpoint
  readonly point: FdCanvasPoint
}

export interface FdGraphCanvasTransientConnection {
  readonly snapshotID: string | number
  readonly origin: FdGraphCanvasConnectionOrigin
  readonly stationaryPoint: FdCanvasPoint
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
      readonly endpoint: 'source' | 'target'
      readonly target: FdGraphCanvasConnectionEndpoint
    }

export type FdGraphCanvasConnectionCancellationReason =
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'noTarget' }
  | { readonly kind: 'staleSnapshot' }
  | { readonly kind: 'invalidTarget'; readonly feedback?: FdGraphCanvasConnectionFeedback }

export type FdGraphCanvasConnectionResolution =
  | { readonly kind: 'completed'; readonly operation: FdGraphCanvasConnectionOperation }
  | { readonly kind: 'cancelled'; readonly reason: FdGraphCanvasConnectionCancellationReason }

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
): FdGraphCanvasConnectionEndpoint {
  return { nodeID, portID: port.id }
}

export function graphConnectionOriginForEdge(
  edge: FdAnyGraphEdge,
  endpoint: 'source' | 'target',
): FdGraphCanvasConnectionOrigin | undefined {
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
  origin: FdGraphCanvasConnectionOrigin,
  snapshotID: string | number,
  index: FdGraphSnapshotIndex,
  configuration: FdResolvedGraphConnectionEditingConfiguration,
): FdGraphCanvasTransientConnection | undefined {
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
  connection: FdGraphCanvasTransientConnection,
  worldPoint: FdCanvasPoint,
  snapshotID: string | number,
  index: FdGraphSnapshotIndex,
  targetHitRadius: number,
  configuration: FdResolvedGraphConnectionEditingConfiguration,
): FdGraphCanvasTransientConnection {
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
  connection: FdGraphCanvasTransientConnection,
  snapshotID: string | number,
): FdGraphCanvasConnectionResolution {
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

function connectionEndpointPoint(
  index: FdGraphSnapshotIndex,
  endpoint: FdGraphCanvasConnectionEndpoint,
): FdCanvasPoint | undefined {
  const node = index.nodes.get(endpoint.nodeID)
  if (!node?.ports?.some(({ id }) => id === endpoint.portID)) return undefined
  return graphPortPoint(node, endpoint.portID)
}
