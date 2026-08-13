import type { FdCanvasPoint, FdCanvasViewport } from '../../geometry.js'
import { graphElementIDFromKey } from '../../graph/model.js'
import type { FdGraphSnapshotIndex } from '../../graph/snapshot-index.js'
import {
  beginGraphConnection,
  cancelGraphConnection,
  type FdGraphCanvasConnectionCancellationReason,
  type FdGraphCanvasConnectionEndpoint,
  type FdGraphCanvasConnectionOrigin,
  type FdGraphCanvasConnectionResolution,
  type FdGraphCanvasTransientConnection,
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
  setConnectionPresentation(connection: FdGraphCanvasTransientConnection | undefined): void
  emitConnectionResolution(resolution: FdGraphCanvasConnectionResolution): void
}

interface FdGraphConnectionPointerSession {
  readonly pointerID: number
  readonly startViewportPoint: FdCanvasPoint
  moved: boolean
}

export class FdGraphCanvasConnectionController {
  private connection: FdGraphCanvasTransientConnection | undefined
  private pointerSession: FdGraphConnectionPointerSession | undefined

  constructor(private readonly delegate: FdGraphCanvasConnectionDelegate) {}

  get activePointerID(): number | undefined {
    return this.pointerSession?.pointerID
  }

  get activeConnection(): FdGraphCanvasTransientConnection | undefined {
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

  pointerEnd(event: PointerEvent): FdGraphCanvasConnectionEndpoint | undefined {
    const session = this.pointerSession
    if (!session || event.pointerId !== session.pointerID) return undefined
    const clickedEndpoint =
      !session.moved && this.connection
        ? this.connection.origin.kind === 'new'
          ? this.connection.origin.source
          : this.connection.origin.original
        : undefined
    this.pointerSession = undefined
    if (session.moved) this.finish()
    else this.cancel({ kind: 'cancelled' })
    return clickedEndpoint
  }

  begin(origin: FdGraphCanvasConnectionOrigin): boolean {
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
    this.delegate.emitConnectionResolution(resolveGraphConnection(connection))
    return true
  }

  cancel(reason: FdGraphCanvasConnectionCancellationReason = { kind: 'cancelled' }): boolean {
    const connection = this.connection
    if (!connection) return false
    this.connection = undefined
    this.pointerSession = undefined
    this.delegate.setConnectionPresentation(undefined)
    this.delegate.emitConnectionResolution(cancelGraphConnection(connection, reason))
    return true
  }

  reset(): void {
    this.connection = undefined
    this.pointerSession = undefined
    this.delegate.setConnectionPresentation(undefined)
  }

  private portEndpoint(event: PointerEvent): FdGraphCanvasConnectionEndpoint | undefined {
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
