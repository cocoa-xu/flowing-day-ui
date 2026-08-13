import { css, html, LitElement, nothing, type PropertyValues } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import type { FdGraphCanvasAccessibilitySnapshot } from '../../accessibility/snapshot.js'
import type {
  FdCanvasContentChangeBehavior,
  FdCanvasViewportAction,
  FdCanvasViewportChangePhase,
} from '../../configuration.js'
import type { FdCanvasSmartMagnifyContext } from '../../events.js'
import type { FdCanvasInsets, FdCanvasViewport } from '../../geometry.js'
import { zeroCanvasInsets } from '../../geometry.js'
import {
  type FdGraphCanvasConfiguration,
  resolveGraphCanvasConfiguration,
} from '../../graph/configuration.js'
import type { FdGraphCanvasContent } from '../../graph/content.js'
import { FdGraphCanvasSmartMagnifyContext } from '../../graph/contexts.js'
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
import {
  FdGraphCanvasArrangement,
  type FdGraphCanvasArrangementAction,
} from '../../interactions/arrangement.js'
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
import type { FdGraphCanvasEngine } from './fd-graph-canvas.js'
import './fd-graph-canvas.js'
import { graphCanvasEngineSnapshot } from './engine-adapter.js'
import {
  graphCanvasConnectionCancellationIntent,
  graphCanvasConnectionCompletionIntent,
  graphCanvasNodeDragIntent,
  graphCanvasNodeResizeIntent,
  graphCanvasTransientConnection,
  graphCanvasTransientNodeDrag,
  graphCanvasTransientNodeResize,
} from './engine-interaction-adapter.js'

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

  override render() {
    const content = this.content
    if (!content) return nothing
    return html`
      <fd-graph-canvas-engine
        .snapshot=${graphCanvasEngineSnapshot(content)}
        .layoutInputID=${content.id}
        .accessibilitySnapshot=${this.accessibilitySnapshot}
        .configuration=${this.configuration}
        .contentInsets=${this.contentInsets}
        .contentChangeBehavior=${this.contentChangeBehavior}
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
