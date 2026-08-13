import { css, html, LitElement, nothing, type PropertyValues } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import type { FdGraphCanvasAccessibilitySnapshot } from '../../accessibility/snapshot.js'
import type {
  FdCanvasContentChangeBehavior,
  FdCanvasViewportAction,
  FdCanvasViewportChangePhase,
} from '../../configuration.js'
import type { FdCanvasSmartMagnifyContext } from '../../events.js'
import type { FdCanvasInsets, FdCanvasRenderSurface, FdCanvasViewport } from '../../geometry.js'
import { insetCanvasRect, zeroCanvasInsets } from '../../geometry.js'
import {
  type FdGraphCanvasConfiguration,
  resolveGraphCanvasConfiguration,
} from '../../graph/configuration.js'
import {
  FdGraphCanvasAnchor,
  type FdGraphCanvasContent,
  FdGraphCanvasEdgeAnchors,
} from '../../graph/content.js'
import {
  FdGraphCanvasEdgeContext,
  FdGraphCanvasElementActions,
  FdGraphCanvasNodeContext,
  FdGraphCanvasNodeResizeActions,
  FdGraphCanvasOverlayContext,
  FdGraphCanvasPortContext,
  FdGraphCanvasSmartMagnifyContext,
  FdGraphCanvasWorldContext,
} from '../../graph/contexts.js'
import type {
  FdGraphConnectionCancelDetail,
  FdGraphConnectionCompleteDetail,
  FdGraphConnectionPreviewChangeDetail,
  FdGraphFocusChangeDetail,
  FdGraphNodeFramesChangeDetail,
  FdGraphSelectionChangeDetail,
} from '../../graph/events.js'
import {
  FdGraphCanvasInteractionPolicy,
  FdGraphCanvasNodeCapabilities,
} from '../../graph/interaction-policy.js'
import type { FdGraphElementID, FdGraphElementReference } from '../../graph/model.js'
import { graphEdgeReference, graphNodeReference, graphPortReference } from '../../graph/model.js'
import type {
  FdGraphPresentationEdge,
  FdGraphPresentationNode,
  FdGraphPresentationPort,
} from '../../graph/presentation.js'
import {
  FdGraphCanvasArrangement,
  type FdGraphCanvasArrangementAction,
  type FdGraphCanvasGuide,
} from '../../interactions/arrangement.js'
import {
  FdGraphCanvasConnectionPreview,
  FdGraphCanvasConnectionValidationRequest,
  type FdGraphCanvasPortConnectionState,
  graphCanvasConnectionFixedElementID,
  graphCanvasConnectionMovingElementID,
} from '../../interactions/connection-model.js'
import {
  type FdGraphCanvasSelectionCommand,
  FdGraphCanvasSessionReducer,
} from '../../interactions/selection.js'
import {
  FdGraphCanvasElementActionIntent,
  type FdGraphCanvasFitScope,
  type FdGraphCanvasInteractionIntent,
  FdGraphCanvasNodeArrangementIntent,
  type FdGraphCanvasSessionCommand,
  FdGraphCanvasSessionID,
  FdGraphCanvasSessionState,
} from '../../interactions/session.js'
import { sameLayoutInputID } from '../../layout/model.js'
import {
  FdGraphCanvasBackendContext,
  type FdGraphCanvasWebGL2VisualAdapter,
  type FdGraphRenderEdge,
  type FdGraphRenderFrame,
  type FdGraphRenderingBackend,
  type FdGraphRenderPort,
} from '../../rendering/backend.js'
import { FdGraphCanvasRenderingGeometry } from '../../rendering/geometry.js'
import type { FdGraphWebGL2RenderingBackendConfiguration } from '../../rendering/webgl2-backend.js'
import type { FdCanvasProxy, FdCanvasRenderContext } from '../../rendering-context.js'
import type { FdGraphCanvasEngine } from './fd-graph-canvas.js'
import './fd-graph-canvas.js'
import {
  type FdGraphCanvasEngineEdgeData,
  type FdGraphCanvasEngineNodeData,
  type FdGraphCanvasEnginePort,
  type FdGraphCanvasEnginePortData,
  graphCanvasEngineEdgeGeometryResolver,
  graphCanvasEngineSnapshot,
} from './engine-adapter.js'
import {
  graphCanvasConnectionCancellationIntent,
  graphCanvasConnectionCompletionIntent,
  graphCanvasNodeDragIntent,
  graphCanvasNodeResizeIntent,
  graphCanvasTransientConnection,
  graphCanvasTransientNodeDrag,
  graphCanvasTransientNodeResize,
} from './engine-interaction-adapter.js'

export type FdGraphCanvasNodeBuilder<ElementID extends FdGraphElementID = FdGraphElementID> = (
  node: FdGraphPresentationNode<ElementID>,
  context: FdGraphCanvasNodeContext<ElementID>,
) => Node | string | null

export type FdGraphCanvasEdgeBuilder<ElementID extends FdGraphElementID = FdGraphElementID> = (
  edge: FdGraphPresentationEdge<ElementID>,
  context: FdGraphCanvasEdgeContext<ElementID>,
) => Node | string | null

export type FdGraphCanvasPortBuilder<ElementID extends FdGraphElementID = FdGraphElementID> = (
  port: FdGraphPresentationPort<ElementID>,
  context: FdGraphCanvasPortContext<ElementID>,
) => Node | string | null

export type FdGraphCanvasBackgroundBuilder = (
  context: FdCanvasRenderContext,
) => Node | string | null

export type FdGraphCanvasDecorationsBuilder<ElementID extends FdGraphElementID = FdGraphElementID> =
  (context: FdGraphCanvasWorldContext<ElementID>) => Node | string | null

export type FdGraphCanvasOverlaysBuilder<ElementID extends FdGraphElementID = FdGraphElementID> = (
  context: FdGraphCanvasOverlayContext<ElementID>,
) => Node | string | null

@customElement('fd-graph-canvas')
export class FdGraphCanvas<
  ElementID extends FdGraphElementID = FdGraphElementID,
> extends LitElement {
  static override styles = css`
    :host {
      display: block;
      min-width: 0;
      min-height: 0;
    }

    fd-graph-canvas-engine {
      width: 100%;
      height: 100%;
    }
  `

  @property({ attribute: false }) content: FdGraphCanvasContent<ElementID> | undefined
  @property({ attribute: false }) sessionID = new FdGraphCanvasSessionID()
  @property({ attribute: false }) session = new FdGraphCanvasSessionState<ElementID>()
  @property({ attribute: false }) configuration: FdGraphCanvasConfiguration = {}
  @property({ attribute: false })
  webGL2VisualAdapter: FdGraphCanvasWebGL2VisualAdapter<ElementID> | undefined
  @property({ attribute: false }) node: FdGraphCanvasNodeBuilder<ElementID> | undefined
  @property({ attribute: false }) edge: FdGraphCanvasEdgeBuilder<ElementID> | undefined
  @property({ attribute: false }) port: FdGraphCanvasPortBuilder<ElementID> | undefined
  @property({ attribute: false }) background: FdGraphCanvasBackgroundBuilder | undefined
  @property({ attribute: false })
  decorations: FdGraphCanvasDecorationsBuilder<ElementID> | undefined
  @property({ attribute: false }) overlays: FdGraphCanvasOverlaysBuilder<ElementID> | undefined
  @property({ attribute: false })
  accessibilitySnapshot: FdGraphCanvasAccessibilitySnapshot | undefined
  @property({ attribute: false }) contentInsets: FdCanvasInsets = zeroCanvasInsets
  @property({ attribute: false }) contentChangeBehavior: FdCanvasContentChangeBehavior = {
    kind: 'preserveViewport',
  }
  @property({ attribute: false }) command: FdGraphCanvasSessionCommand<ElementID> | undefined
  @property({ attribute: false }) interactionPolicy =
    new FdGraphCanvasInteractionPolicy<ElementID>()
  @property({ attribute: false }) onIntent: (
    intent: FdGraphCanvasInteractionIntent<ElementID>,
  ) => void = () => {}
  @property({ attribute: false }) onSmartMagnify: (
    context: FdGraphCanvasSmartMagnifyContext<ElementID>,
  ) => FdCanvasViewportAction = (context) => context.standardAction(1, 48)
  @property({ attribute: false }) onViewportChange: (
    viewport: FdCanvasViewport,
    phase: FdCanvasViewportChangePhase,
  ) => void = () => {}

  @query('fd-graph-canvas-engine') private engine: FdGraphCanvasEngine | undefined
  private handledCommandID: string | undefined
  private engineConfigurationSource: FdGraphCanvasConfiguration | undefined
  private engineConfigurationUsesVisualAdapter = false
  private engineConfigurationValue: FdGraphCanvasConfiguration = {}
  private renderingConfigurationKey = ''
  private renderingConfigurationValue: FdGraphWebGL2RenderingBackendConfiguration = {}
  private visualAdapterSource: FdGraphCanvasWebGL2VisualAdapter<ElementID> | undefined
  private visualAdapterContent: FdGraphCanvasContent<ElementID> | undefined
  private visualAdapterBackend: FdGraphRenderingBackend | undefined

  override render() {
    const content = this.content
    if (!content) return nothing
    return html`
      <fd-graph-canvas-engine
        .snapshot=${graphCanvasEngineSnapshot(content)}
        .layoutInputID=${content.id}
        .accessibilitySnapshot=${this.accessibilitySnapshot}
        .configuration=${this.resolveEngineConfiguration()}
        .contentInsets=${this.contentInsets}
        .contentChangeBehavior=${this.contentChangeBehavior}
        .renderingAdapter=${this.resolveVisualAdapter(content)}
        .renderingConfiguration=${this.resolveRenderingConfiguration()}
        .background=${this.background}
        .decorations=${this.decorations ? this.renderDecorations : undefined}
        .overlays=${this.overlays ? this.renderOverlays : undefined}
        .edgeGeometryResolver=${graphCanvasEngineEdgeGeometryResolver}
        .interactionPolicy=${this.interactionPolicy}
        .tool=${this.session.tool}
        .selectedElements=${this.elementReferences(this.session.selection)}
        .focusedElement=${this.elementReference(this.session.focusedElementID)}
        @fd-graph-selection-change=${this.handleSelectionChange}
        @fd-graph-focus-change=${this.handleFocusChange}
        @fd-graph-node-frames-change=${this.handleNodeFramesChange}
        @fd-graph-connection-preview-change=${this.handleConnectionPreviewChange}
        @fd-graph-connection-complete=${this.handleConnectionComplete}
        @fd-graph-connection-cancel=${this.handleConnectionCancel}
        @fd-smart-magnify=${this.handleSmartMagnify}
        @fd-viewport-change=${this.handleViewportChange}
      >
        <slot name="background" slot="background"></slot>
        <slot name="overlay" slot="overlay"></slot>
      </fd-graph-canvas-engine>
    `
  }

  private resolveRenderingConfiguration(): FdGraphWebGL2RenderingBackendConfiguration {
    const edgeContentPadding = resolveGraphCanvasConfiguration(this.configuration).edgeRenderPadding
    const key = `${this.node !== undefined}:${this.edge !== undefined}:${this.port !== undefined}:${edgeContentPadding}`
    if (key === this.renderingConfigurationKey) return this.renderingConfigurationValue
    this.renderingConfigurationKey = key
    this.renderingConfigurationValue = {
      ...(this.node ? { createNodeContent: this.renderNodeContent } : {}),
      ...(this.edge
        ? {
            createEdgeContent: this.renderEdgeContent,
            edgeContentPadding,
          }
        : {}),
      ...(this.port ? { createPortContent: this.renderPortContent } : {}),
    }
    return this.renderingConfigurationValue
  }

  private readonly renderDecorations = (
    renderContext: FdCanvasRenderContext,
    surface: FdCanvasRenderSurface,
    guides: readonly FdGraphCanvasGuide[],
  ): Node | string | null => {
    const builder = this.decorations
    const content = this.content
    if (!builder || !content) return null
    return builder(
      new FdGraphCanvasWorldContext({
        content,
        session: this.session,
        renderContext,
        surface,
        guides,
        ...(this.session.transientConnection
          ? {
              connectionPreview: new FdGraphCanvasConnectionPreview(
                this.session.transientConnection,
              ),
            }
          : {}),
      }),
    )
  }

  private readonly renderOverlays = (proxy: FdCanvasProxy): Node | string | null => {
    const builder = this.overlays
    const content = this.content
    if (!builder || !content) return null
    return builder(
      new FdGraphCanvasOverlayContext({
        sessionID: this.sessionID,
        content,
        session: this.session,
        proxy,
      }),
    )
  }

  private readonly renderNodeContent = (
    rendered: FdGraphRenderFrame['nodes'][number],
    frame: FdGraphRenderFrame,
  ): Node | string | null => {
    const builder = this.node
    const content = this.content
    const data = rendered.node.data as FdGraphCanvasEngineNodeData<ElementID> | undefined
    const baseFrame = data ? content?.frame(data.localID) : undefined
    if (!builder || !content || !data || !baseFrame) return null
    const context = new FdGraphCanvasNodeContext({
      elementID: data.presentation.id,
      localID: data.localID,
      baseFrame,
      frame: rendered.frame,
      renderedFrame: frame.viewport.transform.applyRect(rendered.frame),
      renderScale: frame.viewport.transform.zoom,
      isSelected: rendered.selected,
      isFocused: rendered.focused,
      isHovered: rendered.hovered,
      isBeingDragged: this.session.transientNodeDrag?.nodeIDs.has(data.presentation.id) === true,
      isBeingResized: this.session.transientNodeResize?.nodeIDs.has(data.presentation.id) === true,
      capabilities: rendered.capabilities ?? FdGraphCanvasNodeCapabilities.standard,
      actions: this.elementActions(graphNodeReference(data.presentation.id), data.presentation.id),
      resizeActions: FdGraphCanvasNodeResizeActions.disabled,
    })
    return builder(data.presentation, context)
  }

  private readonly renderPortContent = (
    rendered: FdGraphRenderPort,
    frame: FdGraphRenderFrame,
  ): Node | string | null => {
    const builder = this.port
    const content = this.content
    const data = (rendered.port as FdGraphCanvasEnginePort<ElementID>).data as
      | FdGraphCanvasEnginePortData<ElementID>
      | undefined
    const nodeData = rendered.node.data as FdGraphCanvasEngineNodeData<ElementID> | undefined
    const anchor = data ? content?.anchor(data.localID) : undefined
    if (!builder || !content || !data || !nodeData || !anchor) return null
    const context = new FdGraphCanvasPortContext({
      elementID: data.presentation.id,
      localID: data.localID,
      nodeLocalID: nodeData.localID,
      anchor,
      renderedPosition: frame.viewport.transform.applyPoint(rendered.position),
      renderScale: frame.viewport.transform.zoom,
      isSelected: rendered.selected,
      isHovered: rendered.hovered,
      connectionState: this.portConnectionState(data.presentation.id),
      actions: this.elementActions(
        graphPortReference(rendered.node.id, data.presentation.id),
        data.presentation.id,
      ),
    })
    return builder(data.presentation, context)
  }

  private portConnectionState(elementID: ElementID): FdGraphCanvasPortConnectionState {
    const connection = this.session.transientConnection
    if (!connection) return { kind: 'idle' }
    if (connection.candidatePortID === elementID && connection.validation) {
      return { kind: 'target', validation: connection.validation, isCandidate: true }
    }
    if (
      graphCanvasConnectionFixedElementID(connection.origin) === elementID ||
      graphCanvasConnectionMovingElementID(connection.origin) === elementID
    ) {
      return { kind: 'source' }
    }
    return {
      kind: 'target',
      validation: this.interactionPolicy.connectionPolicy.validate(
        new FdGraphCanvasConnectionValidationRequest({
          origin: connection.origin,
          targetPortID: elementID,
          basePresentationSnapshotID: connection.basePresentationSnapshotID,
          baseLayoutInputID: connection.baseLayoutInputID,
        }),
      ),
      isCandidate: false,
    }
  }

  private readonly renderEdgeContent = (
    rendered: FdGraphRenderEdge,
    frame: FdGraphRenderFrame,
  ): Node | string | null => {
    const builder = this.edge
    const content = this.content
    const data = rendered.edge.data as FdGraphCanvasEngineEdgeData<ElementID> | undefined
    const baseAnchors = data ? content?.edgeAnchors(data.localID) : undefined
    if (!builder || !content || !data || !baseAnchors) return null
    const worldRoute = rendered.geometry.route
    const worldPadding =
      resolveGraphCanvasConfiguration(this.configuration).edgeRenderPadding /
      frame.viewport.transform.zoom
    const worldFrame = insetCanvasRect(worldRoute.conservativeBounds, -worldPadding)
    const renderedFrame = frame.viewport.transform.applyRect(worldFrame)
    const context = new FdGraphCanvasEdgeContext({
      elementID: data.presentation.id,
      localID: data.localID,
      worldRoute,
      renderedRoute: FdGraphCanvasRenderingGeometry.transformed(
        worldRoute,
        frame.viewport.transform,
        renderedFrame,
      ),
      anchors: new FdGraphCanvasEdgeAnchors(
        new FdGraphCanvasAnchor(rendered.source, baseAnchors.first.normal),
        new FdGraphCanvasAnchor(rendered.target, baseAnchors.second.normal),
        baseAnchors.isDirected,
      ),
      worldFrame,
      renderedFrame,
      renderScale: frame.viewport.transform.zoom,
      isSelected: rendered.selected,
      isHovered: rendered.hovered,
      isTransient:
        rendered.source.x !== data.route.start.x ||
        rendered.source.y !== data.route.start.y ||
        rendered.target.x !== (data.route.segments.at(-1)?.end.x ?? data.route.start.x) ||
        rendered.target.y !== (data.route.segments.at(-1)?.end.y ?? data.route.start.y),
      actions: this.elementActions(graphEdgeReference(data.presentation.id), data.presentation.id),
    })
    return builder(data.presentation, context)
  }

  private elementActions(
    reference: FdGraphElementReference,
    elementID: ElementID,
  ): FdGraphCanvasElementActions {
    return new FdGraphCanvasElementActions({
      select: (mode) => this.engine?.selectElement(reference, mode ?? 'replace'),
      send: (action) => {
        const content = this.content
        if (!content) return
        if (resolveGraphCanvasConfiguration(this.configuration).connectionEditing.isEnabled) {
          if (action === 'beginConnection' && reference.kind === 'port') {
            this.engine?.beginConnection({ kind: 'new', source: reference })
            return
          }
          if (action === 'completeConnection' && reference.kind === 'port') {
            const localID = content.localID(elementID)
            const anchor = localID ? content.anchor(localID) : undefined
            if (anchor) this.engine?.updateConnection(anchor.position)
            this.engine?.completeConnection()
            return
          }
          if (action === 'cancelConnection') {
            this.engine?.cancelConnection()
            return
          }
        }
        this.onIntent({
          kind: 'elementAction',
          intent: new FdGraphCanvasElementActionIntent(
            action,
            elementID,
            content.presentation.snapshotID,
          ),
        })
      },
    })
  }

  private resolveVisualAdapter(
    content: FdGraphCanvasContent<ElementID>,
  ): FdGraphRenderingBackend | undefined {
    const adapter = this.webGL2VisualAdapter
    if (this.configuration.renderingBackend === 'dom' || !adapter?.isAvailable) {
      this.visualAdapterSource = undefined
      this.visualAdapterContent = undefined
      this.visualAdapterBackend = undefined
      return undefined
    }
    if (
      this.visualAdapterSource === adapter &&
      this.visualAdapterContent === content &&
      this.visualAdapterBackend
    ) {
      return this.visualAdapterBackend
    }
    this.visualAdapterSource = adapter
    this.visualAdapterContent = content
    this.visualAdapterBackend = adapter.call(
      new FdGraphCanvasBackendContext({
        content,
        sessionID: this.sessionID,
        session: this.session,
        configuration: this.configuration,
        interactionPolicy: this.interactionPolicy,
        ...(this.accessibilitySnapshot
          ? { accessibilitySnapshot: this.accessibilitySnapshot }
          : {}),
        contentInsets: this.contentInsets,
        contentChangeBehavior: this.contentChangeBehavior,
        ...(this.command ? { command: this.command } : {}),
        onSmartMagnify: this.onSmartMagnify,
        onViewportChange: this.onViewportChange,
        onIntent: this.onIntent,
      }),
    )
    return this.visualAdapterBackend
  }

  private resolveEngineConfiguration(): FdGraphCanvasConfiguration {
    const usesVisualAdapter =
      this.configuration.renderingBackend !== 'dom' &&
      this.webGL2VisualAdapter?.isAvailable === true
    if (
      this.engineConfigurationSource === this.configuration &&
      this.engineConfigurationUsesVisualAdapter === usesVisualAdapter
    ) {
      return this.engineConfigurationValue
    }
    this.engineConfigurationSource = this.configuration
    this.engineConfigurationUsesVisualAdapter = usesVisualAdapter
    this.engineConfigurationValue = usesVisualAdapter
      ? this.configuration
      : { ...this.configuration, renderingBackend: 'dom' }
    return this.engineConfigurationValue
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (!this.engine) return
    if (changed.has('content')) this.reconcileSession()
    if (changed.has('session') || changed.has('content')) this.syncEngineSession()
    if (changed.has('command') || changed.has('content')) this.handleCommand(this.command)
  }

  private reconcileSession(): void {
    const content = this.content
    if (!content) return
    this.session.selection = new Set(
      [...this.session.selection].filter((elementID) => content.contains(elementID)),
    )
    if (
      this.session.focusedElementID !== undefined &&
      !content.contains(this.session.focusedElementID)
    ) {
      this.session.focusedElementID = undefined
    }
    if (
      this.session.hoveredElementID !== undefined &&
      !content.contains(this.session.hoveredElementID)
    ) {
      this.session.hoveredElementID = undefined
    }
    const matchesContent = (snapshotID: string | number, layoutInputID: typeof content.id) =>
      snapshotID === content.presentation.snapshotID && sameLayoutInputID(layoutInputID, content.id)
    if (
      this.session.transientNodeDrag &&
      !matchesContent(
        this.session.transientNodeDrag.basePresentationSnapshotID,
        this.session.transientNodeDrag.baseLayoutInputID,
      )
    ) {
      this.session.transientNodeDrag = undefined
    }
    if (
      this.session.transientNodeResize &&
      !matchesContent(
        this.session.transientNodeResize.basePresentationSnapshotID,
        this.session.transientNodeResize.baseLayoutInputID,
      )
    ) {
      this.session.transientNodeResize = undefined
    }
    if (
      this.session.transientConnection &&
      !matchesContent(
        this.session.transientConnection.basePresentationSnapshotID,
        this.session.transientConnection.baseLayoutInputID,
      )
    ) {
      this.session.transientConnection = undefined
    }
  }

  private syncEngineSession(): void {
    const engine = this.engine
    if (!engine) return
    engine.tool = this.session.tool
    engine.selectedElements = this.elementReferences(this.session.selection)
    engine.focusedElement = this.elementReference(this.session.focusedElementID)
    const viewport = this.session.viewport
    if (
      viewport.size.width > 0 &&
      viewport.size.height > 0 &&
      (engine.viewport.transform.zoom !== viewport.transform.zoom ||
        engine.viewport.transform.offset.x !== viewport.transform.offset.x ||
        engine.viewport.transform.offset.y !== viewport.transform.offset.y)
    ) {
      engine.anchor({ x: 0, y: 0 }, viewport.transform.offset, viewport.transform.zoom, {
        animated: false,
      })
    }
  }

  private handleCommand(command: FdGraphCanvasSessionCommand<ElementID> | undefined): void {
    const content = this.content
    const engine = this.engine
    if (
      !command ||
      !content ||
      !engine ||
      !command.targets(this.sessionID) ||
      command.id === this.handledCommandID
    ) {
      return
    }
    this.handledCommandID = command.id
    const options = { animated: command.animated }
    const action = command.action
    switch (action.kind) {
      case 'focus': {
        const bounds = content.bounds(action.elementID)
        if (!bounds) return
        this.session.focusedElementID = action.elementID
        engine.focusRect(bounds, action.zoom, options)
        break
      }
      case 'jumpToElement': {
        const bounds = content.bounds(action.elementID)
        if (!bounds) return
        this.session.focusedElementID = action.elementID
        const selection = action.selection ?? 'replace'
        if (selection === 'replace') this.session.selection = new Set([action.elementID])
        else if (selection === 'add') this.session.selection.add(action.elementID)
        engine.focusRect(bounds, action.zoom, options)
        break
      }
      case 'pan':
        if (action.viewportPoint) {
          engine.anchor(
            action.worldPoint,
            action.viewportPoint,
            action.zoom ?? this.session.viewport.transform.zoom,
            options,
          )
        } else {
          engine.focusRect({ ...action.worldPoint, width: 0, height: 0 }, action.zoom, options)
        }
        break
      case 'restoreViewport':
        engine.anchor({ x: 0, y: 0 }, action.transform.offset, action.transform.zoom, options)
        break
      case 'select':
        FdGraphCanvasSessionReducer.apply(
          this.filteredSelectionCommand(action.command),
          this.session.selection,
        )
        break
      case 'fit': {
        const bounds = this.fitBounds(action.scope)
        if (!bounds) return
        engine.fitRect(bounds, action.padding, action.maximumZoom, options)
        break
      }
      case 'inspect':
        if (!content.contains(action.elementID)) return
        this.onIntent({
          kind: 'elementAction',
          intent: new FdGraphCanvasElementActionIntent(
            'inspect',
            action.elementID,
            content.presentation.snapshotID,
          ),
        })
        break
      case 'arrange':
        this.requestArrangement(action.action)
        break
    }
    this.syncEngineSession()
  }

  private filteredSelectionCommand(
    command: FdGraphCanvasSelectionCommand<ElementID>,
  ): FdGraphCanvasSelectionCommand<ElementID> {
    if (command.kind === 'clear') return command
    return {
      ...command,
      elementIDs: new Set(
        [...command.elementIDs].filter((elementID) => this.content?.contains(elementID)),
      ),
    }
  }

  private fitBounds(scope: FdGraphCanvasFitScope<ElementID>) {
    const content = this.content
    if (!content) return undefined
    if (scope.kind === 'presentation') return content.contentBounds
    return content.bounds(scope.kind === 'selection' ? this.session.selection : scope.elementIDs)
  }

  private requestArrangement(action: FdGraphCanvasArrangementAction): void {
    const content = this.content
    if (
      !content ||
      !resolveGraphCanvasConfiguration(this.configuration).allowsArrangementCommands ||
      this.session.transientNodeDrag ||
      this.session.transientNodeResize ||
      this.session.transientConnection
    ) {
      return
    }
    const nodes = content.presentation.nodes.flatMap((node) => {
      const frame = content.frame(node.localID)
      return this.session.selection.has(node.id) &&
        frame &&
        this.interactionPolicy.nodeCapabilities
          .capabilities(node.id)
          .contains(FdGraphCanvasNodeCapabilities.arrangementParticipant)
        ? [{ id: node.id, frame }]
        : []
    })
    const rawTranslations = FdGraphCanvasArrangement.translations(nodes, action)
    const translations = new Map<ElementID, { readonly width: number; readonly height: number }>()
    for (const [elementID, translation] of rawTranslations) {
      if (content.contains(elementID as ElementID)) {
        translations.set(elementID as ElementID, translation)
      }
    }
    if (translations.size === 0) return
    this.onIntent({
      kind: 'nodeArrangementRequested',
      intent: new FdGraphCanvasNodeArrangementIntent(
        action,
        translations,
        content.presentation.snapshotID,
        content.id,
      ),
    })
  }

  private handleSelectionChange = (event: CustomEvent<FdGraphSelectionChangeDetail>): void => {
    event.stopPropagation()
    this.session.selection = new Set(
      event.detail.selectedElements.flatMap((reference) => {
        const elementID = this.elementID(reference)
        return elementID === undefined ? [] : [elementID]
      }),
    )
  }

  private handleFocusChange = (event: CustomEvent<FdGraphFocusChangeDetail>): void => {
    event.stopPropagation()
    this.session.focusedElementID = event.detail.focusedElement
      ? this.elementID(event.detail.focusedElement)
      : undefined
  }

  private handleNodeFramesChange = (event: CustomEvent<FdGraphNodeFramesChangeDetail>): void => {
    event.stopPropagation()
    const content = this.content
    const interaction = this.engine?.activeNodeInteraction
    if (!content || event.detail.snapshotID !== content.presentation.snapshotID) return
    if (event.detail.phase === 'continuous') {
      if (!interaction) return
      if (interaction.kind === 'move') {
        this.session.transientNodeDrag = graphCanvasTransientNodeDrag(content, interaction)
        this.session.transientNodeResize = undefined
      } else {
        this.session.transientNodeResize = graphCanvasTransientNodeResize(content, interaction)
        this.session.transientNodeDrag = undefined
      }
      return
    }
    if (event.detail.kind === 'drag' || event.detail.kind === 'keyboard') {
      const intent = graphCanvasNodeDragIntent(
        content,
        event.detail,
        this.session.transientNodeDrag,
        this.engine?.focusedNodeID,
      )
      if (intent) this.onIntent({ kind: 'nodeDragCompleted', intent })
      this.session.transientNodeDrag = undefined
    } else if (event.detail.kind === 'resize' && this.session.transientNodeResize) {
      const intent = graphCanvasNodeResizeIntent(
        content,
        event.detail,
        this.session.transientNodeResize,
      )
      if (intent) this.onIntent({ kind: 'nodeResizeCompleted', intent })
      this.session.transientNodeResize = undefined
    }
  }

  private handleConnectionPreviewChange = (
    event: CustomEvent<FdGraphConnectionPreviewChangeDetail>,
  ): void => {
    event.stopPropagation()
    const content = this.content
    const connection = event.detail.connection
    if (!content) {
      this.session.transientConnection = undefined
      return
    }
    if (!connection) return
    this.session.transientConnection = graphCanvasTransientConnection(content, connection)
  }

  private handleConnectionComplete = (
    event: CustomEvent<FdGraphConnectionCompleteDetail>,
  ): void => {
    event.stopPropagation()
    const content = this.content
    if (!content) return
    const intent = graphCanvasConnectionCompletionIntent(
      content,
      event.detail,
      this.session.transientConnection,
    )
    if (intent) this.onIntent({ kind: 'connectionCompleted', intent })
    this.session.transientConnection = undefined
  }

  private handleConnectionCancel = (event: CustomEvent<FdGraphConnectionCancelDetail>): void => {
    event.stopPropagation()
    const content = this.content
    if (!content) return
    const intent = graphCanvasConnectionCancellationIntent(
      content,
      event.detail,
      this.session.transientConnection,
    )
    if (intent) this.onIntent({ kind: 'connectionCancelled', intent })
    this.session.transientConnection = undefined
  }

  private handleSmartMagnify = (event: CustomEvent<FdCanvasSmartMagnifyContext>): void => {
    const content = this.content
    if (!content) return
    event.preventDefault()
    const nearestNodeLocalID = content.nearestNodeLocalID(event.detail.worldLocation)
    const nearestNodeID = nearestNodeLocalID ? content.elementID(nearestNodeLocalID) : undefined
    const nearestNodeFrame = nearestNodeLocalID ? content.frame(nearestNodeLocalID) : undefined
    const focusedElementBounds =
      this.session.focusedElementID === undefined
        ? undefined
        : content.bounds(this.session.focusedElementID)
    this.performViewportAction(
      this.onSmartMagnify(
        new FdGraphCanvasSmartMagnifyContext({
          canvas: event.detail,
          ...(nearestNodeID === undefined ? {} : { nearestNodeID }),
          ...(nearestNodeFrame === undefined ? {} : { nearestNodeFrame }),
          ...(this.session.focusedElementID === undefined
            ? {}
            : { focusedElementID: this.session.focusedElementID }),
          ...(focusedElementBounds === undefined ? {} : { focusedElementBounds }),
        }),
      ),
    )
  }

  private handleViewportChange = (
    event: CustomEvent<{
      readonly viewport: FdCanvasViewport
      readonly phase: FdCanvasViewportChangePhase
    }>,
  ): void => {
    this.session.viewport = event.detail.viewport
    this.onViewportChange(event.detail.viewport, event.detail.phase)
  }

  private performViewportAction(action: FdCanvasViewportAction): void {
    const engine = this.engine
    if (!engine) return
    switch (action.kind) {
      case 'none':
        break
      case 'restore':
        engine.restore()
        break
      case 'anchor':
        engine.anchor(action.worldPoint, action.viewportPoint, action.zoom)
        break
      case 'focus':
        engine.focusRect(action.rect, action.zoom)
        break
      case 'fit':
        engine.fitRect(action.rect, action.padding, action.maximumZoom)
        break
    }
  }

  private elementReferences(
    elementIDs: ReadonlySet<ElementID>,
  ): readonly FdGraphElementReference[] {
    return [...elementIDs].flatMap((elementID) => {
      const reference = this.elementReference(elementID)
      return reference ? [reference] : []
    })
  }

  private elementReference(elementID: ElementID | undefined): FdGraphElementReference | undefined {
    const content = this.content
    if (!content || elementID === undefined) return undefined
    const localID = content.localID(elementID)
    if (!localID) return undefined
    if (content.node(localID)) return graphNodeReference(elementID)
    if (content.edge(localID)) return graphEdgeReference(elementID)
    if (!content.port(localID)) return undefined
    const nodeLocalID = content.nodeLocalID(localID)
    const nodeID = nodeLocalID ? content.elementID(nodeLocalID) : undefined
    return nodeID === undefined ? undefined : graphPortReference(nodeID, elementID)
  }

  private elementID(reference: FdGraphElementReference): ElementID | undefined {
    const elementID =
      reference.kind === 'node'
        ? reference.nodeID
        : reference.kind === 'edge'
          ? reference.edgeID
          : reference.portID
    return this.content?.contains(elementID as ElementID) ? (elementID as ElementID) : undefined
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-graph-canvas': FdGraphCanvas
  }
}
