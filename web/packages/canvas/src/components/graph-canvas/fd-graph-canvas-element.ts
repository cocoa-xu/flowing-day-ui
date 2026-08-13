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
import type { FdGraphCanvasConfiguration } from '../../graph/configuration.js'
import type { FdGraphFocusChangeDetail, FdGraphSelectionChangeDetail } from '../../graph/events.js'
import { FdGraphCanvasInteractionPolicy } from '../../graph/interaction-policy.js'
import type { FdGraphCanvasContent } from '../../graph/content.js'
import { FdGraphCanvasSmartMagnifyContext } from '../../graph/contexts.js'
import type { FdGraphElementID, FdGraphElementReference } from '../../graph/model.js'
import { graphEdgeReference, graphNodeReference, graphPortReference } from '../../graph/model.js'
import type { FdGraphCanvasInteractionIntent } from '../../interactions/session.js'
import { FdGraphCanvasSessionID, FdGraphCanvasSessionState } from '../../interactions/session.js'
import type { FdGraphCanvasEngine } from './fd-graph-canvas.js'
import './fd-graph-canvas.js'
import { graphCanvasEngineSnapshot } from './engine-adapter.js'

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
        @fd-smart-magnify=${this.handleSmartMagnify}
        @fd-viewport-change=${this.handleViewportChange}
      >
        <slot name="background" slot="background"></slot>
        <slot name="overlay" slot="overlay"></slot>
      </fd-graph-canvas-engine>
    `
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (!this.engine || (!changed.has('session') && !changed.has('content'))) return
    this.engine.tool = this.session.tool
    this.engine.selectedElements = this.elementReferences(this.session.selection)
    this.engine.focusedElement = this.elementReference(this.session.focusedElementID)
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
