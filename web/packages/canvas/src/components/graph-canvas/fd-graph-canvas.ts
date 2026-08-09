import { type CSSResultGroup, css, html, LitElement, type PropertyValues } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import type {
  FdCanvasConfiguration,
  FdCanvasContentChangeBehavior,
  FdCanvasRequest,
} from '../../configuration.js'
import type { FdCanvasViewportChangeDetail } from '../../events.js'
import type { FdCanvasInsets, FdCanvasRect, FdCanvasViewport } from '../../geometry.js'
import { zeroCanvasInsets } from '../../geometry.js'
import type { FdAnyGraphEdge, FdAnyGraphNode, FdAnyGraphSnapshot } from '../../graph/model.js'
import { FdGraphSnapshotIndex } from '../../graph/snapshot-index.js'
import type {
  FdGraphRenderEdge,
  FdGraphRenderFrame,
  FdGraphRenderingBackend,
  FdGraphRenderingBackendPreference,
  FdGraphRenderNode,
} from '../../rendering/backend.js'
import { FdGraphDOMRenderingBackend } from '../../rendering/dom-backend.js'
import type { FdCanvas, FdCanvasTransformOptions } from '../canvas/fd-canvas.js'
import '../canvas/fd-canvas.js'

const emptySnapshot: FdAnyGraphSnapshot = { id: 'empty', nodes: [], edges: [] }

@customElement('fd-graph-canvas')
export class FdGraphCanvas extends LitElement {
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
    .graph-node-layer,
    .graph-edge-layer {
      position: absolute;
      top: 0;
      left: 0;
    }

    .render-viewport {
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .render-world,
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

    .consumer-background,
    .consumer-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .consumer-overlay ::slotted(*) {
      pointer-events: auto;
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

  @query('fd-canvas') private canvas!: FdCanvas
  @query('.render-viewport') private renderViewport!: HTMLElement
  @query('.render-world') private renderWorld!: HTMLElement

  private index = new FdGraphSnapshotIndex(emptySnapshot)
  private backend: FdGraphRenderingBackend | undefined
  private visibleNodes: readonly FdAnyGraphNode[] = []
  private visibleEdges: readonly FdAnyGraphEdge[] = []
  private renderWorldRect: FdCanvasRect = { x: 0, y: 0, width: 1, height: 1 }
  private snapshotRevision = 0
  private presentationRevision = 0
  private renderFrameRequest: number | undefined
  private activeBackendSource:
    | FdGraphRenderingBackendPreference
    | FdGraphRenderingBackend
    | undefined
  private indexedSnapshot: FdAnyGraphSnapshot | undefined

  get viewport(): FdCanvasViewport {
    return this.canvas.viewport
  }

  get resolvedRenderingBackend(): FdGraphRenderingBackend | undefined {
    return this.backend
  }

  override render() {
    return html`
      <fd-canvas
        exportparts="viewport:canvas-viewport"
        interaction-mode="pan"
        .configuration=${this.configuration}
        .contentRect=${this.index.contentBounds}
        .contentInsets=${this.contentInsets}
        .contentChangeBehavior=${this.contentChangeBehavior}
        .request=${this.request}
        @fd-render-world-rect-change=${this.handleRenderWorldRectChange}
        @fd-viewport-change=${this.handleViewportChange}
      >
        <div class="consumer-background" slot="background"><slot name="background"></slot></div>
        <div class="render-viewport" slot="background"></div>
        <div class="render-world" slot="world"></div>
        <div class="consumer-overlay" slot="overlay"><slot name="overlay"></slot></div>
      </fd-canvas>
    `
  }

  override firstUpdated(): void {
    this.activateBackend()
    this.rebuildSnapshot()
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('renderingBackend') && this.activeBackendSource !== this.renderingBackend) {
      this.activateBackend()
    }
    if (changed.has('snapshot') && this.indexedSnapshot !== this.snapshot) this.rebuildSnapshot()
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
    if (this.renderFrameRequest !== undefined) cancelAnimationFrame(this.renderFrameRequest)
    this.renderFrameRequest = undefined
    this.backend?.unmount()
    this.activeBackendSource = undefined
    super.disconnectedCallback()
  }

  setZoom(zoom: number, options: FdCanvasTransformOptions = {}): void {
    this.canvas.setZoom(zoom, options)
  }

  focusRect(rect: FdCanvasRect, zoom?: number, options: FdCanvasTransformOptions = {}): void {
    this.canvas.focusRect(rect, zoom, options)
  }

  focusNode(nodeID: string | number, zoom?: number, options: FdCanvasTransformOptions = {}): void {
    const node = this.index.nodes.get(nodeID)
    if (!node) return
    this.canvas.focusRect(node.frame, zoom, options)
  }

  fit(padding = 64, maximumZoom = 1, options: FdCanvasTransformOptions = {}): void {
    this.canvas.fitRect(this.index.contentBounds, padding, maximumZoom, options)
  }

  restore(options: FdCanvasTransformOptions = {}): void {
    this.canvas.restore(options)
  }

  private activateBackend(): void {
    if (!this.renderViewport || !this.renderWorld) return
    this.backend?.unmount()
    this.backend =
      typeof this.renderingBackend === 'string'
        ? new FdGraphDOMRenderingBackend()
        : this.renderingBackend
    this.activeBackendSource = this.renderingBackend
    this.backend.mount({ viewport: this.renderViewport, world: this.renderWorld })
    this.scheduleRenderFrame()
  }

  private rebuildSnapshot(): void {
    this.index = new FdGraphSnapshotIndex(this.snapshot)
    this.indexedSnapshot = this.snapshot
    this.snapshotRevision += 1
    if (!this.canvas) return
    this.canvas.contentRect = this.index.contentBounds
    this.refreshVisibleElements(this.canvas.renderWorldRect)
  }

  private handleRenderWorldRectChange(event: CustomEvent<{ readonly rect: FdCanvasRect }>): void {
    this.refreshVisibleElements(event.detail.rect)
  }

  private handleViewportChange(event: CustomEvent<FdCanvasViewportChangeDetail>): void {
    if (event.target !== this.canvas) return
    this.scheduleRenderFrame()
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
    const nodes: FdGraphRenderNode[] = this.visibleNodes.map((node) => ({
      node,
      frame: node.frame,
      selected: false,
      focused: false,
      hovered: false,
    }))
    const edges: FdGraphRenderEdge[] = this.visibleEdges.map((edge) => ({
      edge,
      source: this.index.endpointPoint(edge, 'source'),
      target: this.index.endpointPoint(edge, 'target'),
      selected: false,
      hovered: false,
    }))
    const frame: FdGraphRenderFrame = {
      snapshotID: this.snapshot.id,
      snapshotRevision: this.snapshotRevision,
      presentationRevision: this.presentationRevision,
      viewport: this.canvas.viewport,
      renderWorldRect: this.renderWorldRect,
      nodes,
      edges,
      selectedNodeIDs: new Set(),
      pixelRatio: window.devicePixelRatio,
    }
    this.backend.render(frame)
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-graph-canvas': FdGraphCanvas
  }
}
