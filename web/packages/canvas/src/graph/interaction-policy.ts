import type { FdCanvasRect, FdCanvasSize } from '../geometry.js'
import { FdGraphCanvasSnappingStrategy } from '../interactions/arrangement.js'
import { FdGraphCanvasConnectionPolicy } from '../interactions/connection.js'
import type { FdAnyGraphSnapshot, FdGraphElementID } from './model.js'

export type FdGraphCanvasInteractionModifier =
  | 'constrainDragAxis'
  | 'preserveResizeAspectRatio'
  | 'resizeFromCenter'
  | 'disableSnapping'
  | 'largeKeyboardNudge'
export type FdGraphCanvasInteractionModifiers = ReadonlySet<FdGraphCanvasInteractionModifier>

export class FdGraphCanvasNodeCapabilities {
  static readonly draggable = new FdGraphCanvasNodeCapabilities(1 << 0)
  static readonly arrangementParticipant = new FdGraphCanvasNodeCapabilities(1 << 1)
  static readonly keyboardNavigable = new FdGraphCanvasNodeCapabilities(1 << 2)
  static readonly resizable = new FdGraphCanvasNodeCapabilities(1 << 3)
  static readonly standard = new FdGraphCanvasNodeCapabilities(
    FdGraphCanvasNodeCapabilities.draggable.rawValue |
      FdGraphCanvasNodeCapabilities.arrangementParticipant.rawValue |
      FdGraphCanvasNodeCapabilities.keyboardNavigable.rawValue |
      FdGraphCanvasNodeCapabilities.resizable.rawValue,
  )

  readonly rawValue: number

  constructor(rawValue: number) {
    if (!Number.isSafeInteger(rawValue) || rawValue < 0 || rawValue > 0xff) {
      throw new RangeError('node capabilities raw value must be an unsigned byte')
    }
    this.rawValue = rawValue
  }

  contains(capabilities: FdGraphCanvasNodeCapabilities): boolean {
    return (this.rawValue & capabilities.rawValue) === capabilities.rawValue
  }

  union(capabilities: FdGraphCanvasNodeCapabilities): FdGraphCanvasNodeCapabilities {
    return new FdGraphCanvasNodeCapabilities(this.rawValue | capabilities.rawValue)
  }

  subtracting(capabilities: FdGraphCanvasNodeCapabilities): FdGraphCanvasNodeCapabilities {
    return new FdGraphCanvasNodeCapabilities(this.rawValue & ~capabilities.rawValue)
  }
}

export interface FdGraphCanvasNodeCapabilityMapOptions<
  ElementID extends FdGraphElementID = FdGraphElementID,
> {
  readonly defaultCapabilities?: FdGraphCanvasNodeCapabilities
  readonly overrides?: ReadonlyMap<ElementID, FdGraphCanvasNodeCapabilities>
}

export class FdGraphCanvasNodeCapabilityMap<ElementID extends FdGraphElementID = FdGraphElementID> {
  readonly defaultCapabilities: FdGraphCanvasNodeCapabilities
  readonly overrides: ReadonlyMap<ElementID, FdGraphCanvasNodeCapabilities>

  constructor(options: FdGraphCanvasNodeCapabilityMapOptions<ElementID> = {}) {
    this.defaultCapabilities = options.defaultCapabilities ?? FdGraphCanvasNodeCapabilities.standard
    this.overrides = options.overrides ?? new Map()
  }

  capabilities(nodeID: ElementID): FdGraphCanvasNodeCapabilities {
    return this.overrides.get(nodeID) ?? this.defaultCapabilities
  }
}

export interface FdGraphCanvasNodeSizeConstraintsOptions {
  readonly minimumSize?: FdCanvasSize
  readonly maximumSize?: FdCanvasSize
}

export class FdGraphCanvasNodeSizeConstraints {
  readonly minimumSize: FdCanvasSize
  readonly maximumSize: FdCanvasSize | undefined

  constructor(options: FdGraphCanvasNodeSizeConstraintsOptions = {}) {
    const minimumSize = options.minimumSize ?? { width: 0, height: 0 }
    validateSize(minimumSize, 'minimum size')
    if (options.maximumSize) {
      validateSize(options.maximumSize, 'maximum size')
      if (
        options.maximumSize.width < minimumSize.width ||
        options.maximumSize.height < minimumSize.height
      ) {
        throw new RangeError('maximum size must not be smaller than minimum size')
      }
    }
    this.minimumSize = minimumSize
    this.maximumSize = options.maximumSize
  }
}

export interface FdGraphCanvasNodeSizeConstraintMapOptions<
  ElementID extends FdGraphElementID = FdGraphElementID,
> {
  readonly defaultConstraints?: FdGraphCanvasNodeSizeConstraints
  readonly overrides?: ReadonlyMap<ElementID, FdGraphCanvasNodeSizeConstraints>
}

export class FdGraphCanvasNodeSizeConstraintMap<
  ElementID extends FdGraphElementID = FdGraphElementID,
> {
  readonly defaultConstraints: FdGraphCanvasNodeSizeConstraints | undefined
  readonly overrides: ReadonlyMap<ElementID, FdGraphCanvasNodeSizeConstraints>

  constructor(options: FdGraphCanvasNodeSizeConstraintMapOptions<ElementID> = {}) {
    this.defaultConstraints = options.defaultConstraints
    this.overrides = options.overrides ?? new Map()
  }

  constraints(
    nodeID: ElementID,
    fallbackMinimumSize: FdCanvasSize,
  ): FdGraphCanvasNodeSizeConstraints {
    return (
      this.overrides.get(nodeID) ??
      this.defaultConstraints ??
      new FdGraphCanvasNodeSizeConstraints({ minimumSize: fallbackMinimumSize })
    )
  }
}

export class FdGraphCanvasNodeDragAdmissionRequest<
  ElementID extends FdGraphElementID = FdGraphElementID,
> {
  readonly anchorNodeID: ElementID
  readonly selectedNodeIDs: readonly ElementID[]
  readonly candidateNodeIDs: readonly ElementID[]
  readonly basePresentationSnapshotID: string | number

  constructor(options: {
    readonly anchorNodeID: ElementID
    readonly selectedNodeIDs: readonly ElementID[]
    readonly candidateNodeIDs: readonly ElementID[]
    readonly basePresentationSnapshotID: string | number
  }) {
    this.anchorNodeID = options.anchorNodeID
    this.selectedNodeIDs = options.selectedNodeIDs
    this.candidateNodeIDs = options.candidateNodeIDs
    this.basePresentationSnapshotID = options.basePresentationSnapshotID
  }
}

export type FdGraphCanvasNodeDragAdmission<ElementID extends FdGraphElementID = FdGraphElementID> =
  | { readonly kind: 'deny' }
  | { readonly kind: 'allowAll' }
  | { readonly kind: 'allowOnly'; readonly nodeIDs: ReadonlySet<ElementID> }

export class FdGraphCanvasNodeResizeAdmissionRequest<
  ElementID extends FdGraphElementID = FdGraphElementID,
> extends FdGraphCanvasNodeDragAdmissionRequest<ElementID> {
  readonly baseFrames: ReadonlyMap<ElementID, FdCanvasRect>
  readonly edges: FdGraphCanvasResizeEdges

  constructor(options: {
    readonly anchorNodeID: ElementID
    readonly selectedNodeIDs: readonly ElementID[]
    readonly candidateNodeIDs: readonly ElementID[]
    readonly baseFrames: ReadonlyMap<ElementID, FdCanvasRect>
    readonly edges: FdGraphCanvasResizeEdges
    readonly basePresentationSnapshotID: string | number
  }) {
    super(options)
    validateResizeEdges(options.edges)
    if (options.candidateNodeIDs.some((nodeID) => !options.baseFrames.has(nodeID))) {
      throw new RangeError('every resize candidate must have a base frame')
    }
    this.baseFrames = options.baseFrames
    this.edges = options.edges
  }
}

export type FdGraphCanvasNodeResizeAdmission<
  ElementID extends FdGraphElementID = FdGraphElementID,
> = FdGraphCanvasNodeDragAdmission<ElementID>

export class FdGraphCanvasNodeDragResolver {
  private constructor() {}

  static request<ElementID extends FdGraphElementID>(
    anchorNodeID: ElementID,
    selection: ReadonlySet<ElementID>,
    presentation: FdAnyGraphSnapshot,
    mode: 'disabled' | 'single' | 'multiple',
    capabilities: FdGraphCanvasNodeCapabilityMap<ElementID>,
  ): FdGraphCanvasNodeDragAdmissionRequest<ElementID> | undefined {
    if (
      mode === 'disabled' ||
      !capabilities.capabilities(anchorNodeID).contains(FdGraphCanvasNodeCapabilities.draggable)
    ) {
      return undefined
    }
    const effectiveSelection = selection.has(anchorNodeID) ? selection : new Set([anchorNodeID])
    const selectedNodeIDs = presentation.nodes
      .map(({ id }) => id)
      .filter((id): id is ElementID => effectiveSelection.has(id as ElementID))
    const candidateNodeIDs =
      mode === 'single'
        ? [anchorNodeID]
        : selectedNodeIDs.filter((id) =>
            capabilities.capabilities(id).contains(FdGraphCanvasNodeCapabilities.draggable),
          )
    if (!candidateNodeIDs.includes(anchorNodeID)) return undefined
    return new FdGraphCanvasNodeDragAdmissionRequest({
      anchorNodeID,
      selectedNodeIDs,
      candidateNodeIDs,
      basePresentationSnapshotID: presentation.id,
    })
  }

  static admittedNodeIDs<ElementID extends FdGraphElementID>(
    request: FdGraphCanvasNodeDragAdmissionRequest<ElementID>,
    admission: FdGraphCanvasNodeDragAdmission<ElementID>,
  ): ReadonlySet<ElementID> {
    return admittedNodeIDs(request, admission)
  }
}

export class FdGraphCanvasNodeResizeResolver {
  private constructor() {}

  static admittedNodeIDs<ElementID extends FdGraphElementID>(
    request: FdGraphCanvasNodeResizeAdmissionRequest<ElementID>,
    admission: FdGraphCanvasNodeResizeAdmission<ElementID>,
  ): ReadonlySet<ElementID> {
    return admittedNodeIDs(request, admission)
  }
}

export interface FdGraphCanvasInteractionPolicyOptions<
  ElementID extends FdGraphElementID = FdGraphElementID,
> {
  readonly nodeCapabilities?: FdGraphCanvasNodeCapabilityMap<ElementID>
  readonly nodeSizeConstraints?: FdGraphCanvasNodeSizeConstraintMap<ElementID>
  readonly snappingStrategy?: FdGraphCanvasSnappingStrategy
  readonly connectionPolicy?: FdGraphCanvasConnectionPolicy
  readonly admitNodeDrag?: (
    request: FdGraphCanvasNodeDragAdmissionRequest<ElementID>,
  ) => FdGraphCanvasNodeDragAdmission<ElementID>
  readonly admitNodeResize?: (
    request: FdGraphCanvasNodeResizeAdmissionRequest<ElementID>,
  ) => FdGraphCanvasNodeResizeAdmission<ElementID>
  readonly isAdditiveSelectionActive?: () => boolean
  readonly interactionModifiers?: () => FdGraphCanvasInteractionModifiers
}

export class FdGraphCanvasInteractionPolicy<ElementID extends FdGraphElementID = FdGraphElementID> {
  readonly nodeCapabilities: FdGraphCanvasNodeCapabilityMap<ElementID>
  readonly nodeSizeConstraints: FdGraphCanvasNodeSizeConstraintMap<ElementID>
  readonly snappingStrategy: FdGraphCanvasSnappingStrategy
  readonly connectionPolicy: FdGraphCanvasConnectionPolicy
  readonly #nodeDragAdmission: (
    request: FdGraphCanvasNodeDragAdmissionRequest<ElementID>,
  ) => FdGraphCanvasNodeDragAdmission<ElementID>
  readonly #nodeResizeAdmission: (
    request: FdGraphCanvasNodeResizeAdmissionRequest<ElementID>,
  ) => FdGraphCanvasNodeResizeAdmission<ElementID>
  readonly #additiveSelectionState: () => boolean
  readonly #modifiers: () => FdGraphCanvasInteractionModifiers

  constructor(options: FdGraphCanvasInteractionPolicyOptions<ElementID> = {}) {
    this.nodeCapabilities = options.nodeCapabilities ?? new FdGraphCanvasNodeCapabilityMap()
    this.nodeSizeConstraints =
      options.nodeSizeConstraints ?? new FdGraphCanvasNodeSizeConstraintMap()
    this.snappingStrategy = options.snappingStrategy ?? FdGraphCanvasSnappingStrategy.standard
    this.connectionPolicy = options.connectionPolicy ?? FdGraphCanvasConnectionPolicy.standard
    this.#nodeDragAdmission = options.admitNodeDrag ?? (() => ({ kind: 'allowAll' }))
    this.#nodeResizeAdmission = options.admitNodeResize ?? (() => ({ kind: 'allowAll' }))
    this.#additiveSelectionState = options.isAdditiveSelectionActive ?? (() => false)
    this.#modifiers = options.interactionModifiers ?? (() => new Set())
  }

  admission(
    request: FdGraphCanvasNodeResizeAdmissionRequest<ElementID>,
  ): FdGraphCanvasNodeResizeAdmission<ElementID>
  admission(
    request: FdGraphCanvasNodeDragAdmissionRequest<ElementID>,
  ): FdGraphCanvasNodeDragAdmission<ElementID>
  admission(
    request:
      | FdGraphCanvasNodeDragAdmissionRequest<ElementID>
      | FdGraphCanvasNodeResizeAdmissionRequest<ElementID>,
  ): FdGraphCanvasNodeDragAdmission<ElementID> {
    return request instanceof FdGraphCanvasNodeResizeAdmissionRequest
      ? this.#nodeResizeAdmission(request)
      : this.#nodeDragAdmission(request)
  }

  get isAdditiveSelectionActive(): boolean {
    return this.#additiveSelectionState()
  }

  get interactionModifiers(): FdGraphCanvasInteractionModifiers {
    return this.#modifiers()
  }

  static get standard(): FdGraphCanvasInteractionPolicy {
    return new FdGraphCanvasInteractionPolicy()
  }
}

export type FdGraphCanvasResizeEdge = 'leading' | 'trailing' | 'top' | 'bottom'
export type FdGraphCanvasResizeEdges = ReadonlySet<FdGraphCanvasResizeEdge>

const admittedNodeIDs = <ElementID extends FdGraphElementID>(
  request: FdGraphCanvasNodeDragAdmissionRequest<ElementID>,
  admission: FdGraphCanvasNodeDragAdmission<ElementID>,
): ReadonlySet<ElementID> => {
  if (admission.kind === 'deny') return new Set()
  const candidates = new Set(request.candidateNodeIDs)
  const admitted =
    admission.kind === 'allowAll'
      ? candidates
      : new Set([...candidates].filter((nodeID) => admission.nodeIDs.has(nodeID)))
  return admitted.has(request.anchorNodeID) ? admitted : new Set()
}

const validateSize = (size: FdCanvasSize, name: string): void => {
  if (
    !Number.isFinite(size.width) ||
    !Number.isFinite(size.height) ||
    size.width < 0 ||
    size.height < 0
  ) {
    throw new RangeError(`${name} must be finite and nonnegative`)
  }
}

const validateResizeEdges = (edges: FdGraphCanvasResizeEdges): void => {
  if (
    edges.size === 0 ||
    (edges.has('leading') && edges.has('trailing')) ||
    (edges.has('top') && edges.has('bottom'))
  ) {
    throw new RangeError('resize edges must be valid')
  }
}
