import type { FdCanvasRect } from '../geometry.js'
import type { FdAnyGraphSnapshot, FdGraphElementID, FdGraphPort } from '../graph/model.js'
import { graphElementKey, graphPortPoint } from '../graph/model.js'
import type {
  FdGraphAccessibilityDescription,
  FdResolvedGraphCanvasAccessibilityConfiguration,
} from './configuration.js'

export type FdGraphAccessibilityElementKind = 'node' | 'port' | 'edge'

export interface FdGraphAccessibilityElementReference {
  readonly kind: FdGraphAccessibilityElementKind
  readonly nodeID?: FdGraphElementID
  readonly portID?: FdGraphElementID
  readonly edgeID?: FdGraphElementID
}

export interface FdGraphAccessibilityItem {
  readonly key: string
  readonly kind: FdGraphAccessibilityElementKind
  readonly reference: FdGraphAccessibilityElementReference
  readonly frame: FdCanvasRect
  readonly description: FdGraphAccessibilityDescription
  readonly relatedElementKeys: readonly string[]
}

const nodeKey = (nodeID: FdGraphElementID): string => `node:${graphElementKey(nodeID)}`
const edgeKey = (edgeID: FdGraphElementID): string => `edge:${graphElementKey(edgeID)}`
const portKey = (nodeID: FdGraphElementID, portID: FdGraphElementID): string =>
  `port:${graphElementKey(nodeID)}:${graphElementKey(portID)}`

const portFrame = (node: FdAnyGraphSnapshot['nodes'][number], port: FdGraphPort): FdCanvasRect => {
  const point = graphPortPoint(node, port.id)
  return { x: point.x - 11, y: point.y - 11, width: 22, height: 22 }
}

const edgeFrame = (
  source: ReturnType<typeof graphPortPoint>,
  target: ReturnType<typeof graphPortPoint>,
): FdCanvasRect => ({
  x: Math.min(source.x, target.x),
  y: Math.min(source.y, target.y),
  width: Math.max(Math.abs(target.x - source.x), 22),
  height: Math.max(Math.abs(target.y - source.y), 22),
})

export class FdGraphAccessibilitySnapshot {
  readonly items: readonly FdGraphAccessibilityItem[]
  private readonly indexByKey = new Map<string, number>()

  constructor(items: readonly FdGraphAccessibilityItem[]) {
    for (const [index, item] of items.entries()) {
      if (this.indexByKey.has(item.key)) {
        throw new RangeError(`duplicate accessibility element key ${item.key}`)
      }
      this.indexByKey.set(item.key, index)
    }
    this.items = items
  }

  get firstElementKey(): string | undefined {
    return this.items[0]?.key
  }

  get lastElementKey(): string | undefined {
    return this.items.at(-1)?.key
  }

  contains(key: string): boolean {
    return this.indexByKey.has(key)
  }

  item(key: string): FdGraphAccessibilityItem | undefined {
    const index = this.indexByKey.get(key)
    return index === undefined ? undefined : this.items[index]
  }

  indexOf(key: string): number | undefined {
    return this.indexByKey.get(key)
  }

  reconciledFocus(preferredKey: string | undefined): string | undefined {
    return preferredKey && this.contains(preferredKey) ? preferredKey : this.firstElementKey
  }

  elementKeyAfter(key: string): string | undefined {
    const index = this.indexByKey.get(key)
    return index === undefined ? undefined : this.items[index + 1]?.key
  }

  elementKeyBefore(key: string): string | undefined {
    const index = this.indexByKey.get(key)
    return index === undefined ? undefined : this.items[index - 1]?.key
  }

  relatedElementKeys(key: string): readonly string[] {
    return this.item(key)?.relatedElementKeys.filter((related) => this.contains(related)) ?? []
  }

  exposedItems(
    focusedKey: string | undefined,
    maximumCount: number,
  ): readonly FdGraphAccessibilityItem[] {
    if (!Number.isInteger(maximumCount) || maximumCount <= 0) {
      throw new RangeError('maximum exposed accessibility item count must be a positive integer')
    }
    if (this.items.length <= maximumCount) return this.items
    const focusedIndex = focusedKey ? (this.indexByKey.get(focusedKey) ?? 0) : 0
    const start = Math.min(
      Math.max(focusedIndex - Math.floor(maximumCount / 2), 0),
      this.items.length - maximumCount,
    )
    return this.items.slice(start, start + maximumCount)
  }
}

export function createGraphAccessibilitySnapshot(
  graph: FdAnyGraphSnapshot,
  configuration: FdResolvedGraphCanvasAccessibilityConfiguration,
): FdGraphAccessibilitySnapshot {
  if (!configuration.enabled) return new FdGraphAccessibilitySnapshot([])
  const items: FdGraphAccessibilityItem[] = []
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
  const relatedNodes = new Map<FdGraphElementID, string[]>()
  const appendRelatedNode = (nodeID: FdGraphElementID, relatedNodeID: FdGraphElementID): void => {
    const related = relatedNodes.get(nodeID) ?? []
    related.push(nodeKey(relatedNodeID))
    relatedNodes.set(nodeID, related)
  }
  for (const edge of graph.edges) {
    appendRelatedNode(edge.source.nodeID, edge.target.nodeID)
    appendRelatedNode(edge.target.nodeID, edge.source.nodeID)
  }
  for (const node of graph.nodes) {
    const representation = configuration.nodeRepresentation(node)
    if (representation.kind === 'element') {
      items.push({
        key: nodeKey(node.id),
        kind: 'node',
        reference: { kind: 'node', nodeID: node.id },
        frame: node.frame,
        description: representation.description,
        relatedElementKeys: relatedNodes.get(node.id) ?? [],
      })
    }
    for (const port of node.ports ?? []) {
      const portRepresentation = configuration.portRepresentation({ node, port })
      if (portRepresentation.kind === 'hidden') continue
      items.push({
        key: portKey(node.id, port.id),
        kind: 'port',
        reference: { kind: 'port', nodeID: node.id, portID: port.id },
        frame: portFrame(node, port),
        description: portRepresentation.description,
        relatedElementKeys: [nodeKey(node.id)],
      })
    }
  }
  for (const edge of graph.edges) {
    const representation = configuration.edgeRepresentation(edge)
    if (representation.kind === 'hidden') continue
    const sourceNode = nodes.get(edge.source.nodeID)
    const targetNode = nodes.get(edge.target.nodeID)
    if (!sourceNode || !targetNode) continue
    items.push({
      key: edgeKey(edge.id),
      kind: 'edge',
      reference: { kind: 'edge', edgeID: edge.id },
      frame: edgeFrame(
        graphPortPoint(sourceNode, edge.source.portID),
        graphPortPoint(targetNode, edge.target.portID),
      ),
      description: representation.description,
      relatedElementKeys: [nodeKey(edge.source.nodeID), nodeKey(edge.target.nodeID)],
    })
  }
  return new FdGraphAccessibilitySnapshot(items)
}

export const graphNodeAccessibilityKey = nodeKey
