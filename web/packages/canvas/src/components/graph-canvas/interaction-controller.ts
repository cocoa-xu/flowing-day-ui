import type { FdCanvasPoint, FdCanvasRect, FdCanvasSize, FdCanvasViewport } from '../../geometry.js'
import type {
  FdGraphNodeFrameChange,
  FdGraphNodeFrameChangeKind,
  FdGraphSelectionChangeDetail,
} from '../../graph/events.js'
import type { FdGraphElementID } from '../../graph/model.js'
import { graphElementIDFromKey } from '../../graph/model.js'
import type { FdGraphCanvasNodeCapabilities } from '../../graph/interaction-policy.js'
import type { FdGraphSnapshotIndex } from '../../graph/snapshot-index.js'
import {
  type FdGraphGuide,
  type FdGraphResizeHandle,
  type FdGraphSnapCandidate,
  type FdGraphSnapState,
  graphSelectionBounds,
  resizeGraphBounds,
  scaleGraphFrames,
  snapGraphResize,
  snapGraphTranslationRequest,
} from '../../interactions/arrangement.js'
import type {
  FdGraphCanvasTool,
  FdGraphNodeDragAdmissionRequest,
  FdResolvedGraphCanvasInteractionConfiguration,
  FdResolvedGraphNodeSizeConstraints,
} from '../../interactions/configuration.js'
import { admittedGraphNodeIDs } from '../../interactions/configuration.js'
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
  readonly selectionNodeIDs?: ReadonlySet<FdGraphElementID>
}

export interface FdGraphCanvasInteractionDelegate {
  readonly tool: FdGraphCanvasTool
  readonly viewport: FdCanvasViewport
  readonly graphIndex: FdGraphSnapshotIndex
  readonly snapshotID: string | number
  readonly resolvedConfiguration: FdResolvedGraphCanvasInteractionConfiguration
  readonly selectedNodeIDs: ReadonlySet<FdGraphElementID>
  nodeCapabilities(nodeID: FdGraphElementID): Required<FdGraphCanvasNodeCapabilities>
  viewportPoint(event: PointerEvent): FdCanvasPoint
  nodeIDAtViewportPoint(point: FdCanvasPoint): FdGraphElementID | undefined
  setSelection(
    selection: ReadonlySet<FdGraphElementID>,
    mode: FdGraphSelectionMode,
    detail: Omit<FdGraphSelectionChangeDetail, 'selectedElements' | 'selectedNodeIDs'>,
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
  readonly clickSelectionMode: FdGraphSelectionMode
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
  readonly minimumBoundsSize: FdCanvasSize
  readonly maximumBoundsSize?: FdCanvasSize
  readonly nodeSizeConstraints: ReadonlyMap<FdGraphElementID, FdResolvedGraphNodeSizeConstraints>
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
    const minimumDistance =
      session.kind === 'marquee' ? this.delegate.resolvedConfiguration.marqueeMinimumDistance : 2
    if (
      !session.moved &&
      Math.hypot(
        viewportPoint.x - session.startViewportPoint.x,
        viewportPoint.y - session.startViewportPoint.y,
      ) < minimumDistance
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
        this.delegate.setSelection(session.clickSelection, session.clickSelectionMode, {
          phase: 'ended',
          source: 'pointer',
        })
      } else if (session.kind === 'marquee' && session.mode === 'replace') {
        this.delegate.setSelection(new Set(), 'replace', { phase: 'ended', source: 'pointer' })
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
        this.delegate.setSelection(this.delegate.selectedNodeIDs, 'extend', {
          phase: 'ended',
          source: 'pointer',
        })
      }
    } else {
      this.delegate.setSelection(this.delegate.selectedNodeIDs, session.mode, {
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
    if (!node) return false
    const configuration = this.delegate.resolvedConfiguration
    const mode = graphSelectionMode(event.shiftKey, event.metaKey, event.ctrlKey)
    const initial = this.delegate.selectedNodeIDs
    const clickSelection = resolveGraphSelection(initial, nodeID, mode, configuration.selection)
    const dragSelection = initial.has(nodeID)
      ? new Set(initial)
      : resolveGraphSelection(initial, nodeID, mode, configuration.selection)
    this.delegate.setSelection(dragSelection, initial.has(nodeID) ? 'extend' : mode, {
      phase: 'continuous',
      source: 'pointer',
    })

    const selectedNodes = [...dragSelection].flatMap((id) => {
      const selected = this.delegate.graphIndex.nodes.get(id)
      return selected ? [selected] : []
    })
    const candidateNodes = (configuration.multipleNodeDragging ? selectedNodes : [node]).filter(
      ({ id }) => this.delegate.nodeCapabilities(id).draggable,
    )
    const request: FdGraphNodeDragAdmissionRequest = {
      anchorNode: node,
      selectedNodes,
      candidateNodes,
      snapshotID: this.delegate.snapshotID,
    }
    const admittedNodeIDs =
      configuration.nodeDragging && candidateNodes.some(({ id }) => id === nodeID)
        ? admittedGraphNodeIDs(request, configuration.admitNodeDrag(request))
        : new Set<FdGraphElementID>()
    const baseFrames = new Map(
      candidateNodes.flatMap(({ id, frame }) =>
        admittedNodeIDs.has(id) ? ([[id, frame]] as const) : [],
      ),
    )
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
      clickSelectionMode: mode,
      baseFrames,
      baseBounds,
      canMove: baseFrames.size > 0,
      snapState: {},
      latestFrames: baseFrames,
      moved: false,
    }
    return true
  }

  private beginResize(event: PointerEvent, handle: FdGraphResizeHandle): boolean {
    const configuration = this.delegate.resolvedConfiguration
    if (!configuration.nodeResizing) return false
    const selectedNodes = [...this.delegate.selectedNodeIDs].flatMap((id) => {
      const node = this.delegate.graphIndex.nodes.get(id)
      return node ? [node] : []
    })
    if (selectedNodes.length === 0) return false
    const anchorNode = selectedNodes[0]
    if (!anchorNode || !this.delegate.nodeCapabilities(anchorNode.id).resizable) return false
    const candidateNodes = (configuration.groupResizing ? selectedNodes : [anchorNode]).filter(
      ({ id }) => this.delegate.nodeCapabilities(id).resizable,
    )
    const candidateFrames = new Map(candidateNodes.map(({ id, frame }) => [id, frame]))
    const request = {
      anchorNode,
      selectedNodes,
      candidateNodes,
      snapshotID: this.delegate.snapshotID,
      baseFrames: candidateFrames,
      handle,
    }
    const admittedNodeIDs = admittedGraphNodeIDs(request, configuration.admitNodeResize(request))
    const admittedNodes = candidateNodes.filter(({ id }) => admittedNodeIDs.has(id))
    if (admittedNodes.length === 0) return false
    const baseFrames = new Map(admittedNodes.map(({ id, frame }) => [id, frame]))
    const baseBounds = graphSelectionBounds(baseFrames)
    if (!baseBounds) return false
    const nodeSizeConstraints = new Map(
      admittedNodes.map((node) => [node.id, configuration.nodeSizeConstraints(node)]),
    )
    const boundsConstraints = this.resizeBoundsConstraints(baseFrames, nodeSizeConstraints)
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
      minimumBoundsSize: boundsConstraints.minimumSize,
      ...(boundsConstraints.maximumSize
        ? { maximumBoundsSize: boundsConstraints.maximumSize }
        : {}),
      nodeSizeConstraints,
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
      this.delegate.setSelection(new Set(), 'replace', {
        phase: 'continuous',
        source: 'pointer',
      })
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
    const configuration = this.delegate.resolvedConfiguration
    if (!event.metaKey && !event.ctrlKey && configuration.snapping.enabled) {
      const request = {
        movingBounds: session.baseBounds,
        proposedTranslation: translation,
        candidates: this.snapCandidates(
          {
            ...session.baseBounds,
            x: session.baseBounds.x + translation.width,
            y: session.baseBounds.y + translation.height,
          },
          new Set(session.baseFrames.keys()),
        ),
        configuration: configuration.snapping,
        zoom: this.delegate.viewport.transform.zoom,
        previous: session.snapState,
      }
      const standard = (): ReturnType<typeof snapGraphTranslationRequest> =>
        snapGraphTranslationRequest(request)
      const custom = configuration.snappingStrategy?.translation?.(request)
      const snapped = custom && this.validTranslationResult(custom) ? custom : standard()
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
    this.delegate.setPresentation({
      frames: session.latestFrames,
      guides,
      selectionNodeIDs: new Set(session.baseFrames.keys()),
    })
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
    const configuration = this.delegate.resolvedConfiguration
    const proposedBounds = resizeGraphBounds(
      session.baseBounds,
      session.handle,
      translation,
      {
        width: session.minimumBoundsSize.width,
        height: session.minimumBoundsSize.height,
      },
      session.maximumBoundsSize,
      event.shiftKey,
      event.altKey,
    )
    let guides: readonly FdGraphGuide[] = []
    if (!event.metaKey && !event.ctrlKey && configuration.snapping.enabled) {
      const request = {
        baseFrames: session.baseFrames,
        baseBounds: session.baseBounds,
        proposedBounds,
        proposedTranslation: translation,
        handle: session.handle,
        candidates: this.snapCandidates(proposedBounds, new Set(session.baseFrames.keys())),
        configuration: configuration.snapping,
        minimumSize: {
          width: session.minimumBoundsSize.width,
          height: session.minimumBoundsSize.height,
        },
        ...(session.maximumBoundsSize ? { maximumSize: session.maximumBoundsSize } : {}),
        zoom: this.delegate.viewport.transform.zoom,
        previous: session.snapState,
        preservesAspectRatio: event.shiftKey,
        resizesFromCenter: event.altKey,
      }
      const standard = (): ReturnType<typeof snapGraphResize> => snapGraphResize(request)
      const custom = configuration.snappingStrategy?.resize?.(request)
      const snapped =
        custom && this.validResizeResult(custom, session.baseFrames, session.nodeSizeConstraints)
          ? custom
          : standard()
      session.snapState = snapped.state
      session.latestFrames = snapped.frames
      guides = snapped.guides
    } else {
      session.snapState = {}
      session.latestFrames = scaleGraphFrames(
        session.baseFrames,
        session.baseBounds,
        proposedBounds,
      )
    }
    this.delegate.setPresentation({
      frames: session.latestFrames,
      guides,
      selectionNodeIDs: new Set(session.baseFrames.keys()),
    })
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
    this.delegate.setSelection(selection, session.mode, {
      phase: 'continuous',
      source: 'pointer',
    })
    this.delegate.setPresentation({ frames: new Map(), guides: [], marquee })
  }

  private resizeBoundsConstraints(
    baseFrames: ReadonlyMap<FdGraphElementID, FdCanvasRect>,
    constraintsByNode: ReadonlyMap<FdGraphElementID, FdResolvedGraphNodeSizeConstraints>,
  ): { readonly minimumSize: FdCanvasSize; readonly maximumSize?: FdCanvasSize } {
    const baseBounds = graphSelectionBounds(baseFrames)
    if (!baseBounds) return { minimumSize: { width: 0, height: 0 } }
    let minimumHorizontalScale = 0
    let minimumVerticalScale = 0
    let maximumHorizontalScale = Number.MAX_VALUE
    let maximumVerticalScale = Number.MAX_VALUE
    let hasMaximumWidth = false
    let hasMaximumHeight = false
    for (const [nodeID, frame] of baseFrames) {
      const constraints = constraintsByNode.get(nodeID)
      if (!constraints) continue
      if (frame.width > 0) {
        minimumHorizontalScale = Math.max(
          minimumHorizontalScale,
          constraints.minimumWidth / frame.width,
        )
        if (constraints.maximumWidth !== undefined) {
          maximumHorizontalScale = Math.min(
            maximumHorizontalScale,
            constraints.maximumWidth / frame.width,
          )
          hasMaximumWidth = true
        }
      }
      if (frame.height > 0) {
        minimumVerticalScale = Math.max(
          minimumVerticalScale,
          constraints.minimumHeight / frame.height,
        )
        if (constraints.maximumHeight !== undefined) {
          maximumVerticalScale = Math.min(
            maximumVerticalScale,
            constraints.maximumHeight / frame.height,
          )
          hasMaximumHeight = true
        }
      }
    }
    const minimumSize = {
      width: baseBounds.width * minimumHorizontalScale,
      height: baseBounds.height * minimumVerticalScale,
    }
    if (!hasMaximumWidth && !hasMaximumHeight) return { minimumSize }
    return {
      minimumSize,
      maximumSize: {
        width: hasMaximumWidth
          ? Math.max(minimumSize.width, baseBounds.width * maximumHorizontalScale)
          : Number.MAX_VALUE,
        height: hasMaximumHeight
          ? Math.max(minimumSize.height, baseBounds.height * maximumVerticalScale)
          : Number.MAX_VALUE,
      },
    }
  }

  private snapCandidates(
    bounds: FdCanvasRect,
    excluded: ReadonlySet<FdGraphElementID>,
  ): FdGraphSnapCandidate[] {
    if (
      !this.delegate.resolvedConfiguration.snapping.enabled ||
      (!this.delegate.resolvedConfiguration.snapping.alignment &&
        !this.delegate.resolvedConfiguration.snapping.equalSpacing &&
        !this.delegate.resolvedConfiguration.snapping.equalSize)
    ) {
      return []
    }
    const configuration = this.delegate.resolvedConfiguration.snapping
    const radius = configuration.searchRadius / this.delegate.viewport.transform.zoom
    return this.delegate.graphIndex
      .nodesIn(
        {
          x: bounds.x - radius,
          y: bounds.y - radius,
          width: bounds.width + radius * 2,
          height: bounds.height + radius * 2,
        },
        { maximumCount: configuration.maximumCandidates, excluding: excluded },
      )
      .map(({ id, frame }) => ({ id, frame }))
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

  private validTranslationResult(result: {
    readonly translation: FdCanvasSize
    readonly guides: readonly FdGraphGuide[]
    readonly state: FdGraphSnapState
  }): boolean {
    return (
      Number.isFinite(result.translation.width) &&
      Number.isFinite(result.translation.height) &&
      this.validSnapState(result.state) &&
      result.guides.every((guide) =>
        [guide.position, guide.lowerBound, guide.upperBound].every(Number.isFinite),
      )
    )
  }

  private validResizeResult(
    result: {
      readonly bounds: FdCanvasRect
      readonly frames: ReadonlyMap<FdGraphElementID, FdCanvasRect>
      readonly guides: readonly FdGraphGuide[]
      readonly state: FdGraphSnapState
    },
    baseFrames: ReadonlyMap<FdGraphElementID, FdCanvasRect>,
    constraintsByNode: ReadonlyMap<FdGraphElementID, FdResolvedGraphNodeSizeConstraints>,
  ): boolean {
    if (!this.validRect(result.bounds) || result.frames.size !== baseFrames.size) return false
    for (const id of baseFrames.keys()) {
      const frame = result.frames.get(id)
      if (!frame || !this.validRect(frame)) return false
      const constraints = constraintsByNode.get(id)
      if (
        constraints &&
        (frame.width < constraints.minimumWidth ||
          frame.height < constraints.minimumHeight ||
          (constraints.maximumWidth !== undefined && frame.width > constraints.maximumWidth) ||
          (constraints.maximumHeight !== undefined && frame.height > constraints.maximumHeight))
      ) {
        return false
      }
    }
    return (
      this.validSnapState(result.state) &&
      result.guides.every((guide) =>
        [guide.position, guide.lowerBound, guide.upperBound].every(Number.isFinite),
      )
    )
  }

  private validSnapState(state: FdGraphSnapState): boolean {
    return (
      (state.x === undefined || Number.isFinite(state.x.target)) &&
      (state.y === undefined || Number.isFinite(state.y.target))
    )
  }

  private validRect(rect: FdCanvasRect): boolean {
    return (
      Number.isFinite(rect.x) &&
      Number.isFinite(rect.y) &&
      Number.isFinite(rect.width) &&
      Number.isFinite(rect.height) &&
      rect.width >= 0 &&
      rect.height >= 0
    )
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
          candidate instanceof Element &&
          candidate.matches(
            'button, input, select, textarea, a[href], [contenteditable="true"], [data-fd-graph-port], [data-fd-graph-edge]',
          ),
      )
  }

  private nextTransactionID(): string {
    this.transactionSequence += 1
    return `pointer-${this.transactionSequence}`
  }
}
