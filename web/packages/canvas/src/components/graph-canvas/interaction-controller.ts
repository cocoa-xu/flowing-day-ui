import type { FdCanvasPoint, FdCanvasRect, FdCanvasSize, FdCanvasViewport } from '../../geometry.js'
import type {
  FdGraphNodeFrameChange,
  FdGraphNodeFrameChangeKind,
  FdGraphSelectionChangeDetail,
} from '../../graph/events.js'
import type { FdAnyGraphNode, FdGraphElementID } from '../../graph/model.js'
import { graphElementIDFromKey } from '../../graph/model.js'
import type { FdGraphSnapshotIndex } from '../../graph/snapshot-index.js'
import {
  type FdGraphGuide,
  type FdGraphResizeHandle,
  type FdGraphSnapCandidate,
  type FdGraphSnapState,
  graphSelectionBounds,
  resizeGraphBounds,
  scaleGraphFrames,
  snapGraphTranslation,
} from '../../interactions/arrangement.js'
import type {
  FdGraphCanvasTool,
  FdResolvedGraphCanvasInteractionConfiguration,
} from '../../interactions/configuration.js'
import {
  type FdGraphSelectionMode,
  graphSelectionMode,
  resolveGraphMarqueeSelection,
  resolveGraphSelection,
} from '../../interactions/selection.js'

export interface FdGraphInteractionPresentation {
  readonly frames: ReadonlyMap<FdGraphElementID, FdCanvasRect>
  readonly guides: readonly FdGraphGuide[]
  readonly marquee?: FdCanvasRect
}

export interface FdGraphCanvasInteractionDelegate {
  readonly tool: FdGraphCanvasTool
  readonly viewport: FdCanvasViewport
  readonly graphIndex: FdGraphSnapshotIndex
  readonly resolvedConfiguration: FdResolvedGraphCanvasInteractionConfiguration
  readonly selectedNodeIDs: ReadonlySet<FdGraphElementID>
  viewportPoint(event: PointerEvent): FdCanvasPoint
  nodeIDAtViewportPoint(point: FdCanvasPoint): FdGraphElementID | undefined
  setSelection(
    selection: ReadonlySet<FdGraphElementID>,
    detail: Omit<FdGraphSelectionChangeDetail, 'selectedNodeIDs'>,
  ): void
  setPresentation(presentation: FdGraphInteractionPresentation): void
  emitFrameChanges(
    transactionID: string,
    kind: FdGraphNodeFrameChangeKind,
    phase: 'continuous' | 'ended',
    changes: readonly FdGraphNodeFrameChange[],
  ): void
}

interface FdGraphPointerSessionBase {
  readonly pointerID: number
  readonly transactionID: string
  readonly startViewportPoint: FdCanvasPoint
  readonly startWorldPoint: FdCanvasPoint
  moved: boolean
}

interface FdGraphMoveSession extends FdGraphPointerSessionBase {
  readonly kind: 'move'
  readonly clickedNodeID: FdGraphElementID
  readonly clickSelection: ReadonlySet<FdGraphElementID>
  readonly baseFrames: ReadonlyMap<FdGraphElementID, FdCanvasRect>
  readonly baseBounds: FdCanvasRect
  readonly canMove: boolean
  snapState: FdGraphSnapState
  latestFrames: ReadonlyMap<FdGraphElementID, FdCanvasRect>
}

interface FdGraphResizeSession extends FdGraphPointerSessionBase {
  readonly kind: 'resize'
  readonly handle: FdGraphResizeHandle
  readonly baseFrames: ReadonlyMap<FdGraphElementID, FdCanvasRect>
  readonly baseBounds: FdCanvasRect
  snapState: FdGraphSnapState
  latestFrames: ReadonlyMap<FdGraphElementID, FdCanvasRect>
}

interface FdGraphMarqueeSession extends FdGraphPointerSessionBase {
  readonly kind: 'marquee'
  readonly initialSelection: ReadonlySet<FdGraphElementID>
  readonly mode: FdGraphSelectionMode
}

type FdGraphPointerSession = FdGraphMoveSession | FdGraphResizeSession | FdGraphMarqueeSession

const emptyPresentation: FdGraphInteractionPresentation = { frames: new Map(), guides: [] }

const rectFromPoints = (first: FdCanvasPoint, second: FdCanvasPoint): FdCanvasRect => ({
  x: Math.min(first.x, second.x),
  y: Math.min(first.y, second.y),
  width: Math.abs(second.x - first.x),
  height: Math.abs(second.y - first.y),
})

const translatedFrames = (
  frames: ReadonlyMap<FdGraphElementID, FdCanvasRect>,
  translation: FdCanvasSize,
): ReadonlyMap<FdGraphElementID, FdCanvasRect> =>
  new Map(
    [...frames].map(([id, frame]) => [
      id,
      { ...frame, x: frame.x + translation.width, y: frame.y + translation.height },
    ]),
  )

export class FdGraphCanvasInteractionController {
  private session: FdGraphPointerSession | undefined
  private transactionSequence = 0

  constructor(private readonly delegate: FdGraphCanvasInteractionDelegate) {}

  get activePointerID(): number | undefined {
    return this.session?.pointerID
  }

  pointerDown(event: PointerEvent): boolean {
    if (this.delegate.tool !== 'select' || event.button !== 0 || this.session) return false
    const handle = this.resizeHandle(event)
    if (handle && this.beginResize(event, handle)) return true
    if (this.isInteractiveControl(event)) return false
    const nodeID = this.nodeID(event)
    if (nodeID !== undefined && this.beginNodeInteraction(event, nodeID)) return true
    return this.beginMarquee(event)
  }

  pointerMove(event: PointerEvent): void {
    const session = this.session
    if (!session || event.pointerId !== session.pointerID) return
    const viewportPoint = this.delegate.viewportPoint(event)
    if (
      !session.moved &&
      Math.hypot(
        viewportPoint.x - session.startViewportPoint.x,
        viewportPoint.y - session.startViewportPoint.y,
      ) < 2
    ) {
      return
    }
    session.moved = true
    const worldPoint = this.delegate.viewport.transform.removePoint(viewportPoint)
    if (session.kind === 'move') this.moveNodes(session, worldPoint, event)
    else if (session.kind === 'resize') this.resizeNodes(session, worldPoint, event)
    else this.updateMarquee(session, worldPoint)
  }

  pointerEnd(event: PointerEvent): void {
    const session = this.session
    if (!session || event.pointerId !== session.pointerID) return
    if (!session.moved) {
      if (session.kind === 'move') {
        this.delegate.setSelection(session.clickSelection, { phase: 'ended', source: 'pointer' })
      } else if (session.kind === 'marquee' && session.mode === 'replace') {
        this.delegate.setSelection(new Set(), { phase: 'ended', source: 'pointer' })
      }
    } else if (session.kind === 'move' || session.kind === 'resize') {
      const changes = this.frameChanges(session.baseFrames, session.latestFrames)
      if (changes.length > 0) {
        this.delegate.emitFrameChanges(
          session.transactionID,
          session.kind === 'move' ? 'drag' : 'resize',
          'ended',
          changes,
        )
      } else {
        this.delegate.setSelection(this.delegate.selectedNodeIDs, {
          phase: 'ended',
          source: 'pointer',
        })
      }
    } else {
      this.delegate.setSelection(this.delegate.selectedNodeIDs, {
        phase: 'ended',
        source: 'pointer',
      })
    }
    this.session = undefined
    this.delegate.setPresentation(emptyPresentation)
  }

  cancel(): void {
    this.session = undefined
    this.delegate.setPresentation(emptyPresentation)
  }

  private beginNodeInteraction(event: PointerEvent, nodeID: FdGraphElementID): boolean {
    const node = this.delegate.graphIndex.nodes.get(nodeID)
    if (!node || node.capabilities?.selectable === false) return false
    const configuration = this.delegate.resolvedConfiguration
    const mode = graphSelectionMode(event.shiftKey, event.metaKey, event.ctrlKey)
    const initial = this.delegate.selectedNodeIDs
    const clickSelection = resolveGraphSelection(initial, nodeID, mode, configuration.selection)
    const dragSelection = initial.has(nodeID)
      ? new Set(initial)
      : resolveGraphSelection(initial, nodeID, mode, configuration.selection)
    this.delegate.setSelection(dragSelection, { phase: 'continuous', source: 'pointer' })

    let nodeIDs = dragSelection.size > 0 ? [...dragSelection] : [nodeID]
    if (!configuration.multipleNodeDragging) nodeIDs = [nodeID]
    const selectedNodes = nodeIDs.flatMap((id) => {
      const selected = this.delegate.graphIndex.nodes.get(id)
      return selected ? [selected] : []
    })
    const movable = selectedNodes.filter(({ capabilities }) => capabilities?.draggable !== false)
    const baseFrames = new Map(movable.map(({ id, frame }) => [id, frame]))
    const baseBounds = graphSelectionBounds(baseFrames) ?? node.frame
    this.session = {
      kind: 'move',
      pointerID: event.pointerId,
      transactionID: this.nextTransactionID(),
      startViewportPoint: this.delegate.viewportPoint(event),
      startWorldPoint: this.delegate.viewport.transform.removePoint(
        this.delegate.viewportPoint(event),
      ),
      clickedNodeID: nodeID,
      clickSelection,
      baseFrames,
      baseBounds,
      canMove:
        configuration.nodeDragging &&
        movable.length === selectedNodes.length &&
        configuration.canDragNodes(selectedNodes),
      snapState: {},
      latestFrames: baseFrames,
      moved: false,
    }
    return true
  }

  private beginResize(event: PointerEvent, handle: FdGraphResizeHandle): boolean {
    const configuration = this.delegate.resolvedConfiguration
    if (!configuration.nodeResizing) return false
    const nodes = [...this.delegate.selectedNodeIDs].flatMap((id) => {
      const node = this.delegate.graphIndex.nodes.get(id)
      return node ? [node] : []
    })
    if (nodes.length === 0 || (nodes.length > 1 && !configuration.groupResizing)) return false
    if (nodes.some(({ capabilities }) => capabilities?.resizable === false)) return false
    if (!configuration.canResizeNodes(nodes)) return false
    const baseFrames = new Map(nodes.map(({ id, frame }) => [id, frame]))
    const baseBounds = graphSelectionBounds(baseFrames)
    if (!baseBounds) return false
    const viewportPoint = this.delegate.viewportPoint(event)
    this.session = {
      kind: 'resize',
      pointerID: event.pointerId,
      transactionID: this.nextTransactionID(),
      startViewportPoint: viewportPoint,
      startWorldPoint: this.delegate.viewport.transform.removePoint(viewportPoint),
      handle,
      baseFrames,
      baseBounds,
      snapState: {},
      latestFrames: baseFrames,
      moved: false,
    }
    return true
  }

  private beginMarquee(event: PointerEvent): boolean {
    const configuration = this.delegate.resolvedConfiguration
    if (configuration.selection === 'none') return false
    const mode = graphSelectionMode(event.shiftKey, event.metaKey, event.ctrlKey)
    const initialSelection = new Set(this.delegate.selectedNodeIDs)
    const viewportPoint = this.delegate.viewportPoint(event)
    const worldPoint = this.delegate.viewport.transform.removePoint(viewportPoint)
    this.session = {
      kind: 'marquee',
      pointerID: event.pointerId,
      transactionID: this.nextTransactionID(),
      startViewportPoint: viewportPoint,
      startWorldPoint: worldPoint,
      initialSelection,
      mode,
      moved: false,
    }
    if (mode === 'replace') {
      this.delegate.setSelection(new Set(), { phase: 'continuous', source: 'pointer' })
    }
    return true
  }

  private moveNodes(
    session: FdGraphMoveSession,
    worldPoint: FdCanvasPoint,
    event: PointerEvent,
  ): void {
    if (!session.canMove) return
    let translation = {
      width: worldPoint.x - session.startWorldPoint.x,
      height: worldPoint.y - session.startWorldPoint.y,
    }
    if (event.shiftKey) {
      if (Math.abs(translation.width) >= Math.abs(translation.height)) translation.height = 0
      else translation.width = 0
    }
    let guides: readonly FdGraphGuide[] = []
    if (!event.metaKey && !event.ctrlKey) {
      const snapped = snapGraphTranslation(
        session.baseBounds,
        translation,
        this.snapCandidates(
          {
            ...session.baseBounds,
            x: session.baseBounds.x + translation.width,
            y: session.baseBounds.y + translation.height,
          },
          new Set(session.baseFrames.keys()),
        ),
        this.delegate.resolvedConfiguration.snapping,
        this.delegate.viewport.transform.zoom,
        session.snapState,
      )
      session.snapState = snapped.state
      translation = snapped.translation
      guides = snapped.guides
      if (event.shiftKey) {
        if (
          Math.abs(worldPoint.x - session.startWorldPoint.x) >=
          Math.abs(worldPoint.y - session.startWorldPoint.y)
        ) {
          translation.height = 0
          guides = guides.filter(({ axis }) => axis === 'vertical')
        } else {
          translation.width = 0
          guides = guides.filter(({ axis }) => axis === 'horizontal')
        }
      }
    } else session.snapState = {}
    session.latestFrames = translatedFrames(session.baseFrames, translation)
    this.delegate.setPresentation({ frames: session.latestFrames, guides })
    this.delegate.emitFrameChanges(
      session.transactionID,
      'drag',
      'continuous',
      this.frameChanges(session.baseFrames, session.latestFrames),
    )
  }

  private resizeNodes(
    session: FdGraphResizeSession,
    worldPoint: FdCanvasPoint,
    event: PointerEvent,
  ): void {
    const translation = {
      width: worldPoint.x - session.startWorldPoint.x,
      height: worldPoint.y - session.startWorldPoint.y,
    }
    let bounds = resizeGraphBounds(
      session.baseBounds,
      session.handle,
      translation,
      {
        width: this.delegate.resolvedConfiguration.minimumNodeWidth,
        height: this.delegate.resolvedConfiguration.minimumNodeHeight,
      },
      event.shiftKey,
      event.altKey,
    )
    let guides: readonly FdGraphGuide[] = []
    if (!event.metaKey && !event.ctrlKey) {
      const activePoint = this.resizeActivePoint(bounds, session.handle)
      const snapped = snapGraphTranslation(
        { x: activePoint.x, y: activePoint.y, width: 0, height: 0 },
        { width: 0, height: 0 },
        this.snapCandidates(bounds, new Set(session.baseFrames.keys())),
        this.delegate.resolvedConfiguration.snapping,
        this.delegate.viewport.transform.zoom,
        session.snapState,
      )
      session.snapState = snapped.state
      bounds = resizeGraphBounds(
        session.baseBounds,
        session.handle,
        {
          width:
            translation.width +
            (session.handle.includes('Right') ||
            session.handle.includes('Left') ||
            session.handle === 'right' ||
            session.handle === 'left'
              ? snapped.translation.width
              : 0),
          height:
            translation.height +
            (session.handle.startsWith('top') || session.handle.startsWith('bottom')
              ? snapped.translation.height
              : 0),
        },
        {
          width: this.delegate.resolvedConfiguration.minimumNodeWidth,
          height: this.delegate.resolvedConfiguration.minimumNodeHeight,
        },
        event.shiftKey,
        event.altKey,
      )
      guides = snapped.guides
    } else session.snapState = {}
    session.latestFrames = scaleGraphFrames(session.baseFrames, session.baseBounds, bounds)
    this.delegate.setPresentation({ frames: session.latestFrames, guides })
    this.delegate.emitFrameChanges(
      session.transactionID,
      'resize',
      'continuous',
      this.frameChanges(session.baseFrames, session.latestFrames),
    )
  }

  private updateMarquee(session: FdGraphMarqueeSession, worldPoint: FdCanvasPoint): void {
    if (this.delegate.resolvedConfiguration.marquee === 'disabled') return
    const marquee = rectFromPoints(session.startWorldPoint, worldPoint)
    const nodes = this.delegate.graphIndex.nodesIn(marquee)
    const selection = resolveGraphMarqueeSelection(
      session.initialSelection,
      nodes,
      marquee,
      session.mode,
      this.delegate.resolvedConfiguration.selection,
      this.delegate.resolvedConfiguration.marquee,
    )
    this.delegate.setSelection(selection, { phase: 'continuous', source: 'pointer' })
    this.delegate.setPresentation({ frames: new Map(), guides: [], marquee })
  }

  private snapCandidates(
    bounds: FdCanvasRect,
    excluded: ReadonlySet<FdGraphElementID>,
  ): FdGraphSnapCandidate[] {
    if (
      !this.delegate.resolvedConfiguration.snapping.enabled ||
      !this.delegate.resolvedConfiguration.snapping.alignment
    ) {
      return []
    }
    const tolerance =
      this.delegate.resolvedConfiguration.snapping.releaseDistance /
      this.delegate.viewport.transform.zoom
    const content = this.delegate.graphIndex.contentBounds
    const xAnchors = [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width]
    const yAnchors = [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height]
    const nodes = new Map<FdGraphElementID, FdAnyGraphNode>()
    for (const x of xAnchors) {
      for (const node of this.delegate.graphIndex.nodesIn({
        x: x - tolerance,
        y: content.y,
        width: tolerance * 2,
        height: content.height,
      })) {
        nodes.set(node.id, node)
      }
    }
    for (const y of yAnchors) {
      for (const node of this.delegate.graphIndex.nodesIn({
        x: content.x,
        y: y - tolerance,
        width: content.width,
        height: tolerance * 2,
      })) {
        nodes.set(node.id, node)
      }
    }
    return [...nodes.values()]
      .filter(({ id }) => !excluded.has(id))
      .map(({ id, frame }) => ({ id, frame }))
  }

  private resizeActivePoint(bounds: FdCanvasRect, handle: FdGraphResizeHandle): FdCanvasPoint {
    const x =
      handle.includes('Left') || handle === 'left'
        ? bounds.x
        : handle.includes('Right') || handle === 'right'
          ? bounds.x + bounds.width
          : bounds.x + bounds.width / 2
    const y = handle.startsWith('top')
      ? bounds.y
      : handle.startsWith('bottom')
        ? bounds.y + bounds.height
        : bounds.y + bounds.height / 2
    return { x, y }
  }

  private frameChanges(
    before: ReadonlyMap<FdGraphElementID, FdCanvasRect>,
    after: ReadonlyMap<FdGraphElementID, FdCanvasRect>,
  ): FdGraphNodeFrameChange[] {
    return [...after].flatMap(([nodeID, frame]) => {
      const original = before.get(nodeID)
      if (
        !original ||
        (original.x === frame.x &&
          original.y === frame.y &&
          original.width === frame.width &&
          original.height === frame.height)
      ) {
        return []
      }
      return [{ nodeID, before: original, after: frame }]
    })
  }

  private nodeID(event: PointerEvent): FdGraphElementID | undefined {
    for (const candidate of event.composedPath()) {
      if (!(candidate instanceof HTMLElement)) continue
      const key = candidate.dataset.fdGraphNode
      if (key) return graphElementIDFromKey(key)
    }
    return this.delegate.nodeIDAtViewportPoint(this.delegate.viewportPoint(event))
  }

  private resizeHandle(event: PointerEvent): FdGraphResizeHandle | undefined {
    for (const candidate of event.composedPath()) {
      if (!(candidate instanceof HTMLElement)) continue
      const handle = candidate.dataset.fdResizeHandle as FdGraphResizeHandle | undefined
      if (handle) return handle
    }
    return undefined
  }

  private isInteractiveControl(event: PointerEvent): boolean {
    return event
      .composedPath()
      .some(
        (candidate) =>
          candidate instanceof HTMLElement &&
          candidate.matches('button, input, select, textarea, a[href], [contenteditable="true"]'),
      )
  }

  private nextTransactionID(): string {
    this.transactionSequence += 1
    return `pointer-${this.transactionSequence}`
  }
}
