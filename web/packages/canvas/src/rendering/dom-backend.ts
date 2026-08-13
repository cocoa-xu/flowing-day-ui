import { FdGraphCanvasNodeCapabilities } from '../graph/interaction-policy.js'
import type { FdGraphSnapshotPort } from '../graph/model.js'
import { graphElementKey, graphPortPoint } from '../graph/model.js'
import type {
  FdGraphRenderEdge,
  FdGraphRenderFrame,
  FdGraphRenderingBackend,
  FdGraphRenderingSurface,
  FdGraphRenderPort,
} from './backend.js'
import { type FdGraphArrowGeometry, graphEdgePath, graphEdgePoint } from './edge-geometry.js'

export interface FdGraphDOMRenderingBackendConfiguration {
  readonly createNodeContent?: (
    node: FdGraphRenderFrame['nodes'][number],
    frame: FdGraphRenderFrame,
  ) => Node | string | null
  readonly createEdgeContent?: (
    edge: FdGraphRenderEdge,
    frame: FdGraphRenderFrame,
  ) => Node | string | null
  readonly createEdgeLabelContent?: (
    edge: FdGraphRenderEdge,
    frame: FdGraphRenderFrame,
  ) => Node | string | null
  readonly createPortContent?: (
    port: FdGraphRenderPort,
    frame: FdGraphRenderFrame,
  ) => Node | string | null
  readonly edgeContentPadding?: number
  readonly minimumEdgeLabelZoom?: number
  readonly rendersEdgeDecorations?: boolean
  readonly rendersEdgePaths?: boolean
  readonly rendersEdgeLabels?: boolean
  readonly rendersNodes?: boolean
}

const svgNamespace = 'http://www.w3.org/2000/svg'

export class FdGraphDOMRenderingBackend implements FdGraphRenderingBackend {
  readonly kind = 'dom'
  private readonly nodeElements = new Map<string, HTMLElement>()
  private readonly portElementsByNode = new Map<string, readonly HTMLElement[]>()
  private readonly edgeElements = new Map<string, SVGPathElement>()
  private readonly edgeArrowElements = new Map<string, SVGPathElement>()
  private readonly edgeContentElements = new Map<string, HTMLElement>()
  private readonly edgeLabelElements = new Map<string, HTMLElement>()
  private readonly edgeLayer = document.createElementNS(svgNamespace, 'svg')
  private readonly edgeContentLayer = document.createElement('div')
  private readonly edgeLabelLayer = document.createElement('div')
  private readonly nodeLayer = document.createElement('div')
  private surface: FdGraphRenderingSurface | undefined
  private renderedSnapshotRevision = -1
  private renderedPresentationRevision = -1
  private renderedEdgeLabelVisibility: boolean | undefined

  constructor(private readonly configuration: FdGraphDOMRenderingBackendConfiguration = {}) {
    if (
      configuration.minimumEdgeLabelZoom !== undefined &&
      (!Number.isFinite(configuration.minimumEdgeLabelZoom) ||
        configuration.minimumEdgeLabelZoom < 0)
    ) {
      throw new RangeError('minimum edge label zoom must be nonnegative')
    }
    if (
      configuration.edgeContentPadding !== undefined &&
      (!Number.isFinite(configuration.edgeContentPadding) || configuration.edgeContentPadding < 0)
    ) {
      throw new RangeError('edge content padding must be nonnegative')
    }
    this.edgeLayer.classList.add('graph-edge-layer')
    this.edgeLayer.setAttribute('part', 'edge-layer')
    this.edgeLayer.setAttribute('aria-hidden', 'true')
    this.edgeContentLayer.classList.add('graph-edge-content-layer')
    this.edgeContentLayer.setAttribute('part', 'edge-content-layer')
    this.edgeContentLayer.style.cssText =
      'position:absolute;inset:0;pointer-events:none;overflow:hidden'
    this.edgeLabelLayer.classList.add('graph-edge-label-layer')
    this.edgeLabelLayer.setAttribute('part', 'edge-label-layer')
    this.edgeLabelLayer.setAttribute('aria-hidden', 'true')
    this.nodeLayer.classList.add('graph-node-layer')
    this.nodeLayer.setAttribute('part', 'node-layer')
    this.nodeLayer.setAttribute('aria-hidden', 'true')
  }

  mount(surface: FdGraphRenderingSurface): void {
    if (this.surface === surface) return
    this.unmount()
    this.surface = surface
    surface.world.append(this.edgeLayer, this.edgeLabelLayer, this.nodeLayer)
    surface.viewport.append(this.edgeContentLayer)
  }

  render(frame: FdGraphRenderFrame): void {
    if (!this.surface) return
    const edgeLabelsVisible =
      frame.viewport.transform.zoom >= (this.configuration.minimumEdgeLabelZoom ?? 0)
    if (
      frame.snapshotRevision === this.renderedSnapshotRevision &&
      frame.presentationRevision === this.renderedPresentationRevision &&
      edgeLabelsVisible === this.renderedEdgeLabelVisibility &&
      !this.configuration.createNodeContent &&
      !this.configuration.createPortContent &&
      !this.configuration.createEdgeContent
    ) {
      return
    }
    this.renderedSnapshotRevision = frame.snapshotRevision
    this.renderedPresentationRevision = frame.presentationRevision
    this.renderedEdgeLabelVisibility = edgeLabelsVisible
    this.updateEdges(frame, edgeLabelsVisible)
    this.updateNodes(frame)
  }

  unmount(): void {
    this.edgeLayer.remove()
    this.edgeContentLayer.remove()
    this.edgeLabelLayer.remove()
    this.nodeLayer.remove()
    this.edgeLayer.replaceChildren()
    this.edgeContentLayer.replaceChildren()
    this.edgeLabelLayer.replaceChildren()
    this.nodeLayer.replaceChildren()
    this.nodeElements.clear()
    this.portElementsByNode.clear()
    this.edgeElements.clear()
    this.edgeArrowElements.clear()
    this.edgeContentElements.clear()
    this.edgeLabelElements.clear()
    this.surface = undefined
    this.renderedSnapshotRevision = -1
    this.renderedPresentationRevision = -1
    this.renderedEdgeLabelVisibility = undefined
  }

  private updateNodes(frame: FdGraphRenderFrame): void {
    if (this.configuration.rendersNodes === false) {
      this.nodeLayer.replaceChildren()
      this.nodeElements.clear()
      this.portElementsByNode.clear()
      return
    }
    const visibleKeys = new Set<string>()
    for (const rendered of frame.nodes) {
      const key = graphElementKey(rendered.node.id)
      visibleKeys.add(key)
      let element = this.nodeElements.get(key)
      if (!element) {
        element = document.createElement('article')
        element.className = 'graph-node'
        element.setAttribute('part', 'node')
        element.dataset.fdGraphNode = key
        this.nodeElements.set(key, element)
        this.nodeLayer.append(element)
      }
      element.style.transform = `translate3d(${rendered.frame.x}px, ${rendered.frame.y}px, 0)`
      element.style.width = `${rendered.frame.width}px`
      element.style.height = `${rendered.frame.height}px`
      this.setOptionalStyle(element.style, '--fd-graph-node-fill', rendered.node.style?.fill)
      this.setOptionalStyle(element.style, '--fd-graph-node-stroke', rendered.node.style?.stroke)
      this.setOptionalStyle(element.style, '--fd-graph-node-color', rendered.node.style?.color)
      this.setOptionalStyle(element.style, '--fd-graph-node-accent', rendered.node.style?.accent)
      element.toggleAttribute('data-selected', rendered.selected)
      element.toggleAttribute('data-focused', rendered.focused)
      element.toggleAttribute('data-hovered', rendered.hovered)
      element.toggleAttribute('data-selectable', true)
      element.toggleAttribute(
        'data-draggable',
        rendered.capabilities?.contains(FdGraphCanvasNodeCapabilities.draggable) ?? true,
      )
      element.toggleAttribute(
        'data-resizable',
        rendered.capabilities?.contains(FdGraphCanvasNodeCapabilities.resizable) ?? true,
      )
      element.setAttribute(
        'aria-label',
        rendered.node.accessibilityLabel ?? rendered.node.label ?? String(rendered.node.id),
      )
      if (
        element.dataset.fdSnapshotRevision !== String(frame.snapshotRevision) ||
        this.configuration.createNodeContent ||
        this.configuration.createPortContent
      ) {
        const ports = this.portElements(rendered, frame)
        element.replaceChildren(this.nodeContent(rendered, frame), ...ports)
        this.portElementsByNode.set(key, ports)
        element.dataset.fdSnapshotRevision = String(frame.snapshotRevision)
      }
      this.updatePortSelection(this.portElementsByNode.get(key) ?? [], rendered.node, frame)
    }
    for (const [key, element] of this.nodeElements) {
      if (visibleKeys.has(key)) continue
      element.remove()
      this.nodeElements.delete(key)
      this.portElementsByNode.delete(key)
    }
  }

  private nodeContent(
    rendered: FdGraphRenderFrame['nodes'][number],
    frame: FdGraphRenderFrame,
  ): Node {
    const custom = this.configuration.createNodeContent?.(rendered, frame)
    if (custom instanceof Node) return custom
    if (typeof custom === 'string') return document.createTextNode(custom)
    const content = document.createElement('span')
    content.className = 'graph-node-content'
    content.setAttribute('part', 'node-content')
    const label = document.createElement('strong')
    label.className = 'graph-node-label'
    label.setAttribute('part', 'node-label')
    label.textContent = rendered.node.label ?? String(rendered.node.id)
    content.append(label)
    if (rendered.node.subtitle) {
      const subtitle = document.createElement('small')
      subtitle.className = 'graph-node-subtitle'
      subtitle.setAttribute('part', 'node-subtitle')
      subtitle.textContent = rendered.node.subtitle
      content.append(subtitle)
    }
    return content
  }

  private portElements(
    renderedNode: FdGraphRenderFrame['nodes'][number],
    frame: FdGraphRenderFrame,
  ): HTMLElement[] {
    const node = renderedNode.node
    return (node.ports ?? []).map((port: FdGraphSnapshotPort) => {
      const element = document.createElement('span')
      element.className = 'graph-port'
      element.setAttribute('part', 'port')
      element.dataset.fdGraphPort = graphElementKey(port.id)
      element.dataset.fdGraphNode = graphElementKey(node.id)
      element.dataset.side = port.side
      element.style.setProperty('--fd-graph-port-offset', `${(port.offset ?? 0.5) * 100}%`)
      element.setAttribute('aria-hidden', 'true')
      if (port.label) element.title = port.label
      const rendered: FdGraphRenderPort = {
        node,
        port,
        position: graphPortPoint({ ...node, frame: renderedNode.frame }, port.id),
        selected: frame.selectedPortIDsByNode.get(node.id)?.has(port.id) === true,
        focused:
          frame.focusedElement?.kind === 'port' &&
          frame.focusedElement.nodeID === node.id &&
          frame.focusedElement.portID === port.id,
        hovered: false,
      }
      const custom = this.configuration.createPortContent?.(rendered, frame)
      if (custom instanceof Node) element.append(custom)
      else if (typeof custom === 'string') element.textContent = custom
      return element
    })
  }

  private updatePortSelection(
    elements: readonly HTMLElement[],
    node: FdGraphRenderFrame['nodes'][number]['node'],
    frame: FdGraphRenderFrame,
  ): void {
    const selectedPortIDs = frame.selectedPortIDsByNode.get(node.id)
    for (const [index, port] of (node.ports ?? []).entries()) {
      const element = elements[index]
      if (!element) continue
      element.toggleAttribute('data-selected', selectedPortIDs?.has(port.id) === true)
      element.toggleAttribute(
        'data-focused',
        frame.focusedElement?.kind === 'port' &&
          frame.focusedElement.nodeID === node.id &&
          frame.focusedElement.portID === port.id,
      )
    }
  }

  private updateEdges(frame: FdGraphRenderFrame, edgeLabelsVisible: boolean): void {
    const visibleKeys = new Set<string>()
    for (const rendered of frame.edges) {
      const key = graphElementKey(rendered.edge.id)
      visibleKeys.add(key)
      if (this.configuration.rendersEdgePaths !== false) {
        let path = this.edgeElements.get(key)
        if (!path) {
          path = document.createElementNS(svgNamespace, 'path')
          path.classList.add('graph-edge')
          path.setAttribute('part', 'edge')
          path.dataset.fdGraphEdge = key
          this.edgeElements.set(key, path)
          this.edgeLayer.append(path)
        }
        path.setAttribute('d', graphEdgePath(rendered.geometry))
        this.setOptionalStyle(path.style, '--fd-graph-edge-color', rendered.edge.style?.color)
        this.setOptionalStyle(
          path.style,
          '--fd-graph-edge-width',
          rendered.edge.style?.width === undefined ? undefined : `${rendered.edge.style.width}px`,
        )
        path.toggleAttribute('data-dashed', rendered.edge.style?.dashed === true)
        path.toggleAttribute('data-selected', rendered.selected)
        path.toggleAttribute('data-focused', rendered.focused)
        path.toggleAttribute('data-hovered', rendered.hovered)
      }
      if (this.configuration.rendersEdgeDecorations !== false && rendered.geometry.targetArrow) {
        this.updateEdgeArrow(key, rendered)
      } else this.removeEdgeArrow(key)
      if (
        this.configuration.rendersEdgeLabels !== false &&
        rendered.edge.label &&
        edgeLabelsVisible
      )
        this.updateEdgeLabel(key, rendered, frame)
      else this.removeEdgeLabel(key)
      if (this.configuration.createEdgeContent) this.updateEdgeContent(key, rendered, frame)
      else this.removeEdgeContent(key)
    }
    for (const [key, path] of this.edgeElements) {
      if (visibleKeys.has(key)) continue
      path.remove()
      this.edgeElements.delete(key)
    }
    for (const key of this.edgeArrowElements.keys())
      if (!visibleKeys.has(key)) this.removeEdgeArrow(key)
    for (const key of this.edgeLabelElements.keys())
      if (!visibleKeys.has(key)) this.removeEdgeLabel(key)
    for (const key of this.edgeContentElements.keys())
      if (!visibleKeys.has(key)) this.removeEdgeContent(key)
  }

  private updateEdgeLabel(
    key: string,
    rendered: FdGraphRenderEdge,
    frame: FdGraphRenderFrame,
  ): void {
    let label = this.edgeLabelElements.get(key)
    if (!label) {
      label = document.createElement('span')
      label.classList.add('graph-edge-label')
      label.setAttribute('part', 'edge-label')
      label.dataset.fdGraphEdge = key
      this.edgeLabelElements.set(key, label)
      this.edgeLabelLayer.append(label)
    }
    if (label.dataset.fdSnapshotRevision !== String(frame.snapshotRevision)) {
      const custom = this.configuration.createEdgeLabelContent?.(rendered, frame)
      label.replaceChildren(
        custom instanceof Node
          ? custom
          : document.createTextNode(
              typeof custom === 'string' ? custom : (rendered.edge.label ?? ''),
            ),
      )
      label.dataset.fdSnapshotRevision = String(frame.snapshotRevision)
    }
    const position = graphEdgePoint(rendered.geometry, 0.5)
    label.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`
    this.setOptionalStyle(label.style, '--fd-graph-edge-color', rendered.edge.style?.color)
    label.toggleAttribute('data-selected', rendered.selected)
    label.toggleAttribute('data-focused', rendered.focused)
    label.toggleAttribute('data-hovered', rendered.hovered)
  }

  private updateEdgeContent(
    key: string,
    rendered: FdGraphRenderEdge,
    frame: FdGraphRenderFrame,
  ): void {
    let element = this.edgeContentElements.get(key)
    if (!element) {
      element = document.createElement('div')
      element.className = 'graph-edge-content'
      element.setAttribute('part', 'edge-content')
      element.dataset.fdGraphEdge = key
      element.style.cssText = 'position:absolute;pointer-events:auto'
      this.edgeContentElements.set(key, element)
      this.edgeContentLayer.append(element)
    }
    const padding = this.configuration.edgeContentPadding ?? 0
    const bounds = frame.viewport.transform.applyRect(rendered.geometry.route.conservativeBounds)
    element.style.transform = `translate3d(${bounds.x - padding}px, ${bounds.y - padding}px, 0)`
    element.style.width = `${bounds.width + padding * 2}px`
    element.style.height = `${bounds.height + padding * 2}px`
    const custom = this.configuration.createEdgeContent?.(rendered, frame)
    element.replaceChildren(
      custom instanceof Node
        ? custom
        : document.createTextNode(typeof custom === 'string' ? custom : ''),
    )
  }

  private removeEdgeContent(key: string): void {
    this.edgeContentElements.get(key)?.remove()
    this.edgeContentElements.delete(key)
  }

  private updateEdgeArrow(key: string, rendered: FdGraphRenderEdge): void {
    const geometry = rendered.geometry.targetArrow
    if (!geometry) return
    let arrow = this.edgeArrowElements.get(key)
    if (!arrow) {
      arrow = document.createElementNS(svgNamespace, 'path')
      arrow.classList.add('graph-edge-arrow')
      arrow.setAttribute('part', 'edge-decoration edge-arrow')
      arrow.dataset.fdGraphEdge = key
      this.edgeArrowElements.set(key, arrow)
      this.edgeLayer.append(arrow)
    }
    arrow.setAttribute('d', this.arrowPath(geometry))
    this.setOptionalStyle(arrow.style, '--fd-graph-edge-color', rendered.edge.style?.color)
    arrow.toggleAttribute('data-selected', rendered.selected)
    arrow.toggleAttribute('data-focused', rendered.focused)
    arrow.toggleAttribute('data-hovered', rendered.hovered)
  }

  private removeEdgeArrow(key: string): void {
    this.edgeArrowElements.get(key)?.remove()
    this.edgeArrowElements.delete(key)
  }

  private removeEdgeLabel(key: string): void {
    this.edgeLabelElements.get(key)?.remove()
    this.edgeLabelElements.delete(key)
  }

  private arrowPath(geometry: FdGraphArrowGeometry): string {
    const trailingControl = this.interpolate(geometry.baseTrailing, geometry.tip, 0.58)
    const leadingControl = this.interpolate(geometry.baseLeading, geometry.tip, 0.58)
    return `M ${geometry.tip.x} ${geometry.tip.y} Q ${trailingControl.x} ${trailingControl.y}, ${geometry.baseTrailing.x} ${geometry.baseTrailing.y} Q ${geometry.baseCenter.x} ${geometry.baseCenter.y}, ${geometry.baseLeading.x} ${geometry.baseLeading.y} Q ${leadingControl.x} ${leadingControl.y}, ${geometry.tip.x} ${geometry.tip.y} Z`
  }

  private interpolate(
    start: { x: number; y: number },
    end: { x: number; y: number },
    amount: number,
  ) {
    return {
      x: start.x + (end.x - start.x) * amount,
      y: start.y + (end.y - start.y) * amount,
    }
  }

  private setOptionalStyle(style: CSSStyleDeclaration, name: string, value?: string): void {
    if (value === undefined) style.removeProperty(name)
    else style.setProperty(name, value)
  }
}
