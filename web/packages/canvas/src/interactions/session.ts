import type { FdCanvasPoint, FdCanvasRect, FdCanvasSize } from '../geometry.js'
import { type FdCanvasTransform, FdCanvasViewport, unionCanvasRects } from '../geometry.js'
import type { FdGraphCanvasResizeEdges } from '../graph/interaction-policy.js'
import type { FdGraphElementID } from '../graph/model.js'
import type { FdGraphPresentationSnapshotID, FdLayoutInputID } from '../layout/model.js'
import type {
  FdGraphCanvasArrangementAction,
  FdGraphCanvasGeometryAxis,
  FdGraphCanvasGuide,
} from './arrangement.js'
import { FdGraphCanvasSnapState } from './arrangement.js'
import type { FdGraphCanvasTool } from './configuration.js'
import type {
  FdGraphCanvasConnectionCancellationIntent,
  FdGraphCanvasConnectionCompletionIntent,
  FdGraphCanvasTransientConnection,
} from './connection-model.js'
import type { FdGraphCanvasMarquee, FdGraphCanvasSelectionCommand } from './selection.js'

export class FdGraphCanvasSessionID {
  readonly rawValue: string

  constructor(rawValue: string = crypto.randomUUID()) {
    this.rawValue = rawValue
  }
}

export interface FdGraphCanvasTransientNodeDragOptions<
  ElementID extends FdGraphElementID = FdGraphElementID,
> {
  readonly nodeID: ElementID
  readonly nodeIDs?: ReadonlySet<ElementID>
  readonly basePresentationSnapshotID: FdGraphPresentationSnapshotID
  readonly baseLayoutInputID: FdLayoutInputID
  readonly baseBounds?: FdCanvasRect
  readonly translation?: FdCanvasSize
  readonly guides?: readonly FdGraphCanvasGuide[]
  readonly snapState?: FdGraphCanvasSnapState
  readonly constrainedAxis?: FdGraphCanvasGeometryAxis
}

export class FdGraphCanvasTransientNodeDrag<ElementID extends FdGraphElementID = FdGraphElementID> {
  readonly nodeID: ElementID
  readonly nodeIDs: ReadonlySet<ElementID>
  readonly basePresentationSnapshotID: FdGraphPresentationSnapshotID
  readonly baseLayoutInputID: FdLayoutInputID
  readonly baseBounds: FdCanvasRect | undefined
  translation: FdCanvasSize
  guides: readonly FdGraphCanvasGuide[]
  snapState: FdGraphCanvasSnapState
  constrainedAxis: FdGraphCanvasGeometryAxis | undefined

  constructor(options: FdGraphCanvasTransientNodeDragOptions<ElementID>) {
    const nodeIDs = new Set(options.nodeIDs ?? [options.nodeID])
    if (!nodeIDs.has(options.nodeID))
      throw new RangeError('transient drag must include anchor node')
    this.nodeID = options.nodeID
    this.nodeIDs = nodeIDs
    this.basePresentationSnapshotID = options.basePresentationSnapshotID
    this.baseLayoutInputID = options.baseLayoutInputID
    this.baseBounds = options.baseBounds
    this.translation = options.translation ?? { width: 0, height: 0 }
    this.guides = options.guides ?? []
    this.snapState = options.snapState ?? new FdGraphCanvasSnapState()
    this.constrainedAxis = options.constrainedAxis
  }
}

export interface FdGraphCanvasTransientNodeResizeOptions<
  ElementID extends FdGraphElementID = FdGraphElementID,
> {
  readonly anchorNodeID: ElementID
  readonly basePresentationSnapshotID: FdGraphPresentationSnapshotID
  readonly baseLayoutInputID: FdLayoutInputID
  readonly nodeOrder: readonly ElementID[]
  readonly baseFrames: ReadonlyMap<ElementID, FdCanvasRect>
  readonly minimumBoundsSize?: FdCanvasSize
  readonly maximumBoundsSize?: FdCanvasSize
  readonly edges: FdGraphCanvasResizeEdges
  readonly bounds?: FdCanvasRect
  readonly guides?: readonly FdGraphCanvasGuide[]
  readonly snapState?: FdGraphCanvasSnapState
  readonly aspectRatioDrivingAxis?: FdGraphCanvasGeometryAxis
}

export class FdGraphCanvasTransientNodeResize<
  ElementID extends FdGraphElementID = FdGraphElementID,
> {
  readonly anchorNodeID: ElementID
  readonly nodeIDs: ReadonlySet<ElementID>
  readonly nodeOrder: readonly ElementID[]
  readonly basePresentationSnapshotID: FdGraphPresentationSnapshotID
  readonly baseLayoutInputID: FdLayoutInputID
  readonly baseFrames: ReadonlyMap<ElementID, FdCanvasRect>
  readonly baseBounds: FdCanvasRect
  readonly minimumBoundsSize: FdCanvasSize
  readonly maximumBoundsSize: FdCanvasSize | undefined
  readonly edges: FdGraphCanvasResizeEdges
  bounds: FdCanvasRect
  guides: readonly FdGraphCanvasGuide[]
  snapState: FdGraphCanvasSnapState
  aspectRatioDrivingAxis: FdGraphCanvasGeometryAxis | undefined

  constructor(options: FdGraphCanvasTransientNodeResizeOptions<ElementID>) {
    const nodeIDs = new Set(options.baseFrames.keys())
    if (
      options.edges.size === 0 ||
      options.baseFrames.size === 0 ||
      !options.baseFrames.has(options.anchorNodeID) ||
      options.nodeOrder[0] !== options.anchorNodeID ||
      options.nodeOrder.length !== options.baseFrames.size ||
      options.nodeOrder.some((nodeID) => !nodeIDs.has(nodeID))
    ) {
      throw new RangeError('invalid transient resize geometry')
    }
    const minimumBoundsSize = options.minimumBoundsSize ?? { width: 0, height: 0 }
    validateSize(minimumBoundsSize, 'minimum bounds size')
    if (options.maximumBoundsSize) {
      validateSize(options.maximumBoundsSize, 'maximum bounds size')
      if (
        options.maximumBoundsSize.width < minimumBoundsSize.width ||
        options.maximumBoundsSize.height < minimumBoundsSize.height
      ) {
        throw new RangeError('maximum bounds size must contain minimum bounds size')
      }
    }
    let baseBounds: FdCanvasRect | undefined
    for (const frame of options.baseFrames.values())
      baseBounds = unionCanvasRects(baseBounds, frame)
    this.anchorNodeID = options.anchorNodeID
    this.nodeIDs = nodeIDs
    this.nodeOrder = [...options.nodeOrder]
    this.basePresentationSnapshotID = options.basePresentationSnapshotID
    this.baseLayoutInputID = options.baseLayoutInputID
    this.baseFrames = new Map(options.baseFrames)
    this.baseBounds = baseBounds as FdCanvasRect
    this.minimumBoundsSize = minimumBoundsSize
    this.maximumBoundsSize = options.maximumBoundsSize
    this.edges = new Set(options.edges)
    this.bounds = options.bounds ?? this.baseBounds
    this.guides = options.guides ?? []
    this.snapState = options.snapState ?? new FdGraphCanvasSnapState()
    this.aspectRatioDrivingAxis = options.aspectRatioDrivingAxis
  }
}

export interface FdGraphCanvasSessionStateOptions<
  ElementID extends FdGraphElementID = FdGraphElementID,
> {
  readonly viewport?: FdCanvasViewport
  readonly selection?: ReadonlySet<ElementID>
  readonly focusedElementID?: ElementID
  readonly hoveredElementID?: ElementID
  readonly tool?: FdGraphCanvasTool
  readonly marquee?: FdGraphCanvasMarquee
  readonly transientNodeDrag?: FdGraphCanvasTransientNodeDrag<ElementID>
  readonly transientNodeResize?: FdGraphCanvasTransientNodeResize<ElementID>
  readonly transientConnection?: FdGraphCanvasTransientConnection<ElementID>
}

export class FdGraphCanvasSessionState<ElementID extends FdGraphElementID = FdGraphElementID> {
  viewport: FdCanvasViewport
  selection: Set<ElementID>
  focusedElementID: ElementID | undefined
  hoveredElementID: ElementID | undefined
  tool: FdGraphCanvasTool
  marquee: FdGraphCanvasMarquee | undefined
  transientNodeDrag: FdGraphCanvasTransientNodeDrag<ElementID> | undefined
  transientNodeResize: FdGraphCanvasTransientNodeResize<ElementID> | undefined
  transientConnection: FdGraphCanvasTransientConnection<ElementID> | undefined

  constructor(options: FdGraphCanvasSessionStateOptions<ElementID> = {}) {
    this.viewport = options.viewport ?? new FdCanvasViewport()
    this.selection = new Set(options.selection)
    this.focusedElementID = options.focusedElementID
    this.hoveredElementID = options.hoveredElementID
    this.tool = options.tool ?? 'select'
    this.marquee = options.marquee
    this.transientNodeDrag = options.transientNodeDrag
    this.transientNodeResize = options.transientNodeResize
    this.transientConnection = options.transientConnection
  }
}

export type FdGraphCanvasFitScope<ElementID extends FdGraphElementID = FdGraphElementID> =
  | { readonly kind: 'presentation' }
  | { readonly kind: 'selection' }
  | { readonly kind: 'elements'; readonly elementIDs: ReadonlySet<ElementID> }

export type FdGraphCanvasJumpSelectionBehavior = 'preserve' | 'replace' | 'add'

export type FdGraphCanvasSessionCommandAction<
  ElementID extends FdGraphElementID = FdGraphElementID,
> =
  | { readonly kind: 'focus'; readonly elementID: ElementID; readonly zoom?: number }
  | {
      readonly kind: 'jumpToElement'
      readonly elementID: ElementID
      readonly selection?: FdGraphCanvasJumpSelectionBehavior
      readonly zoom?: number
    }
  | {
      readonly kind: 'pan'
      readonly worldPoint: FdCanvasPoint
      readonly viewportPoint?: FdCanvasPoint
      readonly zoom?: number
    }
  | { readonly kind: 'restoreViewport'; readonly transform: FdCanvasTransform }
  | { readonly kind: 'select'; readonly command: FdGraphCanvasSelectionCommand<ElementID> }
  | {
      readonly kind: 'fit'
      readonly scope: FdGraphCanvasFitScope<ElementID>
      readonly padding: number
      readonly maximumZoom?: number
    }
  | { readonly kind: 'inspect'; readonly elementID: ElementID }
  | { readonly kind: 'arrange'; readonly action: FdGraphCanvasArrangementAction }

export class FdGraphCanvasSessionCommand<ElementID extends FdGraphElementID = FdGraphElementID> {
  readonly id: string
  readonly targetSessionID: FdGraphCanvasSessionID
  readonly action: FdGraphCanvasSessionCommandAction<ElementID>
  readonly animated: boolean

  constructor(
    targetSessionID: FdGraphCanvasSessionID,
    action: FdGraphCanvasSessionCommandAction<ElementID>,
    animated = true,
    id: string = crypto.randomUUID(),
  ) {
    this.id = id
    this.targetSessionID = targetSessionID
    this.action = action
    this.animated = animated
  }

  targets(sessionID: FdGraphCanvasSessionID): boolean {
    return this.targetSessionID.rawValue === sessionID.rawValue
  }
}

export class FdGraphCanvasNavigation {
  private constructor() {}

  static jumpCommand<ElementID extends FdGraphElementID>(
    elementID: ElementID,
    sessionID: FdGraphCanvasSessionID,
    selection: FdGraphCanvasJumpSelectionBehavior = 'replace',
    zoom?: number,
    animated = true,
  ): FdGraphCanvasSessionCommand<ElementID> {
    return new FdGraphCanvasSessionCommand(
      sessionID,
      { kind: 'jumpToElement', elementID, selection, ...(zoom === undefined ? {} : { zoom }) },
      animated,
    )
  }
}

export type FdGraphCanvasElementAction =
  | 'collapse'
  | 'expand'
  | 'drillIn'
  | 'inspect'
  | 'beginConnection'
  | 'completeConnection'
  | 'cancelConnection'

export class FdGraphCanvasNodeDragIntent<ElementID extends FdGraphElementID = FdGraphElementID> {
  readonly nodeID: ElementID
  readonly nodeIDs: ReadonlySet<ElementID>
  readonly basePresentationSnapshotID: FdGraphPresentationSnapshotID
  readonly baseLayoutInputID: FdLayoutInputID
  readonly translation: FdCanvasSize

  constructor(
    nodeID: ElementID,
    basePresentationSnapshotID: FdGraphPresentationSnapshotID,
    baseLayoutInputID: FdLayoutInputID,
    translation: FdCanvasSize,
    nodeIDs: ReadonlySet<ElementID> = new Set([nodeID]),
  ) {
    if (!nodeIDs.has(nodeID)) throw new RangeError('node drag intent must include anchor node')
    validateOffset(translation, 'drag translation')
    this.nodeID = nodeID
    this.nodeIDs = new Set(nodeIDs)
    this.basePresentationSnapshotID = basePresentationSnapshotID
    this.baseLayoutInputID = baseLayoutInputID
    this.translation = translation
  }
}

export class FdGraphCanvasNodeResizeChange<ElementID extends FdGraphElementID = FdGraphElementID> {
  readonly nodeID: ElementID
  readonly originTranslation: FdCanvasSize
  readonly sizeDelta: FdCanvasSize

  constructor(nodeID: ElementID, originTranslation: FdCanvasSize, sizeDelta: FdCanvasSize) {
    validateOffset(originTranslation, 'resize origin translation')
    validateOffset(sizeDelta, 'resize size delta')
    this.nodeID = nodeID
    this.originTranslation = originTranslation
    this.sizeDelta = sizeDelta
  }
}

export class FdGraphCanvasNodeResizeIntent<ElementID extends FdGraphElementID = FdGraphElementID> {
  readonly anchorNodeID: ElementID
  readonly changes: readonly FdGraphCanvasNodeResizeChange<ElementID>[]
  readonly edges: FdGraphCanvasResizeEdges
  readonly basePresentationSnapshotID: FdGraphPresentationSnapshotID
  readonly baseLayoutInputID: FdLayoutInputID

  constructor(
    anchorNodeID: ElementID,
    changes: readonly FdGraphCanvasNodeResizeChange<ElementID>[],
    edges: FdGraphCanvasResizeEdges,
    basePresentationSnapshotID: FdGraphPresentationSnapshotID,
    baseLayoutInputID: FdLayoutInputID,
  ) {
    const nodeIDs = new Set(changes.map(({ nodeID }) => nodeID))
    if (
      edges.size === 0 ||
      changes.length === 0 ||
      !nodeIDs.has(anchorNodeID) ||
      nodeIDs.size !== changes.length
    ) {
      throw new RangeError('invalid node resize intent')
    }
    this.anchorNodeID = anchorNodeID
    this.changes = changes
    this.edges = new Set(edges)
    this.basePresentationSnapshotID = basePresentationSnapshotID
    this.baseLayoutInputID = baseLayoutInputID
  }
}

export class FdGraphCanvasNodeArrangementIntent<
  ElementID extends FdGraphElementID = FdGraphElementID,
> {
  readonly action: FdGraphCanvasArrangementAction
  readonly translations: ReadonlyMap<ElementID, FdCanvasSize>
  readonly basePresentationSnapshotID: FdGraphPresentationSnapshotID
  readonly baseLayoutInputID: FdLayoutInputID

  constructor(
    action: FdGraphCanvasArrangementAction,
    translations: ReadonlyMap<ElementID, FdCanvasSize>,
    basePresentationSnapshotID: FdGraphPresentationSnapshotID,
    baseLayoutInputID: FdLayoutInputID,
  ) {
    this.action = action
    this.translations = new Map(translations)
    this.basePresentationSnapshotID = basePresentationSnapshotID
    this.baseLayoutInputID = baseLayoutInputID
  }
}

export class FdGraphCanvasElementActionIntent<
  ElementID extends FdGraphElementID = FdGraphElementID,
> {
  readonly action: FdGraphCanvasElementAction
  readonly elementID: ElementID
  readonly basePresentationSnapshotID: FdGraphPresentationSnapshotID

  constructor(
    action: FdGraphCanvasElementAction,
    elementID: ElementID,
    basePresentationSnapshotID: FdGraphPresentationSnapshotID,
  ) {
    this.action = action
    this.elementID = elementID
    this.basePresentationSnapshotID = basePresentationSnapshotID
  }
}

export type FdGraphCanvasInteractionIntent<ElementID extends FdGraphElementID = FdGraphElementID> =
  | { readonly kind: 'nodeDragCompleted'; readonly intent: FdGraphCanvasNodeDragIntent<ElementID> }
  | {
      readonly kind: 'nodeResizeCompleted'
      readonly intent: FdGraphCanvasNodeResizeIntent<ElementID>
    }
  | {
      readonly kind: 'nodeArrangementRequested'
      readonly intent: FdGraphCanvasNodeArrangementIntent<ElementID>
    }
  | {
      readonly kind: 'connectionCompleted'
      readonly intent: FdGraphCanvasConnectionCompletionIntent<ElementID>
    }
  | {
      readonly kind: 'connectionCancelled'
      readonly intent: FdGraphCanvasConnectionCancellationIntent<ElementID>
    }
  | { readonly kind: 'elementAction'; readonly intent: FdGraphCanvasElementActionIntent<ElementID> }

const validateSize = (size: FdCanvasSize, name: string): void => {
  validateOffset(size, name)
  if (size.width < 0 || size.height < 0) throw new RangeError(`${name} must be nonnegative`)
}

const validateOffset = (offset: FdCanvasSize, name: string): void => {
  if (!Number.isFinite(offset.width) || !Number.isFinite(offset.height)) {
    throw new RangeError(`${name} must be finite`)
  }
}
