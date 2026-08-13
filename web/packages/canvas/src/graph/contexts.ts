import type { FdCanvasViewportAction } from '../configuration.js'
import type { FdCanvasSmartMagnifyContext } from '../events.js'
import type {
  FdCanvasPoint,
  FdCanvasRect,
  FdCanvasRenderSurface,
  FdCanvasSize,
} from '../geometry.js'
import type { FdGraphCanvasGuide } from '../interactions/arrangement.js'
import {
  type FdGraphCanvasConnectionPreview,
  FdGraphCanvasEdgeReconnectionActions,
  type FdGraphCanvasPortConnectionState,
} from '../interactions/connection-model.js'
import type {
  FdGraphCanvasElementAction,
  FdGraphCanvasSessionID,
  FdGraphCanvasSessionState,
} from '../interactions/session.js'
import type { FdGraphCanvasSelectionMode } from '../interactions/selection.js'
import type { FdGraphEdgeRoute } from '../layout/pipeline.js'
import type { FdCanvasProxy, FdCanvasRenderContext } from '../rendering-context.js'
import type {
  FdGraphCanvasAnchor,
  FdGraphCanvasContent,
  FdGraphCanvasEdgeAnchors,
} from './content.js'
import type { FdGraphCanvasResizeEdges } from './interaction-policy.js'
import { FdGraphCanvasNodeCapabilities } from './interaction-policy.js'
import type { FdGraphElementID } from './model.js'
import type { FdGraphPresentationLocalElementID } from './presentation.js'

export class FdGraphCanvasNodeResizeActions {
  readonly isEnabled: boolean
  readonly #updateAction: (
    edges: FdGraphCanvasResizeEdges,
    renderedTranslation: FdCanvasSize,
  ) => void
  readonly #endAction: () => void
  readonly #cancelAction: () => void

  constructor(options: {
    readonly isEnabled: boolean
    readonly update: (edges: FdGraphCanvasResizeEdges, renderedTranslation: FdCanvasSize) => void
    readonly end: () => void
    readonly cancel: () => void
  }) {
    this.isEnabled = options.isEnabled
    this.#updateAction = options.update
    this.#endAction = options.end
    this.#cancelAction = options.cancel
  }

  update(edges: FdGraphCanvasResizeEdges, renderedTranslation: FdCanvasSize): void {
    if (this.isEnabled) this.#updateAction(edges, renderedTranslation)
  }

  end(): void {
    if (this.isEnabled) this.#endAction()
  }

  cancel(): void {
    if (this.isEnabled) this.#cancelAction()
  }

  static get disabled(): FdGraphCanvasNodeResizeActions {
    return new FdGraphCanvasNodeResizeActions({
      isEnabled: false,
      update: () => {},
      end: () => {},
      cancel: () => {},
    })
  }
}

export class FdGraphCanvasSelectionResizeContext<
  ElementID extends FdGraphElementID = FdGraphElementID,
> {
  readonly anchorNodeID: ElementID
  readonly nodeIDs: ReadonlySet<ElementID>
  readonly frame: FdCanvasRect
  readonly renderedFrame: FdCanvasRect
  readonly renderScale: number
  readonly isResizing: boolean
  readonly actions: FdGraphCanvasNodeResizeActions

  constructor(options: {
    readonly anchorNodeID: ElementID
    readonly nodeIDs: ReadonlySet<ElementID>
    readonly frame: FdCanvasRect
    readonly renderedFrame: FdCanvasRect
    readonly renderScale: number
    readonly isResizing: boolean
    readonly actions: FdGraphCanvasNodeResizeActions
  }) {
    if (options.nodeIDs.size === 0 || !options.nodeIDs.has(options.anchorNodeID)) {
      throw new RangeError('selection resize must contain its anchor node')
    }
    this.anchorNodeID = options.anchorNodeID
    this.nodeIDs = options.nodeIDs
    this.frame = options.frame
    this.renderedFrame = options.renderedFrame
    this.renderScale = options.renderScale
    this.isResizing = options.isResizing
    this.actions = options.actions
  }
}

export class FdGraphCanvasElementActions {
  readonly #selectAction: (mode?: FdGraphCanvasSelectionMode) => void
  readonly #elementAction: (action: FdGraphCanvasElementAction) => void

  constructor(options: {
    readonly select: (mode?: FdGraphCanvasSelectionMode) => void
    readonly send: (action: FdGraphCanvasElementAction) => void
  }) {
    this.#selectAction = options.select
    this.#elementAction = options.send
  }

  select(mode?: FdGraphCanvasSelectionMode): void {
    this.#selectAction(mode)
  }

  send(action: FdGraphCanvasElementAction): void {
    this.#elementAction(action)
  }

  static get disabled(): FdGraphCanvasElementActions {
    return new FdGraphCanvasElementActions({ select: () => {}, send: () => {} })
  }
}

export class FdGraphCanvasNodeContext<ElementID extends FdGraphElementID = FdGraphElementID> {
  readonly elementID: ElementID
  readonly localID: FdGraphPresentationLocalElementID
  readonly baseFrame: FdCanvasRect
  readonly frame: FdCanvasRect
  readonly renderedFrame: FdCanvasRect
  readonly renderScale: number
  readonly isSelected: boolean
  readonly isFocused: boolean
  readonly isHovered: boolean
  readonly isBeingDragged: boolean
  readonly isBeingResized: boolean
  readonly capabilities: FdGraphCanvasNodeCapabilities
  readonly actions: FdGraphCanvasElementActions
  readonly resizeActions: FdGraphCanvasNodeResizeActions

  constructor(options: {
    readonly elementID: ElementID
    readonly localID: FdGraphPresentationLocalElementID
    readonly baseFrame: FdCanvasRect
    readonly frame: FdCanvasRect
    readonly renderedFrame: FdCanvasRect
    readonly renderScale: number
    readonly isSelected: boolean
    readonly isFocused?: boolean
    readonly isHovered: boolean
    readonly isBeingDragged: boolean
    readonly isBeingResized?: boolean
    readonly capabilities?: FdGraphCanvasNodeCapabilities
    readonly actions: FdGraphCanvasElementActions
    readonly resizeActions?: FdGraphCanvasNodeResizeActions
  }) {
    this.elementID = options.elementID
    this.localID = options.localID
    this.baseFrame = options.baseFrame
    this.frame = options.frame
    this.renderedFrame = options.renderedFrame
    this.renderScale = options.renderScale
    this.isSelected = options.isSelected
    this.isFocused = options.isFocused ?? false
    this.isHovered = options.isHovered
    this.isBeingDragged = options.isBeingDragged
    this.isBeingResized = options.isBeingResized ?? false
    this.capabilities = options.capabilities ?? FdGraphCanvasNodeCapabilities.standard
    this.actions = options.actions
    this.resizeActions = options.resizeActions ?? FdGraphCanvasNodeResizeActions.disabled
  }
}

export class FdGraphCanvasPortContext<ElementID extends FdGraphElementID = FdGraphElementID> {
  readonly elementID: ElementID
  readonly localID: FdGraphPresentationLocalElementID
  readonly nodeLocalID: FdGraphPresentationLocalElementID
  readonly anchor: FdGraphCanvasAnchor
  readonly renderedPosition: FdCanvasPoint
  readonly renderScale: number
  readonly isSelected: boolean
  readonly isHovered: boolean
  readonly connectionState: FdGraphCanvasPortConnectionState
  readonly actions: FdGraphCanvasElementActions

  constructor(options: {
    readonly elementID: ElementID
    readonly localID: FdGraphPresentationLocalElementID
    readonly nodeLocalID: FdGraphPresentationLocalElementID
    readonly anchor: FdGraphCanvasAnchor
    readonly renderedPosition: FdCanvasPoint
    readonly renderScale: number
    readonly isSelected: boolean
    readonly isHovered: boolean
    readonly connectionState?: FdGraphCanvasPortConnectionState
    readonly actions: FdGraphCanvasElementActions
  }) {
    this.elementID = options.elementID
    this.localID = options.localID
    this.nodeLocalID = options.nodeLocalID
    this.anchor = options.anchor
    this.renderedPosition = options.renderedPosition
    this.renderScale = options.renderScale
    this.isSelected = options.isSelected
    this.isHovered = options.isHovered
    this.connectionState = options.connectionState ?? { kind: 'idle' }
    this.actions = options.actions
  }
}

export class FdGraphCanvasEdgeContext<ElementID extends FdGraphElementID = FdGraphElementID> {
  readonly elementID: ElementID
  readonly localID: FdGraphPresentationLocalElementID
  readonly worldRoute: FdGraphEdgeRoute
  readonly renderedRoute: FdGraphEdgeRoute
  readonly anchors: FdGraphCanvasEdgeAnchors
  readonly worldFrame: FdCanvasRect
  readonly renderedFrame: FdCanvasRect
  readonly renderScale: number
  readonly isSelected: boolean
  readonly isHovered: boolean
  readonly isTransient: boolean
  readonly actions: FdGraphCanvasElementActions
  readonly reconnectionActions: FdGraphCanvasEdgeReconnectionActions

  constructor(options: {
    readonly elementID: ElementID
    readonly localID: FdGraphPresentationLocalElementID
    readonly worldRoute: FdGraphEdgeRoute
    readonly renderedRoute: FdGraphEdgeRoute
    readonly anchors: FdGraphCanvasEdgeAnchors
    readonly worldFrame: FdCanvasRect
    readonly renderedFrame: FdCanvasRect
    readonly renderScale: number
    readonly isSelected: boolean
    readonly isHovered: boolean
    readonly isTransient: boolean
    readonly actions: FdGraphCanvasElementActions
    readonly reconnectionActions?: FdGraphCanvasEdgeReconnectionActions
  }) {
    this.elementID = options.elementID
    this.localID = options.localID
    this.worldRoute = options.worldRoute
    this.renderedRoute = options.renderedRoute
    this.anchors = options.anchors
    this.worldFrame = options.worldFrame
    this.renderedFrame = options.renderedFrame
    this.renderScale = options.renderScale
    this.isSelected = options.isSelected
    this.isHovered = options.isHovered
    this.isTransient = options.isTransient
    this.actions = options.actions
    this.reconnectionActions =
      options.reconnectionActions ?? FdGraphCanvasEdgeReconnectionActions.disabled
  }
}

export class FdGraphCanvasWorldContext<ElementID extends FdGraphElementID = FdGraphElementID> {
  readonly content: FdGraphCanvasContent<ElementID>
  readonly session: FdGraphCanvasSessionState<ElementID>
  readonly renderContext: FdCanvasRenderContext
  readonly surface: FdCanvasRenderSurface
  readonly guides: readonly FdGraphCanvasGuide[]
  readonly selectionResize: FdGraphCanvasSelectionResizeContext<ElementID> | undefined
  readonly connectionPreview: FdGraphCanvasConnectionPreview<ElementID> | undefined

  constructor(options: {
    readonly content: FdGraphCanvasContent<ElementID>
    readonly session: FdGraphCanvasSessionState<ElementID>
    readonly renderContext: FdCanvasRenderContext
    readonly surface: FdCanvasRenderSurface
    readonly guides: readonly FdGraphCanvasGuide[]
    readonly selectionResize?: FdGraphCanvasSelectionResizeContext<ElementID>
    readonly connectionPreview?: FdGraphCanvasConnectionPreview<ElementID>
  }) {
    this.content = options.content
    this.session = options.session
    this.renderContext = options.renderContext
    this.surface = options.surface
    this.guides = options.guides
    this.selectionResize = options.selectionResize
    this.connectionPreview = options.connectionPreview
  }
}

export class FdGraphCanvasOverlayContext<ElementID extends FdGraphElementID = FdGraphElementID> {
  readonly sessionID: FdGraphCanvasSessionID
  readonly content: FdGraphCanvasContent<ElementID>
  readonly session: FdGraphCanvasSessionState<ElementID>
  readonly proxy: FdCanvasProxy

  constructor(options: {
    readonly sessionID: FdGraphCanvasSessionID
    readonly content: FdGraphCanvasContent<ElementID>
    readonly session: FdGraphCanvasSessionState<ElementID>
    readonly proxy: FdCanvasProxy
  }) {
    this.sessionID = options.sessionID
    this.content = options.content
    this.session = options.session
    this.proxy = options.proxy
  }
}

export class FdGraphCanvasSmartMagnifyContext<
  ElementID extends FdGraphElementID = FdGraphElementID,
> {
  readonly canvas: FdCanvasSmartMagnifyContext
  readonly nearestNodeID: ElementID | undefined
  readonly nearestNodeFrame: FdCanvasRect | undefined
  readonly focusedElementID: ElementID | undefined
  readonly focusedElementBounds: FdCanvasRect | undefined

  constructor(options: {
    readonly canvas: FdCanvasSmartMagnifyContext
    readonly nearestNodeID?: ElementID
    readonly nearestNodeFrame?: FdCanvasRect
    readonly focusedElementID?: ElementID
    readonly focusedElementBounds?: FdCanvasRect
  }) {
    this.canvas = options.canvas
    this.nearestNodeID = options.nearestNodeID
    this.nearestNodeFrame = options.nearestNodeFrame
    this.focusedElementID = options.focusedElementID
    this.focusedElementBounds = options.focusedElementBounds
  }

  standardAction(focusedZoom: number, fitPadding: number): FdCanvasViewportAction {
    if (this.canvas.canRestoreViewport) return { kind: 'restore' }
    if (this.canvas.isZoomedIn && this.focusedElementBounds) {
      return {
        kind: 'fit',
        rect: this.focusedElementBounds,
        padding: fitPadding,
      }
    }
    if (this.nearestNodeFrame) {
      return { kind: 'focus', rect: this.nearestNodeFrame, zoom: focusedZoom }
    }
    return { kind: 'none' }
  }
}
