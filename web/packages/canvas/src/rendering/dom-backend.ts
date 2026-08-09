import type { FdGraphPort } from '../graph/model.js'
import { graphElementKey } from '../graph/model.js'
import type {
  FdGraphRenderEdge,
  FdGraphRenderFrame,
  FdGraphRenderingBackend,
  FdGraphRenderingSurface,
} from './backend.js'

export interface FdGraphDOMRenderingBackendConfiguration {
  readonly createNodeContent?: (node: FdGraphRenderFrame['nodes'][number]) => Node | string | null
}

const svgNamespace = 'http://www.w3.org/2000/svg'

export class FdGraphDOMRenderingBackend implements FdGraphRenderingBackend {
  readonly kind = 'dom'
  private readonly nodeElements = new Map<string, HTMLElement>()
  private readonly edgeElements = new Map<string, SVGPathElement>()
  private readonly edgeLabelElements = new Map<string, SVGTextElement>()
  private readonly edgeLayer = document.createElementNS(svgNamespace, 'svg')
  private readonly nodeLayer = document.createElement('div')
  private surface: FdGraphRenderingSurface | undefined
  private renderedSnapshotRevision = -1
  private renderedPresentationRevision = -1

  constructor(private readonly configuration: FdGraphDOMRenderingBackendConfiguration = {}) {
    this.edgeLayer.classList.add('graph-edge-layer')
    this.edgeLayer.setAttribute('part', 'edge-layer')
    this.edgeLayer.setAttribute('aria-hidden', 'true')
    this.nodeLayer.classList.add('graph-node-layer')
    this.nodeLayer.setAttribute('part', 'node-layer')
    this.nodeLayer.setAttribute('aria-hidden', 'true')
  }

  mount(surface: FdGraphRenderingSurface): void {
    if (this.surface === surface) return
    this.unmount()
    this.surface = surface
    surface.world.append(this.edgeLayer, this.nodeLayer)
  }

  render(frame: FdGraphRenderFrame): void {
    if (!this.surface) return
    if (
      frame.snapshotRevision === this.renderedSnapshotRevision &&
      frame.presentationRevision === this.renderedPresentationRevision
    ) {
      return
    }
    this.renderedSnapshotRevision = frame.snapshotRevision
    this.renderedPresentationRevision = frame.presentationRevision
    this.updateEdges(frame.edges)
    this.updateNodes(frame)
  }

  unmount(): void {
    this.edgeLayer.remove()
    this.nodeLayer.remove()
    this.edgeLayer.replaceChildren()
    this.nodeLayer.replaceChildren()
    this.nodeElements.clear()
    this.edgeElements.clear()
    this.edgeLabelElements.clear()
    this.surface = undefined
    this.renderedSnapshotRevision = -1
    this.renderedPresentationRevision = -1
  }

  private updateNodes(frame: FdGraphRenderFrame): void {
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
      element.toggleAttribute('data-selectable', rendered.node.capabilities?.selectable !== false)
      element.toggleAttribute('data-draggable', rendered.node.capabilities?.draggable !== false)
      element.toggleAttribute('data-resizable', rendered.node.capabilities?.resizable !== false)
      element.setAttribute(
        'aria-label',
        rendered.node.accessibilityLabel ?? rendered.node.label ?? String(rendered.node.id),
      )
      if (element.dataset.fdSnapshotRevision !== String(frame.snapshotRevision)) {
        element.replaceChildren(
          this.nodeContent(rendered),
          ...this.portElements(rendered.node.ports),
        )
        element.dataset.fdSnapshotRevision = String(frame.snapshotRevision)
      }
    }
    for (const [key, element] of this.nodeElements) {
      if (visibleKeys.has(key)) continue
      element.remove()
      this.nodeElements.delete(key)
    }
  }

  private nodeContent(rendered: FdGraphRenderFrame['nodes'][number]): Node {
    const custom = this.configuration.createNodeContent?.(rendered)
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

  private portElements(ports: readonly FdGraphPort[] | undefined): HTMLElement[] {
    return (ports ?? []).map((port) => {
      const element = document.createElement('span')
      element.className = 'graph-port'
      element.setAttribute('part', 'port')
      element.dataset.fdGraphPort = graphElementKey(port.id)
      element.dataset.side = port.side
      element.style.setProperty('--fd-graph-port-offset', `${(port.offset ?? 0.5) * 100}%`)
      element.setAttribute('aria-hidden', 'true')
      if (port.label) element.title = port.label
      return element
    })
  }

  private updateEdges(edges: readonly FdGraphRenderEdge[]): void {
    const visibleKeys = new Set<string>()
    for (const rendered of edges) {
      const key = graphElementKey(rendered.edge.id)
      visibleKeys.add(key)
      let path = this.edgeElements.get(key)
      if (!path) {
        path = document.createElementNS(svgNamespace, 'path')
        path.classList.add('graph-edge')
        path.setAttribute('part', 'edge')
        path.dataset.fdGraphEdge = key
        this.edgeElements.set(key, path)
        this.edgeLayer.append(path)
      }
      path.setAttribute('d', this.edgePath(rendered))
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
      if (rendered.edge.label) this.updateEdgeLabel(key, rendered)
      else this.removeEdgeLabel(key)
    }
    for (const [key, path] of this.edgeElements) {
      if (visibleKeys.has(key)) continue
      path.remove()
      this.edgeElements.delete(key)
      this.removeEdgeLabel(key)
    }
  }

  private updateEdgeLabel(key: string, rendered: FdGraphRenderEdge): void {
    let label = this.edgeLabelElements.get(key)
    if (!label) {
      label = document.createElementNS(svgNamespace, 'text')
      label.classList.add('graph-edge-label')
      label.setAttribute('part', 'edge-label')
      this.edgeLabelElements.set(key, label)
      this.edgeLayer.append(label)
    }
    label.textContent = rendered.edge.label ?? ''
    label.setAttribute('x', String((rendered.source.x + rendered.target.x) / 2))
    label.setAttribute('y', String((rendered.source.y + rendered.target.y) / 2 - 8))
  }

  private removeEdgeLabel(key: string): void {
    this.edgeLabelElements.get(key)?.remove()
    this.edgeLabelElements.delete(key)
  }

  private edgePath({ source, target }: FdGraphRenderEdge): string {
    const distance = Math.abs(target.x - source.x)
    const control = Math.max(distance * 0.45, 48)
    const direction = target.x >= source.x ? 1 : -1
    return `M ${source.x} ${source.y} C ${source.x + control * direction} ${source.y}, ${target.x - control * direction} ${target.y}, ${target.x} ${target.y}`
  }

  private setOptionalStyle(style: CSSStyleDeclaration, name: string, value?: string): void {
    if (value === undefined) style.removeProperty(name)
    else style.setProperty(name, value)
  }
}
