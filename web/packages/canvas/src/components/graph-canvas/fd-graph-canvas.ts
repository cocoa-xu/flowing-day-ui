import { type CSSResultGroup, css, html, LitElement, nothing, type PropertyValues } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import {
  type FdGraphAccessibilityCommand,
  type FdGraphCanvasAccessibilityConfiguration,
  type FdResolvedGraphCanvasAccessibilityConfiguration,
  resolveGraphCanvasAccessibilityConfiguration,
} from '../../accessibility/configuration.js'
import type { FdGraphAccessibilityActionDetail } from '../../accessibility/events.js'
import {
  createGraphAccessibilitySnapshot,
  FdGraphAccessibilitySnapshot,
  graphNodeAccessibilityKey,
} from '../../accessibility/snapshot.js'
import type {
  FdCanvasConfiguration,
  FdCanvasContentChangeBehavior,
  FdCanvasRequest,
} from '../../configuration.js'
import type { FdCanvasViewportChangeDetail } from '../../events.js'
import {
  canvasRectContains,
  type FdCanvasInsets,
  type FdCanvasPoint,
  type FdCanvasRect,
  FdCanvasTransform,
  FdCanvasViewport,
  zeroCanvasInsets,
} from '../../geometry.js'
import type {
  FdGraphConnectionCancelDetail,
  FdGraphConnectionCompleteDetail,
  FdGraphConnectionPreviewChangeDetail,
  FdGraphFocusChangeDetail,
  FdGraphNodeActivateDetail,
  FdGraphNodeFrameChange,
  FdGraphNodeFrameChangeKind,
  FdGraphNodeFramesChangeDetail,
  FdGraphSelectionChangeDetail,
} from '../../graph/events.js'
import type { FdGraphMiniMapNavigationDetail } from '../../graph/minimap-events.js'
import type {
  FdAnyGraphEdge,
  FdAnyGraphNode,
  FdAnyGraphSnapshot,
  FdGraphElementID,
} from '../../graph/model.js'
import { graphElementIDFromKey, graphElementKey, graphPortPoint } from '../../graph/model.js'
import { FdGraphSnapshotIndex } from '../../graph/snapshot-index.js'
import { FdGraphHistoryDriver } from '../../history/driver.js'
import type {
  FdGraphCanvasHistoryConflictDetail,
  FdGraphCanvasHistoryFailure,
  FdGraphCanvasHistoryStateDetail,
} from '../../history/events.js'
import {
  type FdGraphCanvasHistoryChange,
  type FdGraphCanvasHistoryConfiguration,
  type FdResolvedGraphCanvasHistoryConfiguration,
  resolveGraphCanvasHistoryConfiguration,
} from '../../history/graph-canvas.js'
import type { FdGraphHistoryApplyResult, FdGraphHistoryDirection } from '../../history/model.js'
import {
  type FdGraphArrangementAction,
  type FdGraphGuide,
  graphArrangementTranslations,
  graphSelectionBounds,
} from '../../interactions/arrangement.js'
import type {
  FdGraphCanvasInteractionConfiguration,
  FdGraphCanvasTool,
  FdResolvedGraphCanvasInteractionConfiguration,
} from '../../interactions/configuration.js'
import { resolveGraphCanvasInteractionConfiguration } from '../../interactions/configuration.js'
import {
  type FdGraphConnectionEditingConfiguration,
  type FdGraphConnectionOrigin,
  type FdGraphConnectionResolution,
  type FdGraphTransientConnection,
  type FdResolvedGraphConnectionEditingConfiguration,
  resolveGraphConnectionEditingConfiguration,
} from '../../interactions/connection.js'
import {
  type FdGraphCanvasKeyboardConfiguration,
  type FdGraphKeyboardCommand,
  type FdGraphKeyboardNavigationCandidate,
  type FdGraphNavigationDirection,
  type FdResolvedGraphCanvasKeyboardConfiguration,
  graphKeyboardTranslation,
  nextGraphKeyboardNodeID,
  resolveGraphCanvasKeyboardConfiguration,
} from '../../interactions/keyboard.js'
import type { FdGraphJumpToElementOptions } from '../../interactions/navigation.js'
import type { FdGraphMiniMapConfiguration } from '../../minimap/configuration.js'
import type {
  FdGraphRenderFrame,
  FdGraphRenderingBackend,
  FdGraphRenderingBackendPreference,
} from '../../rendering/backend.js'
import {
  graphRenderingCapabilities,
  resolveGraphRenderingBackendKind,
} from '../../rendering/backend.js'
import { FdGraphDOMRenderingBackend } from '../../rendering/dom-backend.js'
import { FdGraphRenderGeometryCache } from '../../rendering/frame-cache.js'
import { FdGraphWebGL2RenderingBackend } from '../../rendering/webgl2-backend.js'
import type { FdCanvas, FdCanvasTransformOptions } from '../canvas/fd-canvas.js'
import '../canvas/fd-canvas.js'
import type { FdGraphMiniMap } from '../graph-minimap/fd-graph-minimap.js'
import '../graph-minimap/fd-graph-minimap.js'
import { FdGraphCanvasAccessibilityBridge } from './accessibility-bridge.js'
import {
  FdGraphCanvasConnectionController,
  type FdGraphCanvasConnectionDelegate,
} from './connection-controller.js'
import {
  FdGraphCanvasInteractionController,
  type FdGraphCanvasInteractionDelegate,
  type FdGraphInteractionPresentation,
} from './interaction-controller.js'

const emptySnapshot: FdAnyGraphSnapshot = { id: 'empty', nodes: [], edges: [] }

@customElement('fd-graph-canvas')
export class FdGraphCanvas
  extends LitElement
  implements FdGraphCanvasInteractionDelegate, FdGraphCanvasConnectionDelegate
{
  static override styles: CSSResultGroup = css`
    :host {
      display: block;
      position: relative;
      overflow: hidden;
      min-width: 0;
      min-height: 0;
      contain: layout paint style;
      color: inherit;
      font: inherit;
      user-select: none;
    }

    :host([hidden]) {
      display: none !important;
    }

    fd-canvas {
      width: 100%;
      height: 100%;
    }

    .render-viewport,
    .render-world,
    .interaction-world,
    .graph-node-layer,
    .graph-edge-layer {
      position: absolute;
      top: 0;
      left: 0;
    }

    .graph-gpu-layer {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .render-viewport {
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .render-world,
    .interaction-world,
    .graph-node-layer,
    .graph-edge-layer {
      width: 1px;
      height: 1px;
      overflow: visible;
    }

    .graph-edge-layer {
      fill: none;
      pointer-events: none;
    }

    .graph-edge {
      fill: none;
      stroke: var(--fd-graph-edge-color, var(--fd-canvas-edge-color, #aeb5af));
      stroke-linecap: round;
      stroke-width: var(--fd-graph-edge-width, 2);
      vector-effect: non-scaling-stroke;
    }

    .graph-edge[data-dashed] {
      stroke-dasharray: 7 6;
    }

    .graph-edge[data-focused] {
      stroke: var(--fd-graph-focus-color, var(--fd-canvas-focus-color, Highlight));
    }

    .graph-edge-label {
      fill: var(--fd-canvas-secondary-color, #737872);
      font: 500 11px system-ui, sans-serif;
      paint-order: stroke;
      stroke: var(--fd-canvas-surface-color, #fff);
      stroke-width: 4px;
      text-anchor: middle;
    }

    .graph-node {
      position: absolute;
      display: flex;
      overflow: visible;
      align-items: center;
      box-sizing: border-box;
      min-width: 0;
      padding: var(--fd-graph-node-padding, 16px);
      border: 1px solid
        var(--fd-graph-node-stroke, var(--fd-canvas-node-border-color, #d7dcd8));
      border-radius: var(--fd-graph-node-radius, 16px);
      background: var(--fd-graph-node-fill, var(--fd-canvas-node-surface-color, #fff));
      box-shadow: var(--fd-canvas-node-shadow, 0 12px 30px rgb(35 43 38 / 0.09));
      color: var(--fd-graph-node-color, var(--fd-canvas-node-color, #252825));
      cursor: default;
      transform-origin: 0 0;
    }

    .graph-node[data-draggable] {
      cursor: grab;
    }

    .graph-node[data-selected] {
      border-color: var(--fd-graph-node-accent, var(--fd-canvas-accent-color, #6d9ea5));
      box-shadow:
        0 0 0 2px
        color-mix(
          in srgb,
          var(--fd-graph-node-accent, var(--fd-canvas-accent-color, #6d9ea5)) 24%,
          transparent
        ),
        var(--fd-canvas-node-shadow, 0 12px 30px rgb(35 43 38 / 0.09));
    }

    .graph-node[data-focused] {
      outline: 2px solid var(--fd-graph-focus-color, var(--fd-canvas-focus-color, Highlight));
      outline-offset: 3px;
    }

    .graph-node-content {
      display: grid;
      min-width: 0;
      gap: 4px;
      pointer-events: none;
    }

    .graph-node-label,
    .graph-node-subtitle {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .graph-node-label {
      font-size: 14px;
      font-weight: 650;
      letter-spacing: -0.01em;
    }

    .graph-node-subtitle {
      color: var(--fd-canvas-secondary-color, #737872);
      font-size: 11px;
      font-weight: 450;
    }

    .graph-port {
      position: absolute;
      width: var(--fd-graph-port-size, 10px);
      height: var(--fd-graph-port-size, 10px);
      box-sizing: border-box;
      border: 2px solid var(--fd-canvas-node-surface-color, #fff);
      border-radius: 50%;
      background: var(--fd-graph-node-accent, var(--fd-canvas-accent-color, #6d9ea5));
      box-shadow: 0 0 0 1px var(--fd-canvas-node-border-color, #d7dcd8);
      pointer-events: auto;
    }

    .graph-port::before {
      position: absolute;
      inset: calc(-1 * var(--fd-graph-port-hit-padding, 0px));
      border-radius: 50%;
      content: '';
    }

    .graph-port[data-connection-state='source'] {
      box-shadow:
        0 0 0 1px var(--fd-canvas-node-border-color, #d7dcd8),
        0 0 0 4px color-mix(in srgb, var(--fd-canvas-accent-color, #6d9ea5) 22%, transparent);
    }

    .graph-port[data-connection-state='valid'] {
      box-shadow:
        0 0 0 1px var(--fd-canvas-node-border-color, #d7dcd8),
        0 0 0 5px color-mix(in srgb, var(--fd-canvas-accent-color, #6d9ea5) 30%, transparent);
    }

    .graph-port[data-connection-state='invalid'] {
      background: var(--fd-graph-connection-invalid-color, #d95c5c);
      box-shadow:
        0 0 0 1px var(--fd-canvas-node-border-color, #d7dcd8),
        0 0 0 5px color-mix(in srgb, var(--fd-graph-connection-invalid-color, #d95c5c) 28%, transparent);
    }

    .graph-port[data-side='top'] {
      top: 0;
      left: var(--fd-graph-port-offset);
      transform: translate(-50%, -50%);
    }

    .graph-port[data-side='bottom'] {
      bottom: 0;
      left: var(--fd-graph-port-offset);
      transform: translate(-50%, 50%);
    }

    .graph-port[data-side='left'] {
      top: var(--fd-graph-port-offset);
      left: 0;
      transform: translate(-50%, -50%);
    }

    .graph-port[data-side='right'] {
      top: var(--fd-graph-port-offset);
      right: 0;
      transform: translate(50%, -50%);
    }

    .interaction-world {
      --fd-graph-world-pixel: 1px;
      --fd-graph-handle-world-size: 9px;
      z-index: 3;
      pointer-events: none;
    }

    .selection-bounds,
    .selection-marquee,
    .alignment-guide,
    .connection-feedback {
      position: absolute;
      box-sizing: border-box;
    }

    .connection-preview-layer {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: visible;
      fill: none;
      pointer-events: none;
    }

    .connection-preview {
      fill: none;
      stroke: var(--fd-graph-connection-color, var(--fd-canvas-accent-color, #6d9ea5));
      stroke-linecap: round;
      stroke-width: var(--fd-graph-connection-width, 2.5);
      vector-effect: non-scaling-stroke;
    }

    .connection-preview[data-validation='invalid'] {
      stroke: var(--fd-graph-connection-invalid-color, #d95c5c);
      stroke-dasharray: 6 5;
    }

    .connection-feedback {
      max-width: 220px;
      padding: 5px 8px;
      border: var(--fd-graph-world-pixel) solid
        color-mix(in srgb, var(--fd-graph-connection-invalid-color, #d95c5c) 32%, transparent);
      border-radius: 8px;
      background: var(--fd-canvas-node-surface-color, #fff);
      box-shadow: var(--fd-canvas-node-shadow, 0 8px 20px rgb(35 43 38 / 0.09));
      color: var(--fd-graph-connection-invalid-color, #b83f48);
      font-size: 11px;
      font-weight: 550;
      line-height: 1.25;
      pointer-events: none;
      white-space: normal;
    }

    .connection-preview[hidden],
    .connection-feedback[hidden] {
      display: none;
    }

    .selection-bounds {
      border: var(--fd-graph-world-pixel) solid
        var(--fd-graph-selection-color, var(--fd-canvas-accent-color, #6d9ea5));
    }

    .selection-bounds[hidden],
    .selection-marquee[hidden] {
      display: none;
    }

    .resize-handle {
      position: absolute;
      width: var(--fd-graph-handle-world-size);
      height: var(--fd-graph-handle-world-size);
      border: var(--fd-graph-world-pixel) solid
        var(--fd-graph-selection-color, var(--fd-canvas-accent-color, #6d9ea5));
      border-radius: 50%;
      background: var(--fd-canvas-surface-color, #fff);
      pointer-events: auto;
    }

    .resize-handle[data-fd-resize-handle='top'] {
      top: 0;
      left: 50%;
      cursor: ns-resize;
      transform: translate(-50%, -50%);
    }

    .resize-handle[data-fd-resize-handle='topRight'] {
      top: 0;
      right: 0;
      cursor: nesw-resize;
      transform: translate(50%, -50%);
    }

    .resize-handle[data-fd-resize-handle='right'] {
      top: 50%;
      right: 0;
      cursor: ew-resize;
      transform: translate(50%, -50%);
    }

    .resize-handle[data-fd-resize-handle='bottomRight'] {
      right: 0;
      bottom: 0;
      cursor: nwse-resize;
      transform: translate(50%, 50%);
    }

    .resize-handle[data-fd-resize-handle='bottom'] {
      bottom: 0;
      left: 50%;
      cursor: ns-resize;
      transform: translate(-50%, 50%);
    }

    .resize-handle[data-fd-resize-handle='bottomLeft'] {
      bottom: 0;
      left: 0;
      cursor: nesw-resize;
      transform: translate(-50%, 50%);
    }

    .resize-handle[data-fd-resize-handle='left'] {
      top: 50%;
      left: 0;
      cursor: ew-resize;
      transform: translate(-50%, -50%);
    }

    .resize-handle[data-fd-resize-handle='topLeft'] {
      top: 0;
      left: 0;
      cursor: nwse-resize;
      transform: translate(-50%, -50%);
    }

    .selection-marquee {
      border: var(--fd-graph-world-pixel) solid
        var(--fd-graph-selection-color, var(--fd-canvas-accent-color, #6d9ea5));
      background: color-mix(
        in srgb,
        var(--fd-graph-selection-color, var(--fd-canvas-accent-color, #6d9ea5)) 12%,
        transparent
      );
    }

    .alignment-guide {
      background: var(--fd-graph-guide-color, var(--fd-canvas-accent-color, #6d9ea5));
    }

    .alignment-guide[data-axis='vertical'] {
      width: var(--fd-graph-world-pixel);
    }

    .alignment-guide[data-axis='horizontal'] {
      height: var(--fd-graph-world-pixel);
    }

    .consumer-background,
    .consumer-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .consumer-overlay ::slotted(*) {
      pointer-events: auto;
    }

    .accessibility-surface {
      position: absolute;
      z-index: 4;
      inset: 0;
      pointer-events: none;
    }

    .accessibility-surface:focus-visible {
      outline: 2px solid var(--fd-graph-focus-color, var(--fd-canvas-focus-color, Highlight));
      outline-offset: -2px;
    }

    .accessibility-items {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `

  @property({ attribute: false }) snapshot: FdAnyGraphSnapshot = emptySnapshot
  @property({ attribute: false }) configuration: Partial<FdCanvasConfiguration> = {}
  @property({ attribute: false }) contentInsets: FdCanvasInsets = zeroCanvasInsets
  @property({ attribute: false }) contentChangeBehavior: FdCanvasContentChangeBehavior = {
    kind: 'fit',
    padding: 64,
    maximumZoom: 1,
  }
  @property({ attribute: false }) request: FdCanvasRequest | undefined
  @property({ attribute: false }) renderingBackend:
    | FdGraphRenderingBackendPreference
    | FdGraphRenderingBackend = 'automatic'
  @property({ reflect: true }) tool: FdGraphCanvasTool = 'select'
  @property({ attribute: false }) interactionConfiguration: FdGraphCanvasInteractionConfiguration =
    {}
  @property({ attribute: false }) keyboardConfiguration: FdGraphCanvasKeyboardConfiguration = {}
  @property({ attribute: false })
  accessibilityConfiguration: FdGraphCanvasAccessibilityConfiguration = {}
  @property({ attribute: false }) historyConfiguration: FdGraphCanvasHistoryConfiguration = {}
  @property({ attribute: false })
  connectionEditingConfiguration: FdGraphConnectionEditingConfiguration = {}
  @property({ attribute: false }) miniMapConfiguration: FdGraphMiniMapConfiguration | undefined
  @property({ attribute: false })
  get selectedNodeIDs(): ReadonlySet<FdGraphElementID> {
    return this.selectionValue
  }

  set selectedNodeIDs(value: ReadonlySet<FdGraphElementID>) {
    const previous = this.selectionValue
    this.selectionValue = new Set(value)
    this.requestUpdate('selectedNodeIDs', previous)
  }

  @property({ attribute: false })
  get focusedNodeID(): FdGraphElementID | undefined {
    return this.focusedNodeValue
  }

  set focusedNodeID(value: FdGraphElementID | undefined) {
    const previous = this.focusedNodeValue
    if (previous === value) return
    this.focusedNodeValue = value
    if (value !== undefined) {
      const key = graphNodeAccessibilityKey(value)
      if (this.accessibilitySnapshot.contains(key)) this.accessibilityFocusedElementKey = key
    }
    this.requestUpdate('focusedNodeID', previous)
  }

  @query('fd-canvas') private canvas!: FdCanvas
  @query('.render-viewport') private renderViewport!: HTMLElement
  @query('.render-world') private renderWorld!: HTMLElement
  @query('.interaction-world') private interactionWorld!: HTMLElement
  @query('.selection-bounds') private selectionBoundsElement!: HTMLElement
  @query('.selection-marquee') private marqueeElement!: HTMLElement
  @query('.guide-layer') private guideLayer!: HTMLElement
  @query('.connection-preview') private connectionPreviewElement!: SVGPathElement
  @query('.connection-feedback') private connectionFeedbackElement!: HTMLElement
  @query('.accessibility-surface') private accessibilitySurface!: HTMLElement
  @query('.accessibility-items') private accessibilityItems!: HTMLElement
  @query('fd-graph-minimap') private miniMap: FdGraphMiniMap | undefined

  private index = new FdGraphSnapshotIndex(emptySnapshot)
  private backend: FdGraphRenderingBackend | undefined
  private readonly renderGeometryCache = new FdGraphRenderGeometryCache()
  private visibleNodes: readonly FdAnyGraphNode[] = []
  private visibleEdges: readonly FdAnyGraphEdge[] = []
  private canvasContentRect: FdCanvasRect = { x: 0, y: 0, width: 1, height: 1 }
  private renderWorldRect: FdCanvasRect = { x: 0, y: 0, width: 1, height: 1 }
  private snapshotRevision = 0
  private presentationRevision = 0
  private renderFrameRequest: number | undefined
  private interactionController: FdGraphCanvasInteractionController | undefined
  private connectionController: FdGraphCanvasConnectionController | undefined
  private interactionPresentation: FdGraphInteractionPresentation = {
    frames: new Map(),
    guides: [],
  }
  private resolvedInteractionConfiguration = resolveGraphCanvasInteractionConfiguration({})
  private resolvedKeyboardConfiguration: FdResolvedGraphCanvasKeyboardConfiguration =
    resolveGraphCanvasKeyboardConfiguration()
  private resolvedAccessibilityConfiguration: FdResolvedGraphCanvasAccessibilityConfiguration =
    resolveGraphCanvasAccessibilityConfiguration()
  private resolvedHistoryConfiguration: FdResolvedGraphCanvasHistoryConfiguration =
    resolveGraphCanvasHistoryConfiguration()
  private connectionConfiguration = resolveGraphConnectionEditingConfiguration()
  private historyDriver = this.createHistoryDriver()
  private accessibilitySnapshot = new FdGraphAccessibilitySnapshot([])
  private accessibilityBridge: FdGraphCanvasAccessibilityBridge | undefined
  private accessibilityFocusedElementKey: string | undefined
  private keyboardCandidates: FdGraphKeyboardNavigationCandidate[] = []
  private readonly keyboardCandidateIndices = new Map<FdGraphElementID, number>()
  private selectionValue: ReadonlySet<FdGraphElementID> = new Set()
  private focusedNodeValue: FdGraphElementID | undefined
  private resizeHandlesVisible = false
  private localSnapshotSequence = 0
  private localSnapshotBaseID: string | number | undefined
  private miniMapViewport = new FdCanvasViewport(
    FdCanvasTransform.identity,
    { width: 1, height: 1 },
    { x: 0, y: 0, width: 1, height: 1 },
  )
  private activeBackendSource:
    | FdGraphRenderingBackendPreference
    | FdGraphRenderingBackend
    | undefined
  private indexedSnapshot: FdAnyGraphSnapshot | undefined
  private keyboardTransactionSequence = 0
  private arrangementTransactionSequence = 0
  private historyTransactionSequence = 0
  private readonly connectionPortElements = new Set<HTMLElement>()

  get viewport(): FdCanvasViewport {
    return this.canvas.viewport
  }

  get graphIndex(): FdGraphSnapshotIndex {
    return this.index
  }

  get snapshotID(): string | number {
    return this.snapshot.id
  }

  get resolvedConnectionConfiguration(): FdResolvedGraphConnectionEditingConfiguration {
    return this.connectionConfiguration
  }

  get resolvedConfiguration(): FdResolvedGraphCanvasInteractionConfiguration {
    return this.resolvedInteractionConfiguration
  }

  get resolvedRenderingBackend(): FdGraphRenderingBackend | undefined {
    return this.backend
  }

  get canUndo(): boolean {
    return this.historyDriver.canUndo
  }

  get canRedo(): boolean {
    return this.historyDriver.canRedo
  }

  get undoActionName(): string | undefined {
    return this.historyDriver.undoActionName
  }

  get redoActionName(): string | undefined {
    return this.historyDriver.redoActionName
  }

  undo(): Promise<boolean> {
    return this.historyDriver.undo()
  }

  redo(): Promise<boolean> {
    return this.historyDriver.redo()
  }

  clearHistory(): void {
    this.historyDriver.clear()
  }

  override render() {
    return html`
      <fd-canvas
        exportparts="viewport:canvas-viewport"
        interaction-mode=${this.tool === 'pan' ? 'pan' : 'content'}
        .configuration=${this.configuration}
        .contentRect=${this.canvasContentRect}
        .contentInsets=${this.contentInsets}
        .contentChangeBehavior=${this.contentChangeBehavior}
        .request=${this.request}
        .viewportTabIndex=${this.resolvedAccessibilityConfiguration.enabled ? -1 : 0}
        @fd-render-world-rect-change=${this.handleRenderWorldRectChange}
        @fd-viewport-change=${this.handleViewportChange}
        @focusin=${this.handleKeyboardFocusIn}
        @keydown=${this.handleKeyDown}
      >
        <div class="consumer-background" slot="background"><slot name="background"></slot></div>
        <div class="render-viewport" slot="background"></div>
        <div class="render-world" slot="world"></div>
        <div class="interaction-world" slot="world">
          <svg class="connection-preview-layer" aria-hidden="true">
            <path class="connection-preview" hidden></path>
          </svg>
          <span class="connection-feedback" hidden></span>
          <div class="guide-layer"></div>
          <div class="selection-marquee" hidden></div>
          <div class="selection-bounds" hidden>
            ${[
              'top',
              'topRight',
              'right',
              'bottomRight',
              'bottom',
              'bottomLeft',
              'left',
              'topLeft',
            ].map(
              (handle) => html`<span class="resize-handle" data-fd-resize-handle=${handle}></span>`,
            )}
          </div>
        </div>
        <div class="consumer-overlay" slot="overlay"><slot name="overlay"></slot></div>
        ${
          this.miniMapConfiguration
            ? html`
              <fd-graph-minimap
                slot="overlay"
                .snapshot=${this.snapshot}
                .snapshotIndex=${this.index}
                .viewport=${this.miniMapViewport}
                .configuration=${this.miniMapConfiguration}
                @fd-graph-minimap-navigation=${this.handleMiniMapNavigation}
              ></fd-graph-minimap>
            `
            : nothing
        }
      </fd-canvas>
      <div
        class="accessibility-surface"
        role="grid"
        @focusin=${this.handleAccessibilityFocusIn}
        @keydown=${this.handleAccessibilityKeyDown}
      >
        <div class="accessibility-items" role="rowgroup"></div>
      </div>
    `
  }

  override firstUpdated(): void {
    this.interactionController = new FdGraphCanvasInteractionController(this)
    this.connectionController = new FdGraphCanvasConnectionController(this)
    this.accessibilityBridge = new FdGraphCanvasAccessibilityBridge(
      this.accessibilitySurface,
      this.accessibilityItems,
    )
    this.canvas.addEventListener('pointerdown', this.handleGraphPointerDown, { capture: true })
    this.canvas.addEventListener('pointermove', this.handleGraphPointerMove, { capture: true })
    this.canvas.addEventListener('pointerup', this.handleGraphPointerEnd, { capture: true })
    this.canvas.addEventListener('pointercancel', this.handleGraphPointerCancel, { capture: true })
    this.activateBackend()
    this.rebuildSnapshot()
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('keyboardConfiguration')) {
      this.resolvedKeyboardConfiguration = resolveGraphCanvasKeyboardConfiguration(
        this.keyboardConfiguration,
      )
    }
    if (changed.has('accessibilityConfiguration')) {
      this.resolvedAccessibilityConfiguration = resolveGraphCanvasAccessibilityConfiguration(
        this.accessibilityConfiguration,
      )
    }
    if (changed.has('historyConfiguration')) {
      this.resolvedHistoryConfiguration = resolveGraphCanvasHistoryConfiguration(
        this.historyConfiguration,
      )
      this.historyDriver = this.createHistoryDriver()
    }
    if (changed.has('connectionEditingConfiguration')) {
      this.connectionConfiguration = resolveGraphConnectionEditingConfiguration(
        this.connectionEditingConfiguration,
      )
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('renderingBackend') && this.activeBackendSource !== this.renderingBackend) {
      this.activateBackend()
    }
    if (changed.has('snapshot') && this.indexedSnapshot !== this.snapshot) {
      this.localSnapshotBaseID = undefined
      this.localSnapshotSequence = 0
      this.rebuildSnapshot()
    }
    if (changed.has('interactionConfiguration')) {
      this.resolvedInteractionConfiguration = resolveGraphCanvasInteractionConfiguration(
        this.interactionConfiguration,
      )
      this.interactionController?.cancel()
      this.refreshResizeHandleVisibility()
      this.syncInteractionOverlay()
      this.syncAccessibilityBridge()
    }
    if (changed.has('connectionEditingConfiguration')) {
      this.connectionController?.cancel()
      this.syncPortHitPadding()
    }
    if (changed.has('accessibilityConfiguration') && !changed.has('snapshot')) {
      this.rebuildAccessibilitySnapshot()
    }
    if (changed.has('selectedNodeIDs')) {
      this.reconcileSelection()
      this.refreshResizeHandleVisibility()
      this.presentationRevision += 1
      this.syncInteractionOverlay()
      this.syncAccessibilityBridge()
      this.scheduleRenderFrame()
    }
    if (changed.has('focusedNodeID')) {
      this.reconcileKeyboardFocus()
      this.presentationRevision += 1
      this.syncAccessibilityBridge()
      this.scheduleRenderFrame()
    }
    if (changed.has('tool')) {
      this.interactionController?.cancel()
      this.connectionController?.cancel()
    }
    if (changed.has('miniMapConfiguration')) this.syncMiniMap()
  }

  override connectedCallback(): void {
    super.connectedCallback()
    if (!this.hasUpdated) return
    queueMicrotask(() => {
      this.activateBackend()
      this.scheduleRenderFrame()
    })
  }

  override disconnectedCallback(): void {
    this.interactionController?.cancel()
    this.connectionController?.reset()
    if (this.renderFrameRequest !== undefined) cancelAnimationFrame(this.renderFrameRequest)
    this.renderFrameRequest = undefined
    this.backend?.unmount()
    this.renderGeometryCache.invalidate()
    this.activeBackendSource = undefined
    super.disconnectedCallback()
  }

  setZoom(zoom: number, options: FdCanvasTransformOptions = {}): void {
    this.canvas.setZoom(zoom, options)
  }

  center(
    worldPoint: FdCanvasPoint,
    zoom = this.canvas.viewport.transform.zoom,
    options: FdCanvasTransformOptions = {},
  ): void {
    this.canvas.center(worldPoint, zoom, options)
  }

  focusRect(rect: FdCanvasRect, zoom?: number, options: FdCanvasTransformOptions = {}): void {
    this.canvas.focusRect(rect, zoom, options)
  }

  focusNode(nodeID: string | number, zoom?: number, options: FdCanvasTransformOptions = {}): void {
    const node = this.index.nodes.get(nodeID)
    if (!node) return
    this.canvas.focusRect(node.frame, zoom, options)
  }

  jumpToElement(nodeID: FdGraphElementID, options: FdGraphJumpToElementOptions = {}): boolean {
    const node = this.index.nodes.get(nodeID)
    if (!node) return false
    const selection = options.selection ?? 'replace'
    if (
      selection !== 'preserve' &&
      node.capabilities?.selectable !== false &&
      this.resolvedInteractionConfiguration.selection !== 'none'
    ) {
      const selectedNodeIDs =
        selection === 'add' && this.resolvedInteractionConfiguration.selection === 'multiple'
          ? new Set(this.selectedNodeIDs)
          : new Set<FdGraphElementID>()
      selectedNodeIDs.add(nodeID)
      this.setSelection(selectedNodeIDs, { phase: 'ended', source: 'programmatic' })
    }
    this.setFocusedNode(nodeID, 'programmatic', false, false)
    this.canvas.focusRect(node.frame, options.zoom, { animated: options.animated ?? true })
    return true
  }

  arrangeSelectedNodes(action: FdGraphArrangementAction): boolean {
    const nodes = [...this.selectedNodeIDs].flatMap((id) => {
      const node = this.index.nodes.get(id)
      return node && node.capabilities?.arrangementParticipant !== false ? [node] : []
    })
    const translations = graphArrangementTranslations(nodes, action)
    const changes = nodes.flatMap<FdGraphNodeFrameChange>((node) => {
      const translation = translations.get(node.id)
      if (!translation) return []
      return [
        {
          nodeID: node.id,
          before: node.frame,
          after: {
            ...node.frame,
            x: node.frame.x + translation.width,
            y: node.frame.y + translation.height,
          },
        },
      ]
    })
    if (changes.length === 0) return false
    this.arrangementTransactionSequence += 1
    this.emitFrameChanges(
      `arrangement-${this.arrangementTransactionSequence}`,
      'arrangement',
      'ended',
      changes,
    )
    return true
  }

  fit(padding = 64, maximumZoom = 1, options: FdCanvasTransformOptions = {}): void {
    this.canvas.fitRect(this.index.contentBounds, padding, maximumZoom, options)
  }

  restore(options: FdCanvasTransformOptions = {}): void {
    this.canvas.restore(options)
  }

  beginConnection(origin: FdGraphConnectionOrigin): boolean {
    return this.connectionController?.begin(origin) ?? false
  }

  updateConnection(worldPoint: FdCanvasPoint): boolean {
    return this.connectionController?.update(worldPoint) ?? false
  }

  completeConnection(): boolean {
    return this.connectionController?.finish() ?? false
  }

  cancelConnection(): boolean {
    return this.connectionController?.cancel() ?? false
  }

  viewportPoint(event: PointerEvent): FdCanvasPoint {
    const bounds = this.canvas.getBoundingClientRect()
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  }

  nodeIDAtViewportPoint(point: FdCanvasPoint): FdGraphElementID | undefined {
    const worldPoint = this.canvas.viewport.transform.removePoint(point)
    for (const [nodeID, frame] of [...this.interactionPresentation.frames].reverse()) {
      if (canvasRectContains(frame, { ...worldPoint, width: 0, height: 0 })) return nodeID
    }
    const tolerance = 1 / this.canvas.viewport.transform.zoom
    return this.index
      .nodesIn({
        x: worldPoint.x - tolerance,
        y: worldPoint.y - tolerance,
        width: tolerance * 2,
        height: tolerance * 2,
      })
      .at(-1)?.id
  }

  setSelection(
    selection: ReadonlySet<FdGraphElementID>,
    detail: Omit<FdGraphSelectionChangeDetail, 'selectedNodeIDs'>,
  ): void {
    const next = new Set(selection)
    const changed = !this.setsEqual(this.selectedNodeIDs, next)
    if (changed) {
      this.selectionValue = next
      this.refreshResizeHandleVisibility()
      this.presentationRevision += 1
      this.syncInteractionOverlay()
      this.scheduleRenderFrame()
    }
    if (!changed && detail.phase === 'continuous') return
    this.dispatchEvent(
      new CustomEvent<FdGraphSelectionChangeDetail>('fd-graph-selection-change', {
        detail: { ...detail, selectedNodeIDs: next },
        bubbles: true,
        composed: true,
      }),
    )
  }

  setPresentation(presentation: FdGraphInteractionPresentation): void {
    this.interactionPresentation = presentation
    this.presentationRevision += 1
    this.syncInteractionOverlay()
    this.scheduleRenderFrame()
  }

  emitFrameChanges(
    transactionID: string,
    kind: FdGraphNodeFrameChangeKind,
    phase: 'continuous' | 'ended',
    changes: readonly FdGraphNodeFrameChange[],
  ): void {
    if (changes.length === 0) return
    const snapshotID = this.snapshot.id
    if (phase === 'ended' && this.resolvedInteractionConfiguration.frameUpdates === 'local') {
      this.applyLocalFrameChanges(changes)
    }
    const detail: FdGraphNodeFramesChangeDetail = {
      transactionID,
      snapshotID,
      kind,
      phase,
      changes,
    }
    this.dispatchEvent(
      new CustomEvent<FdGraphNodeFramesChangeDetail>('fd-graph-node-frames-change', {
        detail,
        bubbles: true,
        composed: true,
      }),
    )
    if (phase === 'ended' && kind !== 'history') {
      this.registerFrameHistory(transactionID, kind, changes)
    }
  }

  private handleGraphPointerDown = (event: PointerEvent): void => {
    if (this.connectionController?.pointerDown(event)) {
      if (this.resolvedAccessibilityConfiguration.enabled) {
        this.accessibilitySurface.focus({ preventScroll: true })
      }
      event.preventDefault()
      this.canvas.setPointerCapture(event.pointerId)
      return
    }
    const hitNodeID = this.nodeIDAtViewportPoint(this.viewportPoint(event))
    if (!this.interactionController?.pointerDown(event)) return
    const nodeElement = event
      .composedPath()
      .find(
        (target): target is HTMLElement =>
          target instanceof HTMLElement && target.matches('[data-fd-graph-node]'),
      )
    const key = nodeElement?.dataset.fdGraphNode
    const nodeID = key ? graphElementIDFromKey(key) : hitNodeID
    if (nodeID !== undefined) this.setFocusedNode(nodeID, 'pointer', false)
    if (this.resolvedAccessibilityConfiguration.enabled) {
      this.accessibilitySurface.focus({ preventScroll: true })
    }
    event.preventDefault()
    this.canvas.setPointerCapture(event.pointerId)
  }

  private handleGraphPointerMove = (event: PointerEvent): void => {
    if (this.connectionController?.activePointerID === event.pointerId) {
      event.preventDefault()
      this.connectionController.pointerMove(event)
      return
    }
    if (this.interactionController?.activePointerID !== event.pointerId) return
    event.preventDefault()
    this.interactionController.pointerMove(event)
  }

  private handleGraphPointerEnd = (event: PointerEvent): void => {
    if (this.connectionController?.activePointerID === event.pointerId) {
      event.preventDefault()
      this.connectionController.pointerEnd(event)
      if (this.canvas.hasPointerCapture(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId)
      }
      return
    }
    if (this.interactionController?.activePointerID !== event.pointerId) return
    event.preventDefault()
    this.interactionController.pointerEnd(event)
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId)
  }

  private handleGraphPointerCancel = (event: PointerEvent): void => {
    if (this.connectionController?.activePointerID === event.pointerId) {
      this.connectionController.cancel()
      if (this.canvas.hasPointerCapture(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId)
      }
      return
    }
    if (this.interactionController?.activePointerID !== event.pointerId) return
    this.interactionController.cancel()
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId)
  }

  private activateBackend(): void {
    if (!this.renderViewport || !this.renderWorld) return
    this.backend?.unmount()
    if (typeof this.renderingBackend === 'string') {
      const kind = resolveGraphRenderingBackendKind(
        this.renderingBackend,
        graphRenderingCapabilities(),
      )
      this.backend =
        kind === 'webgl2' ? new FdGraphWebGL2RenderingBackend() : new FdGraphDOMRenderingBackend()
    } else this.backend = this.renderingBackend
    this.activeBackendSource = this.renderingBackend
    this.backend.mount({ viewport: this.renderViewport, world: this.renderWorld })
    this.scheduleRenderFrame()
  }

  private rebuildSnapshot(): void {
    this.interactionController?.cancel()
    if (
      this.connectionController?.activeConnection &&
      this.connectionController.activeConnection.snapshotID !== this.snapshot.id
    ) {
      this.connectionController.cancel({ kind: 'staleSnapshot' })
    }
    this.index = new FdGraphSnapshotIndex(this.snapshot)
    this.indexedSnapshot = this.snapshot
    this.snapshotRevision += 1
    this.rebuildKeyboardCandidates()
    this.reconcileSelection()
    this.reconcileKeyboardFocus()
    this.rebuildAccessibilitySnapshot()
    this.refreshResizeHandleVisibility()
    this.syncInteractionOverlay()
    this.syncMiniMap()
    this.syncAccessibilityBridge()
    if (!this.canvas) return
    this.canvasContentRect = this.index.contentBounds
    this.canvas.contentRect = this.canvasContentRect
    this.refreshVisibleElements(this.canvas.renderWorldRect)
  }

  private applyLocalFrameChanges(changes: readonly FdGraphNodeFrameChange[]): void {
    this.localSnapshotBaseID ??= this.snapshot.id
    this.localSnapshotSequence += 1
    this.snapshot = this.index.applyNodeFrames(
      `${this.localSnapshotBaseID}:local-${this.localSnapshotSequence}`,
      changes.map(({ nodeID, after }) => ({ nodeID, frame: after })),
    )
    this.indexedSnapshot = this.snapshot
    this.snapshotRevision += 1
    const changedNodeIDs = new Set<FdGraphElementID>()
    for (const { nodeID, after } of changes) {
      changedNodeIDs.add(nodeID)
      const candidateIndex = this.keyboardCandidateIndices.get(nodeID)
      const candidate =
        candidateIndex === undefined ? undefined : this.keyboardCandidates[candidateIndex]
      if (candidateIndex !== undefined && candidate) {
        this.keyboardCandidates[candidateIndex] = { ...candidate, frame: after }
      }
    }
    this.accessibilitySnapshot.updateGeometry(this.index, changedNodeIDs)
    this.refreshResizeHandleVisibility()
    this.syncInteractionOverlay()
    this.syncMiniMap()
    this.syncAccessibilityBridge()
    this.refreshVisibleElements(this.canvas.renderWorldRect)
  }

  private rebuildKeyboardCandidates(): void {
    this.keyboardCandidates = []
    this.keyboardCandidateIndices.clear()
    for (const [presentationOrder, node] of this.snapshot.nodes.entries()) {
      if (node.capabilities?.keyboardNavigable === false) continue
      this.keyboardCandidateIndices.set(node.id, this.keyboardCandidates.length)
      this.keyboardCandidates.push({ id: node.id, frame: node.frame, presentationOrder })
    }
  }

  private createHistoryDriver(): FdGraphHistoryDriver<
    FdGraphCanvasHistoryChange,
    FdGraphCanvasHistoryFailure
  > {
    return new FdGraphHistoryDriver({
      configuration: {
        enabled: this.resolvedHistoryConfiguration.enabled,
        maximumDepth: this.resolvedHistoryConfiguration.maximumDepth,
        capabilities: this.resolvedHistoryConfiguration.capabilities,
      },
      apply: (change, direction) => this.applyHistoryChange(change, direction),
      onConflict: (conflict) => {
        this.dispatchEvent(
          new CustomEvent<FdGraphCanvasHistoryConflictDetail>('fd-graph-history-conflict', {
            detail: conflict,
            bubbles: true,
            composed: true,
          }),
        )
      },
      onStateChange: (state) => {
        this.dispatchEvent(
          new CustomEvent<FdGraphCanvasHistoryStateDetail>('fd-graph-history-state-change', {
            detail: state,
            bubbles: true,
            composed: true,
          }),
        )
      },
    })
  }

  private registerFrameHistory(
    transactionID: string,
    kind: Exclude<FdGraphNodeFrameChangeKind, 'history'>,
    changes: readonly FdGraphNodeFrameChange[],
  ): void {
    const redoChange = changes.map(({ nodeID, before, after }) => ({
      nodeID,
      before: { ...before },
      after: { ...after },
    }))
    const undoChange = redoChange.map(({ nodeID, before, after }) => ({
      nodeID,
      before: after,
      after: before,
    }))
    this.historyDriver.register({
      id: transactionID,
      actionName: this.resolvedHistoryConfiguration.actionName({ kind, changes: redoChange }),
      mode: this.resolvedHistoryConfiguration.mode,
      undoChange,
      redoChange,
    })
  }

  private async applyHistoryChange(
    changes: FdGraphCanvasHistoryChange,
    direction: FdGraphHistoryDirection,
  ): Promise<FdGraphHistoryApplyResult<FdGraphCanvasHistoryChange, FdGraphCanvasHistoryFailure>> {
    const consumerApply = this.resolvedHistoryConfiguration.apply
    if (consumerApply) {
      try {
        const result = await consumerApply(changes, direction)
        return result.kind === 'rejected'
          ? {
              kind: 'rejected',
              failure: { kind: 'consumerRejected', failure: result.failure },
            }
          : result
      } catch (error) {
        return { kind: 'rejected', failure: { kind: 'consumerFailure', error } }
      }
    }
    for (const change of changes) {
      const frame = this.index.nodes.get(change.nodeID)?.frame
      if (!frame || !this.framesEqual(frame, change.before)) {
        return {
          kind: 'rejected',
          failure: { kind: 'staleNodeFrame', nodeID: change.nodeID },
        }
      }
    }
    const snapshotID = this.snapshot.id
    if (this.resolvedInteractionConfiguration.frameUpdates === 'local') {
      this.applyLocalFrameChanges(changes)
    }
    this.historyTransactionSequence += 1
    const detail: FdGraphNodeFramesChangeDetail = {
      transactionID: `history-${this.historyTransactionSequence}`,
      snapshotID,
      kind: 'history',
      phase: 'ended',
      changes,
    }
    this.dispatchEvent(
      new CustomEvent<FdGraphNodeFramesChangeDetail>('fd-graph-node-frames-change', {
        detail,
        bubbles: true,
        composed: true,
      }),
    )
    return { kind: 'applied' }
  }

  private framesEqual(first: FdCanvasRect, second: FdCanvasRect): boolean {
    return (
      first.x === second.x &&
      first.y === second.y &&
      first.width === second.width &&
      first.height === second.height
    )
  }

  private reconcileSelection(): void {
    const valid = [...this.selectedNodeIDs].filter(
      (id) => this.index.nodes.get(id)?.capabilities?.selectable !== false,
    )
    const next = new Set(
      this.resolvedInteractionConfiguration.selection === 'none'
        ? []
        : this.resolvedInteractionConfiguration.selection === 'single'
          ? valid.slice(0, 1)
          : valid,
    )
    if (!this.setsEqual(this.selectedNodeIDs, next)) this.selectedNodeIDs = next
  }

  private reconcileKeyboardFocus(): void {
    if (this.focusedNodeID === undefined) return
    const node = this.index.nodes.get(this.focusedNodeID)
    if (node && node.capabilities?.keyboardNavigable !== false) return
    this.focusedNodeValue = undefined
  }

  private rebuildAccessibilitySnapshot(): void {
    this.accessibilitySnapshot = createGraphAccessibilitySnapshot(
      this.snapshot,
      this.resolvedAccessibilityConfiguration,
    )
    const focusedNodeKey =
      this.focusedNodeID === undefined ? undefined : graphNodeAccessibilityKey(this.focusedNodeID)
    this.accessibilityFocusedElementKey = this.accessibilitySnapshot.reconciledFocus(
      focusedNodeKey ?? this.accessibilityFocusedElementKey,
    )
    this.syncAccessibilityBridge()
  }

  private syncAccessibilityBridge(): void {
    this.accessibilityBridge?.update({
      snapshot: this.accessibilitySnapshot,
      configuration: this.resolvedAccessibilityConfiguration,
      selectedNodeIDs: this.selectedNodeIDs,
      allowsMultipleSelection: this.resolvedInteractionConfiguration.selection === 'multiple',
      ...(this.accessibilityFocusedElementKey
        ? { focusedElementKey: this.accessibilityFocusedElementKey }
        : {}),
    })
  }

  private handleAccessibilityFocusIn = (): void => {
    if (!this.resolvedAccessibilityConfiguration.enabled) return
    const key = this.accessibilitySnapshot.reconciledFocus(
      this.accessibilityFocusedElementKey ??
        (this.focusedNodeID === undefined
          ? undefined
          : graphNodeAccessibilityKey(this.focusedNodeID)),
    )
    if (key) this.focusAccessibilityElement(key)
  }

  private handleAccessibilityKeyDown = (event: KeyboardEvent): void => {
    if (!this.resolvedAccessibilityConfiguration.enabled) return
    const command = this.resolvedAccessibilityConfiguration.resolveCommand(event)
    if (!command || !this.performAccessibilityCommand(command)) return
    event.preventDefault()
    event.stopPropagation()
  }

  private performAccessibilityCommand(command: FdGraphAccessibilityCommand): boolean {
    const currentKey = this.accessibilityFocusedElementKey
    switch (command.kind) {
      case 'focusPrevious':
        return currentKey
          ? this.focusAccessibilityElement(this.accessibilitySnapshot.elementKeyBefore(currentKey))
          : this.focusAccessibilityElement(this.accessibilitySnapshot.firstElementKey)
      case 'focusNext':
        return currentKey
          ? this.focusAccessibilityElement(this.accessibilitySnapshot.elementKeyAfter(currentKey))
          : this.focusAccessibilityElement(this.accessibilitySnapshot.firstElementKey)
      case 'focusFirst':
        return this.focusAccessibilityElement(this.accessibilitySnapshot.firstElementKey)
      case 'focusLast':
        return this.focusAccessibilityElement(this.accessibilitySnapshot.lastElementKey)
      case 'select':
        return this.selectAccessibilityElement(currentKey)
      case 'activate':
        return this.activateAccessibilityElement(currentKey)
      case 'move':
        return this.moveAccessibilityElement(currentKey, command.direction, command.large)
    }
  }

  private focusAccessibilityElement(key: string | undefined): boolean {
    if (!key || !this.resolvedAccessibilityConfiguration.capabilities.focusNavigation) return false
    const item = this.accessibilitySnapshot.item(key)
    if (!item) return false
    if (!this.dispatchAccessibilityAction(item.reference, { kind: 'focus' })) return true
    this.accessibilityFocusedElementKey = key
    this.presentationRevision += 1
    if (item.kind === 'node' && item.reference.nodeID !== undefined) {
      this.setFocusedNode(
        item.reference.nodeID,
        'accessibility',
        false,
        this.resolvedAccessibilityConfiguration.keepsFocusedElementVisible,
      )
    } else if (
      this.resolvedAccessibilityConfiguration.keepsFocusedElementVisible &&
      !canvasRectContains(this.canvas.viewport.visibleWorldRect, item.frame)
    ) {
      this.canvas.focusRect(item.frame, this.canvas.viewport.transform.zoom)
    }
    this.syncAccessibilityBridge()
    this.scheduleRenderFrame()
    return true
  }

  private selectAccessibilityElement(key: string | undefined): boolean {
    if (!key || !this.resolvedAccessibilityConfiguration.capabilities.selection) return false
    const item = this.accessibilitySnapshot.item(key)
    const nodeID = item?.reference.nodeID
    if (item?.kind !== 'node' || nodeID === undefined) return false
    if (!this.dispatchAccessibilityAction(item.reference, { kind: 'select' })) return true
    if (this.index.nodes.get(nodeID)?.capabilities?.selectable === false) return false
    const selection = new Set(this.selectedNodeIDs)
    if (this.resolvedInteractionConfiguration.selection === 'none') return false
    if (this.resolvedInteractionConfiguration.selection === 'single') selection.clear()
    if (selection.has(nodeID)) selection.delete(nodeID)
    else selection.add(nodeID)
    this.setSelection(selection, { phase: 'ended', source: 'accessibility' })
    return true
  }

  private activateAccessibilityElement(key: string | undefined): boolean {
    if (!key || !this.resolvedAccessibilityConfiguration.capabilities.activation) return false
    const item = this.accessibilitySnapshot.item(key)
    if (!item) return false
    if (!this.dispatchAccessibilityAction(item.reference, { kind: 'activate' })) return true
    return item.kind !== 'node' || this.activateFocusedNode('accessibility')
  }

  private moveAccessibilityElement(
    key: string | undefined,
    direction: FdGraphNavigationDirection,
    large: boolean,
  ): boolean {
    if (!key || !this.resolvedAccessibilityConfiguration.capabilities.movement) return false
    const item = this.accessibilitySnapshot.item(key)
    const nodeID = item?.reference.nodeID
    if (item?.kind !== 'node' || nodeID === undefined) return false
    if (!this.dispatchAccessibilityAction(item.reference, { kind: 'move', direction, large })) {
      return true
    }
    if (!this.selectedNodeIDs.has(nodeID)) {
      this.setSelection(new Set([nodeID]), { phase: 'ended', source: 'accessibility' })
    }
    this.focusedNodeID = nodeID
    return this.nudgeKeyboardSelection(direction, large)
  }

  private dispatchAccessibilityAction(
    element: FdGraphAccessibilityActionDetail['element'],
    action: FdGraphAccessibilityActionDetail['action'],
  ): boolean {
    return this.dispatchEvent(
      new CustomEvent<FdGraphAccessibilityActionDetail>('fd-graph-accessibility-action', {
        detail: { element, action },
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    )
  }

  private handleKeyboardFocusIn = (): void => {
    if (!this.resolvedKeyboardConfiguration.enabled || this.focusedNodeID !== undefined) return
    const selected = this.keyboardCandidates.find(({ id }) => this.selectedNodeIDs.has(id))
    const first = selected ?? this.keyboardCandidates[0]
    if (first) this.setFocusedNode(first.id, 'keyboard', false)
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.connectionController?.cancel()) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (!this.resolvedKeyboardConfiguration.enabled || this.isEditableKeyboardTarget(event)) return
    const command = this.resolvedKeyboardConfiguration.resolveCommand(event, {
      hasSelection: this.selectedNodeIDs.size > 0,
      focusedNodeIsSelected:
        this.focusedNodeID !== undefined && this.selectedNodeIDs.has(this.focusedNodeID),
      navigationEnabled: this.resolvedKeyboardConfiguration.navigation,
      nudgingEnabled: this.resolvedKeyboardConfiguration.nudging,
      selectionEnabled:
        this.resolvedKeyboardConfiguration.selection &&
        this.resolvedInteractionConfiguration.selection !== 'none',
      historyEnabled: this.resolvedHistoryConfiguration.enabled,
    })
    if (!command || !this.performKeyboardCommand(command)) return
    event.preventDefault()
    event.stopPropagation()
  }

  private performKeyboardCommand(command: FdGraphKeyboardCommand): boolean {
    switch (command.kind) {
      case 'navigate':
        return this.navigateKeyboardFocus(command.direction)
      case 'nudge':
        return this.nudgeKeyboardSelection(command.direction, command.large)
      case 'focusFirst':
        return this.focusKeyboardCandidate(this.keyboardCandidates[0])
      case 'focusLast':
        return this.focusKeyboardCandidate(this.keyboardCandidates.at(-1))
      case 'toggleSelection':
        return this.toggleFocusedSelection()
      case 'selectAll':
        return this.selectAllKeyboardNodes()
      case 'clearSelection':
        this.setSelection(new Set(), { phase: 'ended', source: 'keyboard' })
        return true
      case 'activate':
        return this.activateFocusedNode('keyboard')
      case 'undo':
        if (!this.historyDriver.canUndo) return false
        void this.historyDriver.undo()
        return true
      case 'redo':
        if (!this.historyDriver.canRedo) return false
        void this.historyDriver.redo()
        return true
    }
  }

  private navigateKeyboardFocus(direction: FdGraphNavigationDirection): boolean {
    if (this.keyboardCandidates.length === 0) return false
    const current =
      this.keyboardCandidates.find(({ id }) => id === this.focusedNodeID) ??
      this.keyboardCandidates.find(({ id }) => this.selectedNodeIDs.has(id))
    if (!current) return this.focusKeyboardCandidate(this.keyboardCandidates[0])
    const nodeID = nextGraphKeyboardNodeID(current, direction, this.keyboardCandidates)
    return this.focusKeyboardCandidate(this.keyboardCandidates.find(({ id }) => id === nodeID))
  }

  private focusKeyboardCandidate(
    candidate: FdGraphKeyboardNavigationCandidate | undefined,
  ): boolean {
    if (!candidate) return false
    this.setFocusedNode(candidate.id, 'keyboard', true)
    return true
  }

  private setFocusedNode(
    nodeID: FdGraphElementID,
    source: FdGraphFocusChangeDetail['source'],
    updatesSelection: boolean,
    keepsVisible = this.resolvedKeyboardConfiguration.keepsFocusedNodeVisible,
  ): void {
    const node = this.index.nodes.get(nodeID)
    if (!node || node.capabilities?.keyboardNavigable === false) return
    const changed = this.focusedNodeID !== nodeID
    this.focusedNodeID = nodeID
    this.syncAccessibilityBridge()
    if (
      updatesSelection &&
      this.resolvedKeyboardConfiguration.selectionBehavior === 'replace' &&
      node.capabilities?.selectable !== false
    ) {
      this.setSelection(new Set([nodeID]), { phase: 'ended', source: 'keyboard' })
    }
    if (keepsVisible && !canvasRectContains(this.canvas.viewport.visibleWorldRect, node.frame)) {
      this.canvas.focusRect(node.frame, this.canvas.viewport.transform.zoom)
    }
    if (!changed) return
    this.dispatchEvent(
      new CustomEvent<FdGraphFocusChangeDetail>('fd-graph-focus-change', {
        detail: { focusedNodeID: nodeID, source },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private toggleFocusedSelection(): boolean {
    const nodeID = this.focusedNodeID
    if (nodeID === undefined || this.index.nodes.get(nodeID)?.capabilities?.selectable === false) {
      return false
    }
    const selection = new Set(this.selectedNodeIDs)
    if (this.resolvedInteractionConfiguration.selection === 'single') selection.clear()
    if (selection.has(nodeID)) selection.delete(nodeID)
    else selection.add(nodeID)
    this.setSelection(selection, { phase: 'ended', source: 'keyboard' })
    return true
  }

  private selectAllKeyboardNodes(): boolean {
    if (this.resolvedInteractionConfiguration.selection !== 'multiple') return false
    const selection = new Set(
      this.keyboardCandidates.flatMap(({ id }) =>
        this.index.nodes.get(id)?.capabilities?.selectable === false ? [] : [id],
      ),
    )
    this.setSelection(selection, { phase: 'ended', source: 'keyboard' })
    return true
  }

  private nudgeKeyboardSelection(direction: FdGraphNavigationDirection, large: boolean): boolean {
    const nodes = [...this.selectedNodeIDs].flatMap((id) => {
      const node = this.index.nodes.get(id)
      return node ? [node] : []
    })
    if (
      nodes.length === 0 ||
      nodes.some(({ capabilities }) => capabilities?.draggable === false) ||
      !this.resolvedInteractionConfiguration.nodeDragging ||
      (nodes.length > 1 && !this.resolvedInteractionConfiguration.multipleNodeDragging) ||
      !this.resolvedInteractionConfiguration.canDragNodes(nodes)
    ) {
      return false
    }
    const distance = large
      ? this.resolvedKeyboardConfiguration.largeNudgeStep
      : this.resolvedKeyboardConfiguration.nudgeStep
    const translation = graphKeyboardTranslation(direction, distance)
    const changes = nodes.map(({ id, frame }) => ({
      nodeID: id,
      before: frame,
      after: {
        ...frame,
        x: frame.x + translation.width,
        y: frame.y + translation.height,
      },
    }))
    this.keyboardTransactionSequence += 1
    this.emitFrameChanges(
      `keyboard-${this.keyboardTransactionSequence}`,
      'keyboard',
      'ended',
      changes,
    )
    return true
  }

  private activateFocusedNode(source: FdGraphNodeActivateDetail['source']): boolean {
    if (this.focusedNodeID === undefined) return false
    this.dispatchEvent(
      new CustomEvent<FdGraphNodeActivateDetail>('fd-graph-node-activate', {
        detail: { nodeID: this.focusedNodeID, source },
        bubbles: true,
        composed: true,
      }),
    )
    return true
  }

  private isEditableKeyboardTarget(event: KeyboardEvent): boolean {
    return event
      .composedPath()
      .some(
        (target) =>
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          (target instanceof HTMLElement && target.isContentEditable),
      )
  }

  private setsEqual(
    first: ReadonlySet<FdGraphElementID>,
    second: ReadonlySet<FdGraphElementID>,
  ): boolean {
    if (first.size !== second.size) return false
    for (const id of first) if (!second.has(id)) return false
    return true
  }

  private syncInteractionOverlay(): void {
    if (!this.interactionWorld || !this.selectionBoundsElement || !this.marqueeElement) return
    this.syncInteractionScale()
    this.syncSelectionBounds()
    this.syncMarquee()
    this.syncGuides(this.interactionPresentation.guides)
  }

  setConnectionPresentation(connection: FdGraphTransientConnection | undefined): void {
    const detail: FdGraphConnectionPreviewChangeDetail = connection ? { connection } : {}
    this.dispatchEvent(
      new CustomEvent<FdGraphConnectionPreviewChangeDetail>('fd-graph-connection-preview-change', {
        detail,
        bubbles: true,
        composed: true,
      }),
    )
    this.clearConnectionPortStates()
    if (!connection || !this.connectionConfiguration.rendersDefaultPreview) {
      this.connectionPreviewElement.setAttribute('hidden', '')
      this.connectionFeedbackElement.hidden = true
      return
    }

    const { stationaryPoint: start, movingPoint: end } = connection
    const direction = end.x >= start.x ? 1 : -1
    const bend = Math.max(40, Math.abs(end.x - start.x) * 0.5) * direction
    this.connectionPreviewElement.setAttribute(
      'd',
      `M ${start.x} ${start.y} C ${start.x + bend} ${start.y}, ${end.x - bend} ${end.y}, ${end.x} ${end.y}`,
    )
    this.connectionPreviewElement.removeAttribute('hidden')
    const validation = connection.validation?.kind ?? 'pending'
    this.connectionPreviewElement.dataset.validation = validation
    this.syncConnectionPortStates(connection)

    const feedback =
      connection.validation?.kind === 'invalid'
        ? connection.validation.feedback?.message
        : undefined
    this.connectionFeedbackElement.hidden = !feedback
    if (feedback) {
      this.connectionFeedbackElement.textContent = feedback
      this.connectionFeedbackElement.style.transform = `translate3d(${end.x + 12}px, ${end.y + 12}px, 0)`
    }
  }

  emitConnectionResolution(
    connection: FdGraphTransientConnection,
    resolution: FdGraphConnectionResolution,
  ): void {
    if (resolution.kind === 'completed') {
      const detail: FdGraphConnectionCompleteDetail = {
        snapshotID: connection.snapshotID,
        origin: connection.origin,
        operation: resolution.operation,
      }
      this.dispatchEvent(
        new CustomEvent<FdGraphConnectionCompleteDetail>('fd-graph-connection-complete', {
          detail,
          bubbles: true,
          composed: true,
        }),
      )
      return
    }
    const detail: FdGraphConnectionCancelDetail = {
      snapshotID: connection.snapshotID,
      origin: connection.origin,
      reason: resolution.reason,
    }
    this.dispatchEvent(
      new CustomEvent<FdGraphConnectionCancelDetail>('fd-graph-connection-cancel', {
        detail,
        bubbles: true,
        composed: true,
      }),
    )
  }

  private syncPortHitPadding(): void {
    this.style.setProperty(
      '--fd-graph-port-hit-padding',
      `${this.connectionConfiguration.enabled ? this.connectionConfiguration.sourceHitPadding : 0}px`,
    )
  }

  private syncConnectionPortStates(connection: FdGraphTransientConnection): void {
    const source =
      connection.origin.kind === 'new' ? connection.origin.source : connection.origin.original
    this.setConnectionPortState(source.nodeID, source.portID, 'source')
    if (!connection.candidate) return
    this.setConnectionPortState(
      connection.candidate.endpoint.nodeID,
      connection.candidate.endpoint.portID,
      connection.validation?.kind === 'invalid' ? 'invalid' : 'valid',
    )
  }

  private setConnectionPortState(
    nodeID: FdGraphElementID,
    portID: FdGraphElementID,
    state: 'source' | 'valid' | 'invalid',
  ): void {
    const nodeKey = graphElementKey(nodeID)
    const portKey = graphElementKey(portID)
    for (const element of this.renderWorld.querySelectorAll<HTMLElement>('.graph-port')) {
      if (element.dataset.fdGraphNode !== nodeKey || element.dataset.fdGraphPort !== portKey)
        continue
      element.dataset.connectionState = state
      this.connectionPortElements.add(element)
      return
    }
  }

  private clearConnectionPortStates(): void {
    for (const element of this.connectionPortElements) delete element.dataset.connectionState
    this.connectionPortElements.clear()
  }

  private syncInteractionScale(): void {
    if (!this.interactionWorld) return
    const zoom = this.canvas?.viewport.transform.zoom ?? 1
    this.interactionWorld.style.setProperty('--fd-graph-world-pixel', `${1 / zoom}px`)
    this.interactionWorld.style.setProperty('--fd-graph-handle-world-size', `${9 / zoom}px`)
  }

  private syncSelectionBounds(): void {
    const frames = new Map<FdGraphElementID, FdCanvasRect>()
    for (const id of this.selectedNodeIDs) {
      const frame = this.interactionPresentation.frames.get(id) ?? this.index.nodes.get(id)?.frame
      if (frame) frames.set(id, frame)
    }
    const bounds = graphSelectionBounds(frames)
    this.selectionBoundsElement.hidden = bounds === undefined
    if (!bounds) return
    this.selectionBoundsElement.style.transform = `translate3d(${bounds.x}px, ${bounds.y}px, 0)`
    this.selectionBoundsElement.style.width = `${bounds.width}px`
    this.selectionBoundsElement.style.height = `${bounds.height}px`
    for (const handle of this.selectionBoundsElement.querySelectorAll<HTMLElement>(
      '.resize-handle',
    )) {
      handle.hidden = !this.resizeHandlesVisible
    }
  }

  private refreshResizeHandleVisibility(): void {
    if (!this.resolvedInteractionConfiguration.nodeResizing || this.selectedNodeIDs.size === 0) {
      this.resizeHandlesVisible = false
      return
    }
    if (this.selectedNodeIDs.size > 1 && !this.resolvedInteractionConfiguration.groupResizing) {
      this.resizeHandlesVisible = false
      return
    }
    const nodes = [...this.selectedNodeIDs].flatMap((id) => {
      const node = this.index.nodes.get(id)
      return node ? [node] : []
    })
    this.resizeHandlesVisible =
      nodes.length === this.selectedNodeIDs.size &&
      nodes.every(({ capabilities }) => capabilities?.resizable !== false) &&
      this.resolvedInteractionConfiguration.canResizeNodes(nodes)
  }

  private syncMarquee(): void {
    const marquee = this.interactionPresentation.marquee
    this.marqueeElement.hidden = marquee === undefined
    if (!marquee) return
    this.marqueeElement.style.transform = `translate3d(${marquee.x}px, ${marquee.y}px, 0)`
    this.marqueeElement.style.width = `${marquee.width}px`
    this.marqueeElement.style.height = `${marquee.height}px`
  }

  private syncGuides(guides: readonly FdGraphGuide[]): void {
    const elements = guides.map((guide) => {
      const element = document.createElement('span')
      element.className = 'alignment-guide'
      element.dataset.axis = guide.axis
      element.dataset.kind = guide.kind
      if (guide.axis === 'vertical') {
        element.style.transform = `translate3d(${guide.position}px, ${guide.lowerBound}px, 0)`
        element.style.height = `${guide.upperBound - guide.lowerBound}px`
      } else {
        element.style.transform = `translate3d(${guide.lowerBound}px, ${guide.position}px, 0)`
        element.style.width = `${guide.upperBound - guide.lowerBound}px`
      }
      return element
    })
    this.guideLayer.replaceChildren(...elements)
  }

  private handleRenderWorldRectChange(event: CustomEvent<{ readonly rect: FdCanvasRect }>): void {
    this.refreshVisibleElements(event.detail.rect)
  }

  private handleViewportChange(event: CustomEvent<FdCanvasViewportChangeDetail>): void {
    if (event.target !== this.canvas) return
    this.miniMapViewport = event.detail.viewport
    if (this.miniMap) this.miniMap.viewport = event.detail.viewport
    this.syncInteractionScale()
    this.scheduleRenderFrame()
  }

  private handleMiniMapNavigation = (event: CustomEvent<FdGraphMiniMapNavigationDetail>): void => {
    const detail = event.detail
    if (detail.kind === 'center') {
      this.canvas.center(detail.worldPoint, this.canvas.viewport.transform.zoom, {
        animated: false,
        phase: detail.phase,
      })
    } else {
      this.canvas.setZoom(detail.zoom, { animated: false, phase: detail.phase })
    }
  }

  private syncMiniMap(): void {
    if (!this.miniMap || !this.miniMapConfiguration) return
    this.miniMap.snapshot = this.snapshot
    this.miniMap.snapshotIndex = this.index
    this.miniMap.viewport = this.miniMapViewport
    this.miniMap.configuration = this.miniMapConfiguration
  }

  private refreshVisibleElements(rect: FdCanvasRect): void {
    if (rect.width <= 0 || rect.height <= 0) return
    this.renderWorldRect = rect
    this.visibleNodes = this.index.nodesIn(rect)
    this.visibleEdges = this.index.edgesIn(rect)
    this.presentationRevision += 1
    this.scheduleRenderFrame()
  }

  private scheduleRenderFrame(): void {
    if (!this.backend || this.renderFrameRequest !== undefined) return
    this.renderFrameRequest = requestAnimationFrame(() => {
      this.renderFrameRequest = undefined
      this.renderBackendFrame()
    })
  }

  private renderBackendFrame(): void {
    if (!this.backend || !this.canvas) return
    const accessibilityFocus = this.accessibilityFocusedElementKey
      ? this.accessibilitySnapshot.item(this.accessibilityFocusedElementKey)
      : undefined
    const geometry = this.renderGeometryCache.resolve({
      snapshotRevision: this.snapshotRevision,
      presentationRevision: this.presentationRevision,
      nodes: this.visibleNodes,
      edges: this.visibleEdges,
      selectedNodeIDs: this.selectedNodeIDs,
      ...(this.focusedNodeID === undefined ? {} : { focusedNodeID: this.focusedNodeID }),
      ...(accessibilityFocus?.kind === 'edge'
        ? { focusedEdgeID: accessibilityFocus.reference.edgeID }
        : {}),
      nodeFrame: (node) => this.interactionPresentation.frames.get(node.id) ?? node.frame,
      edgeEndpoint: (edge, endpoint) => this.endpointPoint(edge, endpoint),
    })
    const frame: FdGraphRenderFrame = {
      snapshotID: this.snapshot.id,
      snapshotRevision: this.snapshotRevision,
      presentationRevision: this.presentationRevision,
      viewport: this.canvas.viewport,
      renderWorldRect: this.renderWorldRect,
      nodes: geometry.nodes,
      edges: geometry.edges,
      selectedNodeIDs: this.selectedNodeIDs,
      ...(this.focusedNodeID === undefined ? {} : { focusedNodeID: this.focusedNodeID }),
      pixelRatio: window.devicePixelRatio,
    }
    this.backend.render(frame)
  }

  private endpointPoint(edge: FdAnyGraphEdge, endpoint: 'source' | 'target'): FdCanvasPoint {
    const value = edge[endpoint]
    const node = this.index.nodes.get(value.nodeID)
    if (!node) throw new RangeError(`missing endpoint node ${String(value.nodeID)}`)
    const frame = this.interactionPresentation.frames.get(node.id)
    return graphPortPoint(frame ? { ...node, frame } : node, value.portID)
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-graph-canvas': FdGraphCanvas
  }
}
