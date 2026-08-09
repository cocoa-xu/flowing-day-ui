import type { FdCanvasPoint, FdCanvasViewport } from '../../geometry.js'
import { graphElementIDFromKey } from '../../graph/model.js'
import type { FdGraphSnapshotIndex } from '../../graph/snapshot-index.js'
import {
  beginGraphConnection,
  type FdGraphConnectionCancellationReason,
  type FdGraphConnectionEndpoint,
  type FdGraphConnectionOrigin,
  type FdGraphConnectionResolution,
  type FdGraphTransientConnection,
  type FdResolvedGraphConnectionEditingConfiguration,
  resolveGraphConnection,
  updateGraphConnection,
} from '../../interactions/connection.js'

export interface FdGraphCanvasConnectionDelegate {
  readonly snapshotID: string | number
  readonly viewport: FdCanvasViewport
  readonly graphIndex: FdGraphSnapshotIndex
  readonly resolvedConnectionConfiguration: FdResolvedGraphConnectionEditingConfiguration
  viewportPoint(event: PointerEvent): FdCanvasPoint
  setConnectionPresentation(connection: FdGraphTransientConnection | undefined): void
  emitConnectionResolution(
    connection: FdGraphTransientConnection,
    resolution: FdGraphConnectionResolution,
  ): void
}

interface FdGraphConnectionPointerSession {
  readonly pointerID: number
  readonly startViewportPoint: FdCanvasPoint
  moved: boolean
}

export class FdGraphCanvasConnectionController {
  private connection: FdGraphTransientConnection | undefined
  private pointerSession: FdGraphConnectionPointerSession | undefined

  constructor(private readonly delegate: FdGraphCanvasConnectionDelegate) {}

  get activePointerID(): number | undefined {
    return this.pointerSession?.pointerID
  }

  get activeConnection(): FdGraphTransientConnection | undefined {
    return this.connection
  }

  pointerDown(event: PointerEvent): boolean {
    if (event.button !== 0 || this.connection) return false
    const source = this.portEndpoint(event)
    if (!source || !this.begin({ kind: 'new', source })) return false
    this.pointerSession = {
      pointerID: event.pointerId,
      startViewportPoint: this.delegate.viewportPoint(event),
      moved: false,
    }
    return true
  }

  pointerMove(event: PointerEvent): void {
    const session = this.pointerSession
    if (!session || event.pointerId !== session.pointerID) return
    const viewportPoint = this.delegate.viewportPoint(event)
    if (
      !session.moved &&
      Math.hypot(
        viewportPoint.x - session.startViewportPoint.x,
        viewportPoint.y - session.startViewportPoint.y,
      ) < this.delegate.resolvedConnectionConfiguration.minimumDragDistance
    ) {
      return
    }
    session.moved = true
    this.update(this.delegate.viewport.transform.removePoint(viewportPoint))
  }

  pointerEnd(event: PointerEvent): void {
    const session = this.pointerSession
    if (!session || event.pointerId !== session.pointerID) return
    this.pointerSession = undefined
    if (session.moved) this.finish()
    else this.cancel({ kind: 'cancelled' })
  }

  begin(origin: FdGraphConnectionOrigin): boolean {
    const connection = beginGraphConnection(
      origin,
      this.delegate.snapshotID,
      this.delegate.graphIndex,
      this.delegate.resolvedConnectionConfiguration,
    )
    if (!connection) return false
    this.connection = connection
    this.delegate.setConnectionPresentation(connection)
    return true
  }

  update(worldPoint: FdCanvasPoint): boolean {
    const connection = this.connection
    if (!connection) return false
    this.connection = updateGraphConnection(
      connection,
      worldPoint,
      this.delegate.snapshotID,
      this.delegate.graphIndex,
      this.delegate.resolvedConnectionConfiguration.targetHitRadius /
        this.delegate.viewport.transform.zoom,
      this.delegate.resolvedConnectionConfiguration,
    )
    this.delegate.setConnectionPresentation(this.connection)
    return true
  }

  finish(): boolean {
    const connection = this.connection
    if (!connection) return false
    this.connection = undefined
    this.pointerSession = undefined
    this.delegate.setConnectionPresentation(undefined)
    this.delegate.emitConnectionResolution(
      connection,
      resolveGraphConnection(connection, this.delegate.snapshotID),
    )
    return true
  }

  cancel(reason: FdGraphConnectionCancellationReason = { kind: 'cancelled' }): boolean {
    const connection = this.connection
    if (!connection) return false
    this.connection = undefined
    this.pointerSession = undefined
    this.delegate.setConnectionPresentation(undefined)
    this.delegate.emitConnectionResolution(connection, { kind: 'cancelled', reason })
    return true
  }

  reset(): void {
    this.connection = undefined
    this.pointerSession = undefined
    this.delegate.setConnectionPresentation(undefined)
  }

  private portEndpoint(event: PointerEvent): FdGraphConnectionEndpoint | undefined {
    for (const candidate of event.composedPath()) {
      if (!(candidate instanceof HTMLElement)) continue
      const nodeKey = candidate.dataset.fdGraphNode
      const portKey = candidate.dataset.fdGraphPort
      if (!nodeKey || !portKey) continue
      const nodeID = graphElementIDFromKey(nodeKey)
      const portID = graphElementIDFromKey(portKey)
      if (nodeID !== undefined && portID !== undefined) return { nodeID, portID }
    }
    return undefined
  }
}
