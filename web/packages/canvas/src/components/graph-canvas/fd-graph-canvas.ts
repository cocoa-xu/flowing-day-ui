import { type CSSResultGroup, css, html, LitElement, nothing, type PropertyValues } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import {
  type FdGraphAccessibilityCommand,
  type FdResolvedGraphCanvasAccessibilityConfiguration,
  resolveGraphCanvasAccessibilityConfiguration,
} from '../../accessibility/configuration.js'
import type { FdGraphAccessibilityActionDetail } from '../../accessibility/events.js'
import {
  createGraphAccessibilitySnapshot,
  FdGraphAccessibilitySnapshot,
} from '../../accessibility/snapshot.js'
import type { FdCanvasContentChangeBehavior, FdCanvasRequest } from '../../configuration.js'
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
import {
  type FdGraphCanvasConfiguration,
  type FdResolvedGraphCanvasConfiguration,
  resolveGraphCanvasConfiguration,
} from '../../graph/configuration.js'
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
import {
  type FdGraphCanvasInteractionPolicy,
  type FdGraphCanvasNodeCapabilities,
  type FdGraphCanvasResizeEdges,
  graphCanvasNodeCapabilities,
  graphCanvasNodeSizeConstraints,
} from '../../graph/interaction-policy.js'
import type { FdGraphMiniMapNavigationDetail } from '../../graph/minimap-events.js'
import type {
  FdAnyGraphEdge,
  FdAnyGraphNode,
  FdAnyGraphSnapshot,
  FdGraphElementID,
  FdGraphElementReference,
} from '../../graph/model.js'
import {
  graphEdgeReference,
  graphElementIDFromKey,
  graphElementKey,
  graphElementReferenceKey,
  graphNodeReference,
  graphPortPoint,
  graphPortReference,
} from '../../graph/model.js'
import type { FdGraphCanvasPlatformAdapter } from '../../graph/platform-adapter.js'
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
  type FdGraphResizeHandle,
  graphArrangementTranslations,
  graphSelectionBounds,
} from '../../interactions/arrangement.js'
import type {
  FdGraphCanvasTool,
  FdResolvedGraphCanvasInteractionConfiguration,
} from '../../interactions/configuration.js'
import {
  admittedGraphNodeIDs,
  resolveGraphCanvasInteractionConfiguration,
} from '../../interactions/configuration.js'
import {
  type FdGraphCanvasConnectionOrigin,
  type FdGraphCanvasConnectionResolution,
  type FdGraphCanvasTransientConnection,
  type FdResolvedGraphConnectionEditingConfiguration,
  resolveGraphConnectionEditingConfiguration,
} from '../../interactions/connection.js'
import {
  type FdGraphKeyboardCommand,
  type FdGraphKeyboardNavigationCandidate,
  type FdGraphNavigationDirection,
  type FdResolvedGraphCanvasKeyboardConfiguration,
  graphKeyboardTranslation,
  nextGraphKeyboardNodeID,
  resolveGraphCanvasKeyboardConfiguration,
} from '../../interactions/keyboard.js'
import type { FdGraphJumpToElementOptions } from '../../interactions/navigation.js'
import {
  type FdGraphSelectionMode,
  graphCubicEdgeDistance,
  graphSelectionMode,
} from '../../interactions/selection.js'
import type {
  FdGraphMiniMapConfiguration,
  FdGraphMiniMapPlacement,
  FdGraphMiniMapStyle,
} from '../../minimap/configuration.js'
import type {
  FdGraphCanvasRenderingBackendPreference,
  FdGraphRenderFrame,
  FdGraphRenderingBackend,
} from '../../rendering/backend.js'
import {
  graphCanvasRenderingBackendCapabilities,
  resolveGraphCanvasRenderingBackend,
} from '../../rendering/backend.js'
import { FdGraphDOMRenderingBackend } from '../../rendering/dom-backend.js'
import {
  defaultGraphEdgeGeometryResolver,
  type FdGraphEdgeGeometryResolver,
} from '../../rendering/edge-geometry.js'
import { FdGraphRenderGeometryCache } from '../../rendering/frame-cache.js'
import {
  FdGraphDefaultGuideRenderer,
  type FdGraphGuideRenderer,
} from '../../rendering/guide-renderer.js'
import {
  FdGraphWebGL2RenderingBackend,
  type FdGraphWebGL2RenderingBackendConfiguration,
} from '../../rendering/webgl2-backend.js'
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
const edgeHitTestMaximumCandidates = 512
const edgeHitTestViewportTolerance = 8
const edgeHitTestMinimumTolerance = 6
const edgeHitTestPadding = 4

const graphCanvasResizeEdges = (handle: FdGraphResizeHandle): FdGraphCanvasResizeEdges => {
  switch (handle) {
    case 'top':
      return new Set(['top'])
    case 'topRight':
      return new Set(['top', 'trailing'])
    case 'right':
      return new Set(['trailing'])
    case 'bottomRight':
      return new Set(['bottom', 'trailing'])
    case 'bottom':
      return new Set(['bottom'])
    case 'bottomLeft':
      return new Set(['bottom', 'leading'])
    case 'left':
      return new Set(['leading'])
    case 'topLeft':
      return new Set(['top', 'leading'])
  }
}
const minimumElementFocusFrameSize = 22
const suppressedConnectionClickDuration = 500
const suppressedConnectionClickTolerance = 4

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
    .graph-edge-label-layer,
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
    .graph-edge-label-layer,
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
      pointer-events: stroke;
    }

    .graph-edge[data-dashed] {
      stroke-dasharray: 7 6;
    }

    .graph-edge[data-selected] {
      stroke: var(--fd-canvas-accent-color, #6d9ea5);
    }

    .graph-edge[data-focused] {
      stroke: var(--fd-graph-focus-color, var(--fd-canvas-focus-color, Highlight));
    }

    .graph-edge-arrow {
      fill: var(--fd-graph-edge-color, var(--fd-canvas-edge-color, #aeb5af));
      pointer-events: auto;
    }

    .graph-edge-arrow[data-selected] {
      fill: var(--fd-canvas-accent-color, #6d9ea5);
    }

    .graph-edge-arrow[data-focused] {
      fill: var(--fd-graph-focus-color, var(--fd-canvas-focus-color, Highlight));
    }

    .graph-edge-label {
      position: absolute;
      display: block;
      color: var(--fd-graph-edge-color, var(--fd-canvas-secondary-color, #737872));
      font: 500 11px system-ui, sans-serif;
      pointer-events: auto;
      text-shadow:
        -2px -2px 0 var(--fd-canvas-surface-color, #fff),
        2px -2px 0 var(--fd-canvas-surface-color, #fff),
        -2px 2px 0 var(--fd-canvas-surface-color, #fff),
        2px 2px 0 var(--fd-canvas-surface-color, #fff);
      transform-origin: center;
      white-space: nowrap;
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

    .graph-port[data-selected] {
      box-shadow:
        0 0 0 1px var(--fd-canvas-node-border-color, #d7dcd8),
        0 0 0 4px color-mix(in srgb, var(--fd-canvas-accent-color, #6d9ea5) 24%, transparent);
    }

    .graph-port[data-focused] {
      outline: 2px solid var(--fd-graph-focus-color, var(--fd-canvas-focus-color, Highlight));
      outline-offset: 3px;
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
    .graph-guide,
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

    .graph-guide {
      --_fd-graph-guide-color: var(
        --fd-graph-guide-color,
        var(--fd-canvas-accent-color, #6d9ea5)
      );

      pointer-events: none;
      user-select: none;
    }

    .guide-line,
    .guide-tick,
    .guide-label {
      position: absolute;
      box-sizing: border-box;
    }

    .graph-guide[data-axis='horizontal'] .guide-line {
      top: calc(-0.5 * var(--fd-graph-world-pixel));
      right: 0;
      left: 0;
      height: var(--fd-graph-world-pixel);
      background: var(--_fd-graph-guide-color);
    }

    .graph-guide[data-axis='vertical'] .guide-line {
      top: 0;
      bottom: 0;
      left: calc(-0.5 * var(--fd-graph-world-pixel));
      width: var(--fd-graph-world-pixel);
      background: var(--_fd-graph-guide-color);
    }

    .graph-guide[data-kind='grid'][data-axis='horizontal'] .guide-line {
      background: repeating-linear-gradient(
        to right,
        var(--_fd-graph-guide-color) 0,
        var(--_fd-graph-guide-color) calc(3 * var(--fd-graph-world-pixel)),
        transparent calc(3 * var(--fd-graph-world-pixel)),
        transparent calc(6 * var(--fd-graph-world-pixel))
      );
    }

    .graph-guide[data-kind='grid'][data-axis='vertical'] .guide-line {
      background: repeating-linear-gradient(
        to bottom,
        var(--_fd-graph-guide-color) 0,
        var(--_fd-graph-guide-color) calc(3 * var(--fd-graph-world-pixel)),
        transparent calc(3 * var(--fd-graph-world-pixel)),
        transparent calc(6 * var(--fd-graph-world-pixel))
      );
    }

    .guide-tick {
      background: var(--_fd-graph-guide-color);
    }

    .graph-guide[data-axis='horizontal'] .guide-tick {
      top: calc(-3.5 * var(--fd-graph-world-pixel));
      width: var(--fd-graph-world-pixel);
      height: calc(7 * var(--fd-graph-world-pixel));
    }

    .graph-guide[data-axis='vertical'] .guide-tick {
      left: calc(-3.5 * var(--fd-graph-world-pixel));
      width: calc(7 * var(--fd-graph-world-pixel));
      height: var(--fd-graph-world-pixel);
    }

    .graph-guide[data-axis='horizontal'] .guide-tick-start {
      left: 0;
    }

    .graph-guide[data-axis='vertical'] .guide-tick-start {
      top: 0;
    }

    .graph-guide[data-axis='horizontal'] .guide-tick-end {
      right: 0;
    }

    .graph-guide[data-axis='vertical'] .guide-tick-end {
      bottom: 0;
    }

    .guide-label {
      top: 50%;
      left: 50%;
      padding: calc(2 * var(--fd-graph-world-pixel))
        calc(5 * var(--fd-graph-world-pixel));
      border-radius: calc(999 * var(--fd-graph-world-pixel));
      background: var(--fd-graph-guide-label-background, var(--_fd-graph-guide-color));
      color: var(--fd-graph-guide-label-color, white);
      font-size: calc(9 * var(--fd-graph-world-pixel));
      font-weight: 600;
      line-height: 1.2;
      transform: translate(-50%, -50%);
      white-space: nowrap;
    }

    .guide-tick[hidden],
    .guide-label[hidden],
    .graph-guide[hidden] {
      display: none;
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
  @property({ attribute: false }) configuration: FdGraphCanvasConfiguration = {}
  @property({ attribute: false }) contentInsets: FdCanvasInsets = zeroCanvasInsets
  @property({ attribute: false }) contentChangeBehavior: FdCanvasContentChangeBehavior = {
    kind: 'preserveViewport',
  }
  @property({ attribute: false }) request: FdCanvasRequest | undefined
  @property({ attribute: false }) renderingAdapter: FdGraphRenderingBackend | undefined
  @property({ attribute: false })
  renderingConfiguration: FdGraphWebGL2RenderingBackendConfiguration = {}
  @property({ attribute: false }) edgeGeometryResolver: FdGraphEdgeGeometryResolver =
    defaultGraphEdgeGeometryResolver
  @property({ reflect: true }) tool: FdGraphCanvasTool = 'select'
  @property({ attribute: false }) interactionPolicy: FdGraphCanvasInteractionPolicy = {}
  @property({ attribute: false }) platformAdapter: FdGraphCanvasPlatformAdapter = {}
  @property({ attribute: false }) historyConfiguration: FdGraphCanvasHistoryConfiguration = {}
  @property({ attribute: false }) miniMapConfiguration: FdGraphMiniMapConfiguration | undefined
  @property({ attribute: false }) miniMapStyle: FdGraphMiniMapStyle = {}
  @property({ attribute: false }) miniMapPlacement: FdGraphMiniMapPlacement = 'bottomTrailing'
  @property({ attribute: false }) miniMapInsets: FdCanvasInsets = {
    top: 16,
    right: 16,
    bottom: 16,
    left: 16,
  }
  @property({ attribute: false }) miniMapNodeStyleIndex: (node: FdAnyGraphNode) => number = () => 0
  @property({ attribute: false }) guideRenderer: FdGraphGuideRenderer =
    new FdGraphDefaultGuideRenderer()

  @property({ attribute: false })
  get selectedElements(): readonly FdGraphElementReference[] {
    return this.selectedElementValues
  }

  set selectedElements(value: readonly FdGraphElementReference[]) {
    const previousElements = this.selectedElementValues
    const previousNodeIDs = this.selectionValue
    this.assignSelection(value)
    if (!this.referenceArraysEqual(previousElements, this.selectedElementValues)) {
      this.requestUpdate('selectedElements', previousElements)
    }
    if (!this.setsEqual(previousNodeIDs, this.selectionValue)) {
      this.requestUpdate('selectedNodeIDs', previousNodeIDs)
    }
  }

  nodeCapabilities(nodeID: FdGraphElementID): Required<FdGraphCanvasNodeCapabilities> {
    return graphCanvasNodeCapabilities(this.interactionPolicy, nodeID)
  }

  @property({ attribute: false })
  get selectedNodeIDs(): ReadonlySet<FdGraphElementID> {
    return this.selectionValue
  }

  set selectedNodeIDs(value: ReadonlySet<FdGraphElementID>) {
    this.selectedElements = [...value].map(graphNodeReference)
  }

  @property({ attribute: false })
  get focusedElement(): FdGraphElementReference | undefined {
    return this.focusedElementValue
  }

  set focusedElement(value: FdGraphElementReference | undefined) {
    const previousElement = this.focusedElementValue
    const previousNodeID = this.focusedNodeValue
    if (this.referencesEqual(previousElement, value)) return
    this.focusedElementValue = value
    this.focusedNodeValue = value?.kind === 'node' ? value.nodeID : undefined
    if (value) {
      const key = graphElementReferenceKey(value)
      if (this.accessibilitySnapshot.contains(key)) this.accessibilityFocusedElementKey = key
    }
    this.requestUpdate('focusedElement', previousElement)
    if (previousNodeID !== this.focusedNodeValue) {
      this.requestUpdate('focusedNodeID', previousNodeID)
    }
  }

  @property({ attribute: false })
  get focusedNodeID(): FdGraphElementID | undefined {
    return this.focusedNodeValue
  }

  set focusedNodeID(value: FdGraphElementID | undefined) {
    this.focusedElement = value === undefined ? undefined : graphNodeReference(value)
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
  private resolvedGraphConfiguration: FdResolvedGraphCanvasConfiguration =
    resolveGraphCanvasConfiguration()
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
  private selectedElementValues: readonly FdGraphElementReference[] = []
  private selectedElementKeys = new Set<string>()
  private selectionValue: ReadonlySet<FdGraphElementID> = new Set()
  private selectedEdgeIDsValue: ReadonlySet<FdGraphElementID> = new Set()
  private selectedPortIDsByNodeValue: ReadonlyMap<FdGraphElementID, ReadonlySet<FdGraphElementID>> =
    new Map()
  private focusedElementValue: FdGraphElementReference | undefined
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
    | FdGraphCanvasRenderingBackendPreference
    | FdGraphRenderingBackend
    | undefined
  private indexedSnapshot: FdAnyGraphSnapshot | undefined
  private keyboardTransactionSequence = 0
  private arrangementTransactionSequence = 0
  private historyTransactionSequence = 0
  private readonly connectionPortElements = new Set<HTMLElement>()
  private suppressedConnectionClick:
    | { readonly clientX: number; readonly clientY: number; readonly timestamp: number }
    | undefined
  private guideElements: HTMLElement[] = []

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

  performFocusedAccessibilityAction(actionID: string): boolean {
    return this.performAccessibilityElementAction(this.accessibilityFocusedElementKey, actionID)
  }

  override render() {
    return html`
      <fd-canvas
        exportparts="viewport:canvas-viewport"
        interaction-mode=${this.tool === 'pan' ? 'pan' : 'content'}
        .configuration=${this.resolvedGraphConfiguration.canvas}
        .contentID=${this.snapshot.id}
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
                .miniMapStyle=${this.miniMapStyle}
                .placement=${this.miniMapPlacement}
                .overlayInsets=${this.miniMapInsets}
                .nodeStyleIndex=${this.miniMapNodeStyleIndex}
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
    this.canvas.addEventListener('click', this.handleGraphClick, { capture: true })
    this.activateBackend()
    this.rebuildSnapshot()
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (
      changed.has('configuration') ||
      changed.has('interactionPolicy') ||
      changed.has('platformAdapter')
    ) {
      this.resolveConfiguredBehavior()
    }
    if (changed.has('historyConfiguration')) {
      this.resolvedHistoryConfiguration = resolveGraphCanvasHistoryConfiguration(
        this.historyConfiguration,
      )
      this.historyDriver = this.createHistoryDriver()
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (
      (changed.has('configuration') || changed.has('renderingAdapter')) &&
      this.activeBackendSource !== this.renderingBackendSource
    ) {
      this.activateBackend()
    }
    if (changed.has('renderingConfiguration') && !this.renderingAdapter) {
      this.activateBackend()
    }
    if (changed.has('edgeGeometryResolver')) {
      this.renderGeometryCache.invalidate()
      this.presentationRevision += 1
      this.scheduleRenderFrame()
    }
    if (changed.has('snapshot') && this.indexedSnapshot !== this.snapshot) {
      this.localSnapshotBaseID = undefined
      this.localSnapshotSequence = 0
      this.rebuildSnapshot()
    }
    if (changed.has('configuration') || changed.has('interactionPolicy')) {
      this.interactionController?.cancel()
      this.refreshResizeHandleVisibility()
      this.syncInteractionOverlay()
      this.syncAccessibilityBridge()
    }
    if (changed.has('configuration') || changed.has('interactionPolicy')) {
      this.connectionController?.cancel()
      this.syncPortHitPadding()
    }
    if (
      (changed.has('configuration') || changed.has('platformAdapter')) &&
      !changed.has('snapshot')
    ) {
      this.rebuildAccessibilitySnapshot()
    }
    if (changed.has('selectedElements') || changed.has('selectedNodeIDs')) {
      this.reconcileSelection()
      this.refreshResizeHandleVisibility()
      this.presentationRevision += 1
      this.syncInteractionOverlay()
      this.syncAccessibilityBridge()
      this.scheduleRenderFrame()
    }
    if (changed.has('focusedElement') || changed.has('focusedNodeID')) {
      this.reconcileKeyboardFocus()
      this.presentationRevision += 1
      this.syncAccessibilityBridge()
      this.scheduleRenderFrame()
    }
    if (changed.has('tool')) {
      this.interactionController?.cancel()
      this.connectionController?.cancel()
    }
    if (changed.has('guideRenderer')) {
      this.guideElements = []
      this.guideLayer.replaceChildren()
      this.syncGuides(this.interactionPresentation.guides)
    }
    if (
      changed.has('miniMapConfiguration') ||
      changed.has('miniMapStyle') ||
      changed.has('miniMapPlacement') ||
      changed.has('miniMapInsets') ||
      changed.has('miniMapNodeStyleIndex')
    ) {
      this.syncMiniMap()
    }
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
    if (selection !== 'preserve' && this.resolvedInteractionConfiguration.selection !== 'none') {
      const selectedNodeIDs =
        selection === 'add' && this.resolvedInteractionConfiguration.selection === 'multiple'
          ? new Set(this.selectedNodeIDs)
          : new Set<FdGraphElementID>()
      selectedNodeIDs.add(nodeID)
      this.setSelection(selectedNodeIDs, selection === 'add' ? 'extend' : 'replace', {
        phase: 'ended',
        source: 'programmatic',
      })
    }
    this.setFocusedNode(nodeID, 'programmatic', false, false)
    this.canvas.focusRect(node.frame, options.zoom, { animated: options.animated ?? true })
    return true
  }

  arrangeSelectedNodes(action: FdGraphArrangementAction): boolean {
    if (!this.resolvedGraphConfiguration.allowsArrangementCommands) return false
    const nodes = [...this.selectedNodeIDs].flatMap((id) => {
      const node = this.index.nodes.get(id)
      return node && this.nodeCapabilities(node.id).arrangementParticipant ? [node] : []
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

  beginConnection(origin: FdGraphCanvasConnectionOrigin): boolean {
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

  viewportPoint(event: MouseEvent): FdCanvasPoint {
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
    mode: FdGraphSelectionMode,
    detail: Omit<FdGraphSelectionChangeDetail, 'selectedElements' | 'selectedNodeIDs'>,
  ): void {
    const nonNodes =
      mode !== 'replace' && this.resolvedInteractionConfiguration.selection === 'multiple'
        ? this.selectedElements.filter((reference) => reference.kind !== 'node')
        : []
    this.setElementSelection([...nonNodes, ...[...selection].map(graphNodeReference)], detail)
  }

  private selectElementReference(
    reference: FdGraphElementReference,
    mode: FdGraphSelectionMode,
    source: FdGraphSelectionChangeDetail['source'],
  ): boolean {
    const behavior = this.resolvedInteractionConfiguration.selection
    if (behavior === 'none' || !this.validElementReference(reference)) {
      return false
    }
    const key = graphElementReferenceKey(reference)
    let selection: readonly FdGraphElementReference[]
    if (behavior === 'single' || mode === 'replace') {
      selection = [reference]
    } else if (mode === 'toggle' && this.selectedElementKeys.has(key)) {
      selection = this.selectedElements.filter(
        (candidate) => graphElementReferenceKey(candidate) !== key,
      )
    } else {
      selection = [...this.selectedElements, reference]
    }
    this.setElementSelection(selection, { phase: 'ended', source })
    this.setFocusedElement(reference, source, false)
    return true
  }

  private setElementSelection(
    selection: readonly FdGraphElementReference[],
    detail: Omit<FdGraphSelectionChangeDetail, 'selectedElements' | 'selectedNodeIDs'>,
  ): void {
    const previousKeys = this.selectedElementKeys
    this.assignSelection(selection)
    const changed = !this.setsEqual(previousKeys, this.selectedElementKeys)
    if (changed) {
      this.refreshResizeHandleVisibility()
      this.presentationRevision += 1
      this.syncInteractionOverlay()
      this.syncAccessibilityBridge()
      this.scheduleRenderFrame()
    }
    if (!changed && detail.phase === 'continuous') return
    this.dispatchEvent(
      new CustomEvent<FdGraphSelectionChangeDetail>('fd-graph-selection-change', {
        detail: {
          ...detail,
          selectedElements: this.selectedElements,
          selectedNodeIDs: this.selectedNodeIDs,
        },
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
      const clickedEndpoint = this.connectionController.pointerEnd(event)
      if (clickedEndpoint) {
        this.selectElementReference(
          graphPortReference(clickedEndpoint.nodeID, clickedEndpoint.portID),
          graphSelectionMode(event.shiftKey, event.metaKey, event.ctrlKey),
          'pointer',
        )
        this.suppressedConnectionClick = {
          clientX: event.clientX,
          clientY: event.clientY,
          timestamp: performance.now(),
        }
      }
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

  private handleGraphClick = (event: MouseEvent): void => {
    if (this.tool !== 'select' || event.button !== 0) return
    const suppressed = this.suppressedConnectionClick
    this.suppressedConnectionClick = undefined
    if (
      suppressed &&
      performance.now() - suppressed.timestamp < suppressedConnectionClickDuration &&
      Math.hypot(event.clientX - suppressed.clientX, event.clientY - suppressed.clientY) <
        suppressedConnectionClickTolerance
    ) {
      return
    }
    const path = event.composedPath()
    if (
      path.some(
        (candidate) =>
          candidate instanceof Element &&
          candidate.matches(
            'button, input, select, textarea, a[href], [contenteditable="true"], fd-graph-minimap',
          ),
      )
    ) {
      return
    }
    const explicit = this.elementReference(path)
    if (explicit?.kind === 'node') return
    const reference = explicit ?? this.edgeReferenceAtViewportPoint(this.viewportPoint(event))
    if (!reference) return
    this.selectElementReference(
      reference,
      graphSelectionMode(event.shiftKey, event.metaKey, event.ctrlKey),
      'pointer',
    )
  }

  private elementReference(path: readonly EventTarget[]): FdGraphElementReference | undefined {
    for (const candidate of path) {
      if (!(candidate instanceof HTMLElement || candidate instanceof SVGElement)) continue
      const nodeKey = candidate.dataset.fdGraphNode
      const portKey = candidate.dataset.fdGraphPort
      if (nodeKey && portKey) {
        const nodeID = graphElementIDFromKey(nodeKey)
        const portID = graphElementIDFromKey(portKey)
        if (nodeID !== undefined && portID !== undefined) {
          return graphPortReference(nodeID, portID)
        }
      }
      const edgeKey = candidate.dataset.fdGraphEdge
      if (edgeKey) {
        const edgeID = graphElementIDFromKey(edgeKey)
        if (edgeID !== undefined) return graphEdgeReference(edgeID)
      }
      if (nodeKey) {
        const nodeID = graphElementIDFromKey(nodeKey)
        if (nodeID !== undefined) return graphNodeReference(nodeID)
      }
    }
    return undefined
  }

  private edgeReferenceAtViewportPoint(
    viewportPoint: FdCanvasPoint,
  ): FdGraphElementReference | undefined {
    const zoom = this.canvas.viewport.transform.zoom
    const worldPoint = this.canvas.viewport.transform.removePoint(viewportPoint)
    const tolerance = edgeHitTestViewportTolerance / zoom
    const candidates = this.index.edgesIn(
      {
        x: worldPoint.x - tolerance,
        y: worldPoint.y - tolerance,
        width: tolerance * 2,
        height: tolerance * 2,
      },
      { maximumCount: edgeHitTestMaximumCandidates },
    )
    let nearest: { readonly edgeID: FdGraphElementID; readonly distance: number } | undefined
    for (const edge of candidates) {
      const source = this.endpointPoint(edge, 'source')
      const target = this.endpointPoint(edge, 'target')
      const distance = graphCubicEdgeDistance(
        worldPoint,
        this.edgeGeometryResolver({ edge, source, target }),
      )
      const hitTolerance =
        Math.max(edgeHitTestMinimumTolerance, (edge.style?.width ?? 2) / 2 + edgeHitTestPadding) /
        zoom
      if (distance > hitTolerance || (nearest && nearest.distance <= distance)) continue
      nearest = { edgeID: edge.id, distance }
    }
    return nearest ? graphEdgeReference(nearest.edgeID) : undefined
  }

  private resolveConfiguredBehavior(): void {
    const configuration = resolveGraphCanvasConfiguration(this.configuration)
    const policy = this.interactionPolicy
    const targets = configuration.snapping.targets
    const grid = configuration.snapping.grid
    const subdivisions = grid?.subdivisions ?? {}
    this.resolvedGraphConfiguration = configuration
    this.resolvedInteractionConfiguration = resolveGraphCanvasInteractionConfiguration({
      nodeDragging: configuration.nodeDraggingMode !== 'disabled',
      multipleNodeDragging: configuration.nodeDraggingMode === 'multiple',
      nodeResizing: configuration.nodeResizing.isEnabled,
      groupResizing: true,
      minimumNodeWidth: configuration.nodeResizing.minimumSize.width,
      minimumNodeHeight: configuration.nodeResizing.minimumSize.height,
      nodeSizeConstraints: (node) => {
        const constraints = graphCanvasNodeSizeConstraints(policy, node.id)
        if (!constraints) return undefined
        return {
          ...(constraints.minimumSize
            ? {
                minimumWidth: constraints.minimumSize.width,
                minimumHeight: constraints.minimumSize.height,
              }
            : {}),
          ...(constraints.maximumSize
            ? {
                maximumWidth: constraints.maximumSize.width,
                maximumHeight: constraints.maximumSize.height,
              }
            : {}),
        }
      },
      marqueeMinimumDistance: configuration.marqueeMinimumDistance,
      snapping: {
        enabled: configuration.snapping.isEnabled,
        alignment: targets.has('alignment'),
        equalSpacing: targets.has('equalSpacing'),
        equalSize: targets.has('equalSize'),
        ...(grid
          ? {
              grid: {
                enabled: targets.has('grid'),
                width: grid.majorCellSize.width / (subdivisions.x ?? 1),
                height: grid.majorCellSize.height / (subdivisions.y ?? 1),
                originX: grid.origin?.x ?? 0,
                originY: grid.origin?.y ?? 0,
                snapsX: grid.enabledAxes?.has('x') ?? true,
                snapsY: grid.enabledAxes?.has('y') ?? true,
                rounding: grid.roundingPolicy ?? 'nearest',
              },
            }
          : {}),
        acquisitionDistance: configuration.snapping.tolerance,
        releaseDistance: configuration.snapping.releaseTolerance,
        searchRadius: configuration.snapping.searchRadius,
        maximumCandidates: configuration.snapping.maximumCandidates,
        showsGuides: configuration.snapping.showsGuides,
        guideOffset: configuration.snapping.guideOffset,
      },
      ...(policy.snappingStrategy ? { snappingStrategy: policy.snappingStrategy } : {}),
      admitNodeDrag: (request) =>
        policy.admitNodeDrag?.({
          anchorNodeID: request.anchorNode.id,
          selectedNodeIDs: request.selectedNodes.map(({ id }) => id),
          candidateNodeIDs: request.candidateNodes.map(({ id }) => id),
          basePresentationSnapshotID: request.snapshotID,
        }) ?? { kind: 'allowAll' },
      admitNodeResize: (request) =>
        policy.admitNodeResize?.({
          anchorNodeID: request.anchorNode.id,
          selectedNodeIDs: request.selectedNodes.map(({ id }) => id),
          candidateNodeIDs: request.candidateNodes.map(({ id }) => id),
          baseFrames: request.baseFrames,
          edges: graphCanvasResizeEdges(request.handle),
          basePresentationSnapshotID: request.snapshotID,
        }) ?? { kind: 'allowAll' },
    })
    this.connectionConfiguration = resolveGraphConnectionEditingConfiguration({
      ...policy.connectionPolicy,
      enabled: configuration.connectionEditing.isEnabled,
      allowsReconnection: configuration.connectionEditing.allowsReconnection,
      targetHitRadius: configuration.connectionEditing.targetHitRadius,
      sourceHitPadding: configuration.connectionEditing.sourceHitPadding,
      minimumDragDistance: configuration.connectionEditing.minimumDragDistance,
      rendersDefaultPreview: configuration.connectionEditing.rendersDefaultPreview,
    })
    const navigation = configuration.keyboardNavigation
    const nudging = configuration.keyboardNudging
    this.resolvedKeyboardConfiguration = resolveGraphCanvasKeyboardConfiguration({
      enabled: navigation.isEnabled || nudging.isEnabled,
      navigation: navigation.isEnabled,
      nudging: nudging.isEnabled,
      nudgeStep: nudging.step,
      largeNudgeStep: nudging.largeStep,
      selectionBehavior: navigation.selectionBehavior,
      keepsFocusedNodeVisible: navigation.keepsFocusedNodeVisible,
      ...(this.platformAdapter.resolveKeyboardCommand
        ? { resolveCommand: this.platformAdapter.resolveKeyboardCommand }
        : {}),
    })
    this.resolvedAccessibilityConfiguration = resolveGraphCanvasAccessibilityConfiguration(
      configuration.accessibility,
      this.platformAdapter,
    )
  }

  private activateBackend(): void {
    if (!this.renderViewport || !this.renderWorld) return
    this.backend?.unmount()
    const source = this.renderingBackendSource
    if (typeof source === 'string') {
      const kind = resolveGraphCanvasRenderingBackend(
        source,
        graphCanvasRenderingBackendCapabilities(),
      )
      this.backend =
        kind === 'webgl2'
          ? new FdGraphWebGL2RenderingBackend(this.renderingConfiguration)
          : new FdGraphDOMRenderingBackend(this.renderingConfiguration)
    } else this.backend = source
    this.activeBackendSource = source
    this.backend.mount({ viewport: this.renderViewport, world: this.renderWorld })
    this.scheduleRenderFrame()
  }

  private get renderingBackendSource():
    | FdGraphCanvasRenderingBackendPreference
    | FdGraphRenderingBackend {
    return this.renderingAdapter ?? this.resolvedGraphConfiguration.renderingBackend
  }

  private rebuildSnapshot(): void {
    this.interactionController?.cancel()
    if (
      this.connectionController?.activeConnection &&
      this.connectionController.activeConnection.basePresentationSnapshotID !== this.snapshot.id
    ) {
      this.connectionController.cancel()
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
      if (!this.nodeCapabilities(node.id).keyboardNavigable) continue
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
    const valid = this.selectedElements.filter((reference) => this.validElementReference(reference))
    const next =
      this.resolvedInteractionConfiguration.selection === 'none'
        ? []
        : this.resolvedInteractionConfiguration.selection === 'single'
          ? valid.slice(0, 1)
          : valid
    if (!this.referenceArraysEqual(this.selectedElements, next)) this.assignSelection(next)
  }

  private reconcileKeyboardFocus(): void {
    const reference = this.focusedElement
    if (!reference) return
    if (
      this.validElementReference(reference) &&
      (reference.kind !== 'node' || this.nodeCapabilities(reference.nodeID).keyboardNavigable)
    ) {
      return
    }
    this.focusedElementValue = undefined
    this.focusedNodeValue = undefined
  }

  private rebuildAccessibilitySnapshot(): void {
    this.accessibilitySnapshot = createGraphAccessibilitySnapshot(
      this.snapshot,
      this.resolvedAccessibilityConfiguration,
    )
    this.accessibilityFocusedElementKey = this.accessibilitySnapshot.reconciledFocus(
      (this.focusedElement && graphElementReferenceKey(this.focusedElement)) ??
        this.accessibilityFocusedElementKey,
    )
    this.syncAccessibilityBridge()
  }

  private syncAccessibilityBridge(): void {
    this.accessibilityBridge?.update({
      snapshot: this.accessibilitySnapshot,
      configuration: this.resolvedAccessibilityConfiguration,
      selectedElementKeys: this.selectedElementKeys,
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
        (this.focusedElement ? graphElementReferenceKey(this.focusedElement) : undefined),
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
      case 'focusNextRelated':
        return this.focusNextRelatedAccessibilityElement(currentKey)
      case 'select':
        return this.selectAccessibilityElement(currentKey)
      case 'activate':
        return this.activateAccessibilityElement(currentKey)
      case 'perform':
        return this.performAccessibilityElementAction(currentKey, command.actionID)
      case 'move':
        return this.moveAccessibilityElement(currentKey, command.direction, command.large)
    }
  }

  private focusNextRelatedAccessibilityElement(key: string | undefined): boolean {
    if (!key || !this.resolvedAccessibilityConfiguration.capabilities.connections) return false
    return this.focusAccessibilityElement(this.accessibilitySnapshot.relatedElementKeys(key)[0])
  }

  private focusAccessibilityElement(key: string | undefined): boolean {
    if (!key || !this.resolvedAccessibilityConfiguration.capabilities.focusNavigation) return false
    const item = this.accessibilitySnapshot.item(key)
    if (!item) return false
    if (!this.dispatchAccessibilityAction(item.reference, { kind: 'focus' })) return true
    this.accessibilityFocusedElementKey = key
    this.setFocusedElement(
      item.reference,
      'accessibility',
      this.resolvedAccessibilityConfiguration.keepsFocusedElementVisible,
    )
    this.syncAccessibilityBridge()
    this.scheduleRenderFrame()
    return true
  }

  private selectAccessibilityElement(key: string | undefined): boolean {
    if (!key || !this.resolvedAccessibilityConfiguration.capabilities.selection) return false
    const item = this.accessibilitySnapshot.item(key)
    if (!item) return false
    if (!this.dispatchAccessibilityAction(item.reference, { kind: 'select' })) return true
    return this.selectElementReference(item.reference, 'replace', 'accessibility')
  }

  private activateAccessibilityElement(key: string | undefined): boolean {
    if (!key || !this.resolvedAccessibilityConfiguration.capabilities.elementActions) return false
    const item = this.accessibilitySnapshot.item(key)
    if (!item) return false
    if (!this.dispatchAccessibilityAction(item.reference, { kind: 'activate' })) return true
    return item.kind !== 'node' || this.activateFocusedNode('accessibility')
  }

  private performAccessibilityElementAction(key: string | undefined, actionID: string): boolean {
    if (!key || !this.resolvedAccessibilityConfiguration.capabilities.elementActions) return false
    const item = this.accessibilitySnapshot.item(key)
    if (!item?.description.actions?.some(({ id }) => id === actionID)) return false
    this.dispatchAccessibilityAction(item.reference, { kind: 'perform', actionID })
    return true
  }

  private moveAccessibilityElement(
    key: string | undefined,
    direction: FdGraphNavigationDirection,
    large: boolean,
  ): boolean {
    if (!key || !this.resolvedAccessibilityConfiguration.capabilities.movement) return false
    const item = this.accessibilitySnapshot.item(key)
    if (item?.reference.kind !== 'node') return false
    const nodeID = item.reference.nodeID
    if (!this.dispatchAccessibilityAction(item.reference, { kind: 'move', direction, large })) {
      return true
    }
    if (!this.selectedNodeIDs.has(nodeID)) {
      this.setSelection(new Set([nodeID]), 'replace', {
        phase: 'ended',
        source: 'accessibility',
      })
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
        this.setSelection(new Set(), 'replace', { phase: 'ended', source: 'keyboard' })
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
    if (!node || !this.nodeCapabilities(node.id).keyboardNavigable) return
    if (updatesSelection && this.resolvedKeyboardConfiguration.selectionBehavior === 'replace') {
      this.setSelection(new Set([nodeID]), 'replace', { phase: 'ended', source: 'keyboard' })
    }
    this.setFocusedElement(graphNodeReference(nodeID), source, keepsVisible)
  }

  private setFocusedElement(
    reference: FdGraphElementReference,
    source: FdGraphFocusChangeDetail['source'],
    keepsVisible: boolean,
  ): void {
    if (!this.validElementReference(reference)) return
    const changed = !this.referencesEqual(this.focusedElement, reference)
    this.focusedElement = reference
    this.syncAccessibilityBridge()
    const frame = this.elementFrame(reference)
    if (
      keepsVisible &&
      frame &&
      !canvasRectContains(this.canvas.viewport.visibleWorldRect, frame)
    ) {
      this.canvas.focusRect(frame, this.canvas.viewport.transform.zoom)
    }
    if (!changed) return
    this.dispatchEvent(
      new CustomEvent<FdGraphFocusChangeDetail>('fd-graph-focus-change', {
        detail: {
          focusedElement: reference,
          ...(reference.kind === 'node' ? { focusedNodeID: reference.nodeID } : {}),
          source,
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private toggleFocusedSelection(): boolean {
    const nodeID = this.focusedNodeID
    if (nodeID === undefined) return false
    const selection = new Set(this.selectedNodeIDs)
    if (this.resolvedInteractionConfiguration.selection === 'single') selection.clear()
    if (selection.has(nodeID)) selection.delete(nodeID)
    else selection.add(nodeID)
    this.setSelection(selection, 'toggle', { phase: 'ended', source: 'keyboard' })
    return true
  }

  private selectAllKeyboardNodes(): boolean {
    if (this.resolvedInteractionConfiguration.selection !== 'multiple') return false
    const selection = new Set(this.keyboardCandidates.map(({ id }) => id))
    this.setSelection(selection, 'replace', { phase: 'ended', source: 'keyboard' })
    return true
  }

  private nudgeKeyboardSelection(direction: FdGraphNavigationDirection, large: boolean): boolean {
    const selectedNodes = [...this.selectedNodeIDs].flatMap((id) => {
      const node = this.index.nodes.get(id)
      return node ? [node] : []
    })
    const nodes = this.admittedKeyboardDragNodes(selectedNodes)
    if (nodes.length === 0) return false
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

  private admittedKeyboardDragNodes(
    selectedNodes: readonly FdAnyGraphNode[],
  ): readonly FdAnyGraphNode[] {
    const configuration = this.resolvedInteractionConfiguration
    if (!configuration.nodeDragging || selectedNodes.length === 0) return []
    const anchorNode = selectedNodes.find(({ id }) => id === this.focusedNodeID) ?? selectedNodes[0]
    if (!anchorNode || !this.nodeCapabilities(anchorNode.id).draggable) return []
    const candidateNodes = (
      configuration.multipleNodeDragging ? selectedNodes : [anchorNode]
    ).filter(({ id }) => this.nodeCapabilities(id).draggable)
    const request = {
      anchorNode,
      selectedNodes,
      candidateNodes,
      snapshotID: this.snapshot.id,
    }
    const admitted = admittedGraphNodeIDs(request, configuration.admitNodeDrag(request))
    return candidateNodes.filter(({ id }) => admitted.has(id))
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

  private assignSelection(selection: readonly FdGraphElementReference[]): void {
    const references = new Map<string, FdGraphElementReference>()
    for (const reference of selection) {
      const key = graphElementReferenceKey(reference)
      if (!references.has(key)) references.set(key, reference)
    }
    this.selectedElementValues = [...references.values()]
    this.selectedElementKeys = new Set(references.keys())
    this.selectionValue = new Set(
      this.selectedElementValues.flatMap((reference) =>
        reference.kind === 'node' ? [reference.nodeID] : [],
      ),
    )
    this.selectedEdgeIDsValue = new Set(
      this.selectedElementValues.flatMap((reference) =>
        reference.kind === 'edge' ? [reference.edgeID] : [],
      ),
    )
    const portIDsByNode = new Map<FdGraphElementID, Set<FdGraphElementID>>()
    for (const reference of this.selectedElementValues) {
      if (reference.kind !== 'port') continue
      const portIDs = portIDsByNode.get(reference.nodeID) ?? new Set<FdGraphElementID>()
      portIDs.add(reference.portID)
      portIDsByNode.set(reference.nodeID, portIDs)
    }
    this.selectedPortIDsByNodeValue = portIDsByNode
  }

  private referenceArraysEqual(
    first: readonly FdGraphElementReference[],
    second: readonly FdGraphElementReference[],
  ): boolean {
    if (first.length !== second.length) return false
    return first.every((reference, index) => this.referencesEqual(reference, second[index]))
  }

  private referencesEqual(
    first: FdGraphElementReference | undefined,
    second: FdGraphElementReference | undefined,
  ): boolean {
    if (!first || !second) return first === second
    return graphElementReferenceKey(first) === graphElementReferenceKey(second)
  }

  private validElementReference(reference: FdGraphElementReference): boolean {
    switch (reference.kind) {
      case 'node':
        return this.index.nodes.has(reference.nodeID)
      case 'port':
        return (
          this.index.nodes
            .get(reference.nodeID)
            ?.ports?.some(({ id }) => id === reference.portID) === true
        )
      case 'edge':
        return this.index.edges.has(reference.edgeID)
    }
  }

  private elementFrame(reference: FdGraphElementReference): FdCanvasRect | undefined {
    switch (reference.kind) {
      case 'node':
        return (
          this.interactionPresentation.frames.get(reference.nodeID) ??
          this.index.nodes.get(reference.nodeID)?.frame
        )
      case 'port': {
        const node = this.index.nodes.get(reference.nodeID)
        if (!node?.ports?.some(({ id }) => id === reference.portID)) return undefined
        const frame = this.interactionPresentation.frames.get(reference.nodeID)
        const point = graphPortPoint(frame ? { ...node, frame } : node, reference.portID)
        return {
          x: point.x - minimumElementFocusFrameSize / 2,
          y: point.y - minimumElementFocusFrameSize / 2,
          width: minimumElementFocusFrameSize,
          height: minimumElementFocusFrameSize,
        }
      }
      case 'edge': {
        const edge = this.index.edges.get(reference.edgeID)
        if (!edge) return undefined
        const source = this.endpointPoint(edge, 'source')
        const target = this.endpointPoint(edge, 'target')
        return {
          x: Math.min(source.x, target.x),
          y: Math.min(source.y, target.y),
          width: Math.max(Math.abs(target.x - source.x), minimumElementFocusFrameSize),
          height: Math.max(Math.abs(target.y - source.y), minimumElementFocusFrameSize),
        }
      }
    }
  }

  private setsEqual<Value>(first: ReadonlySet<Value>, second: ReadonlySet<Value>): boolean {
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

  setConnectionPresentation(connection: FdGraphCanvasTransientConnection | undefined): void {
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

  emitConnectionResolution(resolution: FdGraphCanvasConnectionResolution): void {
    if (resolution.kind === 'completed') {
      const detail: FdGraphConnectionCompleteDetail = {
        ...resolution.intent,
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
      ...resolution.intent,
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

  private syncConnectionPortStates(connection: FdGraphCanvasTransientConnection): void {
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
    const selectionNodeIDs = this.interactionPresentation.selectionNodeIDs ?? this.selectedNodeIDs
    for (const id of selectionNodeIDs) {
      const frame = this.interactionPresentation.frames.get(id) ?? this.index.nodes.get(id)?.frame
      if (frame) frames.set(id, frame)
    }
    const bounds = graphSelectionBounds(frames)
    const isVisible = bounds !== undefined && this.resizeHandlesVisible
    this.selectionBoundsElement.hidden = !isVisible
    if (!bounds || !isVisible) return
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
      nodes[0] !== undefined &&
      this.nodeCapabilities(nodes[0].id).resizable
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
    const visibleGuides = this.resolvedGraphConfiguration.rendersDefaultGuides ? guides : []
    while (this.guideElements.length < visibleGuides.length) {
      const element = this.guideRenderer.createElement()
      this.guideElements.push(element)
      this.guideLayer.append(element)
    }
    const zoom = this.canvas.viewport.transform.zoom
    for (const [index, element] of this.guideElements.entries()) {
      const guide = visibleGuides[index]
      if (!guide) {
        element.hidden = true
        continue
      }
      element.hidden = false
      this.guideRenderer.updateElement(element, { guide, index, zoom })
    }
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
    this.miniMap.miniMapStyle = this.miniMapStyle
    this.miniMap.placement = this.miniMapPlacement
    this.miniMap.overlayInsets = this.miniMapInsets
    this.miniMap.nodeStyleIndex = this.miniMapNodeStyleIndex
  }

  private refreshVisibleElements(rect: FdCanvasRect): void {
    if (rect.width <= 0 || rect.height <= 0) return
    this.renderWorldRect = rect
    this.visibleNodes = this.index.nodesIn(rect)
    const padding = this.resolvedGraphConfiguration.edgeRenderPadding
    this.visibleEdges = this.index.edgesIn({
      x: rect.x - padding,
      y: rect.y - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    })
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
    const geometry = this.renderGeometryCache.resolve({
      snapshotRevision: this.snapshotRevision,
      presentationRevision: this.presentationRevision,
      nodes: this.visibleNodes,
      edges: this.visibleEdges,
      selectedNodeIDs: this.selectedNodeIDs,
      selectedEdgeIDs: this.selectedEdgeIDsValue,
      ...(this.focusedElement ? { focusedElement: this.focusedElement } : {}),
      nodeFrame: (node) => this.interactionPresentation.frames.get(node.id) ?? node.frame,
      edgeEndpoint: (edge, endpoint) => this.endpointPoint(edge, endpoint),
      edgeGeometry: this.edgeGeometryResolver,
    })
    const frame: FdGraphRenderFrame = {
      snapshotID: this.snapshot.id,
      snapshotRevision: this.snapshotRevision,
      presentationRevision: this.presentationRevision,
      viewport: this.canvas.viewport,
      renderWorldRect: this.renderWorldRect,
      nodes: geometry.nodes.map((node) => ({
        ...node,
        capabilities: this.nodeCapabilities(node.node.id),
      })),
      edges: geometry.edges,
      selectedElements: this.selectedElements,
      selectedNodeIDs: this.selectedNodeIDs,
      selectedEdgeIDs: this.selectedEdgeIDsValue,
      selectedPortIDsByNode: this.selectedPortIDsByNodeValue,
      ...(this.focusedElement ? { focusedElement: this.focusedElement } : {}),
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
