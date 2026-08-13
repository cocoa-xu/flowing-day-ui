import type { FdGraphCanvasAccessibilitySnapshot } from '../accessibility/snapshot.js'
import type {
  FdCanvasContentChangeBehavior,
  FdCanvasViewportAction,
  FdCanvasViewportChangePhase,
} from '../configuration.js'
import type { FdCanvasInsets, FdCanvasPoint, FdCanvasRect, FdCanvasViewport } from '../geometry.js'
import type { FdGraphCanvasConfiguration } from '../graph/configuration.js'
import type { FdGraphCanvasContent } from '../graph/content.js'
import type { FdGraphCanvasSmartMagnifyContext } from '../graph/contexts.js'
import type {
  FdGraphCanvasInteractionPolicy,
  FdGraphCanvasNodeCapabilities,
} from '../graph/interaction-policy.js'
import type {
  FdAnyGraphEdge,
  FdAnyGraphNode,
  FdGraphElementID,
  FdGraphElementReference,
  FdGraphSnapshotPort,
} from '../graph/model.js'
import type {
  FdGraphCanvasInteractionIntent,
  FdGraphCanvasSessionCommand,
  FdGraphCanvasSessionID,
  FdGraphCanvasSessionState,
} from '../interactions/session.js'
import type { FdGraphEdgeGeometry } from './edge-geometry.js'

export type FdGraphCanvasRenderingBackendPreference = 'automatic' | 'webgl2' | 'dom'
export type FdGraphCanvasResolvedRenderingBackend = 'webgl2' | 'dom' | (string & {})

export interface FdGraphCanvasRenderingBackendCapabilities {
  readonly webgl2: boolean
}

export interface FdGraphRenderNode {
  readonly node: FdAnyGraphNode
  readonly frame: FdCanvasRect
  readonly selected: boolean
  readonly focused: boolean
  readonly hovered: boolean
  readonly capabilities?: FdGraphCanvasNodeCapabilities
}

export interface FdGraphRenderEdge {
  readonly edge: FdAnyGraphEdge
  readonly source: FdCanvasPoint
  readonly target: FdCanvasPoint
  readonly geometry: FdGraphEdgeGeometry
  readonly selected: boolean
  readonly focused: boolean
  readonly hovered: boolean
}

export interface FdGraphRenderPort {
  readonly node: FdAnyGraphNode
  readonly port: FdGraphSnapshotPort
  readonly position: FdCanvasPoint
  readonly selected: boolean
  readonly focused: boolean
  readonly hovered: boolean
}

export interface FdGraphRenderFrame {
  readonly snapshotID: string | number
  readonly snapshotRevision: number
  readonly geometryRevision: number
  readonly presentationRevision: number
  readonly viewport: FdCanvasViewport
  readonly renderWorldRect: FdCanvasRect
  readonly nodes: readonly FdGraphRenderNode[]
  readonly edges: readonly FdGraphRenderEdge[]
  readonly selectedElements: readonly FdGraphElementReference[]
  readonly selectedNodeIDs: ReadonlySet<FdGraphElementID>
  readonly selectedEdgeIDs: ReadonlySet<FdGraphElementID>
  readonly selectedPortIDsByNode: ReadonlyMap<FdGraphElementID, ReadonlySet<FdGraphElementID>>
  readonly focusedElement?: FdGraphElementReference
  readonly focusedNodeID?: FdGraphElementID
  readonly hoveredNodeID?: FdGraphElementID
  readonly pixelRatio: number
}

export interface FdGraphRenderingSurface {
  readonly viewport: HTMLElement
  readonly world: HTMLElement
}

export interface FdGraphRenderingBackend {
  readonly kind: FdGraphCanvasResolvedRenderingBackend
  mount(surface: FdGraphRenderingSurface): void
  render(frame: FdGraphRenderFrame): void
  unmount(): void
}

export class FdGraphCanvasBackendContext<ElementID extends FdGraphElementID = FdGraphElementID> {
  readonly content: FdGraphCanvasContent<ElementID>
  readonly sessionID: FdGraphCanvasSessionID
  readonly session: FdGraphCanvasSessionState<ElementID>
  readonly configuration: FdGraphCanvasConfiguration
  readonly interactionPolicy: FdGraphCanvasInteractionPolicy<ElementID>
  readonly accessibilitySnapshot: FdGraphCanvasAccessibilitySnapshot | undefined
  readonly contentInsets: FdCanvasInsets
  readonly contentChangeBehavior: FdCanvasContentChangeBehavior
  readonly command: FdGraphCanvasSessionCommand<ElementID> | undefined
  readonly #smartMagnifyAction: (
    context: FdGraphCanvasSmartMagnifyContext<ElementID>,
  ) => FdCanvasViewportAction
  readonly #viewportChangeAction: (
    viewport: FdCanvasViewport,
    phase: FdCanvasViewportChangePhase,
  ) => void
  readonly #intentAction: (intent: FdGraphCanvasInteractionIntent<ElementID>) => void

  constructor(options: {
    readonly content: FdGraphCanvasContent<ElementID>
    readonly sessionID: FdGraphCanvasSessionID
    readonly session: FdGraphCanvasSessionState<ElementID>
    readonly configuration: FdGraphCanvasConfiguration
    readonly interactionPolicy: FdGraphCanvasInteractionPolicy<ElementID>
    readonly accessibilitySnapshot?: FdGraphCanvasAccessibilitySnapshot
    readonly contentInsets: FdCanvasInsets
    readonly contentChangeBehavior: FdCanvasContentChangeBehavior
    readonly command?: FdGraphCanvasSessionCommand<ElementID>
    readonly onSmartMagnify: (
      context: FdGraphCanvasSmartMagnifyContext<ElementID>,
    ) => FdCanvasViewportAction
    readonly onViewportChange: (
      viewport: FdCanvasViewport,
      phase: FdCanvasViewportChangePhase,
    ) => void
    readonly onIntent: (intent: FdGraphCanvasInteractionIntent<ElementID>) => void
  }) {
    this.content = options.content
    this.sessionID = options.sessionID
    this.session = options.session
    this.configuration = options.configuration
    this.interactionPolicy = options.interactionPolicy
    this.accessibilitySnapshot = options.accessibilitySnapshot
    this.contentInsets = options.contentInsets
    this.contentChangeBehavior = options.contentChangeBehavior
    this.command = options.command
    this.#smartMagnifyAction = options.onSmartMagnify
    this.#viewportChangeAction = options.onViewportChange
    this.#intentAction = options.onIntent
  }

  smartMagnify(context: FdGraphCanvasSmartMagnifyContext<ElementID>): FdCanvasViewportAction {
    return this.#smartMagnifyAction(context)
  }

  viewportDidChange(viewport: FdCanvasViewport, phase: FdCanvasViewportChangePhase): void {
    this.#viewportChangeAction(viewport, phase)
  }

  send(intent: FdGraphCanvasInteractionIntent<ElementID>): void {
    this.#intentAction(intent)
  }
}

export class FdGraphCanvasWebGL2VisualAdapter<
  ElementID extends FdGraphElementID = FdGraphElementID,
> {
  readonly #availability: () => boolean
  readonly #makeBackend: (
    context: FdGraphCanvasBackendContext<ElementID>,
  ) => FdGraphRenderingBackend

  constructor(options: {
    readonly isAvailable?: () => boolean
    readonly content: (context: FdGraphCanvasBackendContext<ElementID>) => FdGraphRenderingBackend
  }) {
    this.#availability =
      options.isAvailable ?? (() => graphCanvasRenderingBackendCapabilities().webgl2)
    this.#makeBackend = options.content
  }

  get isAvailable(): boolean {
    return this.#availability()
  }

  call(context: FdGraphCanvasBackendContext<ElementID>): FdGraphRenderingBackend {
    return this.#makeBackend(context)
  }
}

export function detectGraphCanvasRenderingBackendCapabilities(): FdGraphCanvasRenderingBackendCapabilities {
  return { webgl2: typeof WebGL2RenderingContext !== 'undefined' }
}

let cachedGraphRenderingBackendCapabilities: FdGraphCanvasRenderingBackendCapabilities | undefined

export function graphCanvasRenderingBackendCapabilities(): FdGraphCanvasRenderingBackendCapabilities {
  cachedGraphRenderingBackendCapabilities ??= detectGraphCanvasRenderingBackendCapabilities()
  return cachedGraphRenderingBackendCapabilities
}

export function resolveGraphCanvasRenderingBackend(
  preference: FdGraphCanvasRenderingBackendPreference,
  capabilities: FdGraphCanvasRenderingBackendCapabilities,
): 'webgl2' | 'dom' {
  switch (preference) {
    case 'automatic':
    case 'webgl2':
      return capabilities.webgl2 ? 'webgl2' : 'dom'
    case 'dom':
      return 'dom'
  }
}
