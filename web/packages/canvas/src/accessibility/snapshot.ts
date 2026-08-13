import type { FdCanvasRect } from '../geometry.js'
import type {
  FdAnyGraphSnapshot,
  FdGraphElementID,
  FdGraphElementReference,
  FdGraphPort,
} from '../graph/model.js'
import {
  graphEdgeReference,
  graphElementReferenceKey,
  graphNodeReference,
  graphPortPoint,
  graphPortReference,
} from '../graph/model.js'
import type { FdGraphSnapshotIndex } from '../graph/snapshot-index.js'
import type {
  FdGraphCanvasAccessibilityDescription,
  FdResolvedGraphCanvasAccessibilityConfiguration,
} from './configuration.js'

export type FdGraphCanvasAccessibilityElementKind = FdGraphElementReference['kind']

export type FdGraphCanvasAccessibilityElementReference = FdGraphElementReference

export interface FdGraphCanvasAccessibilityItem {
  readonly key: string
  readonly kind: FdGraphCanvasAccessibilityElementKind
  readonly reference: FdGraphCanvasAccessibilityElementReference
  readonly frame: FdCanvasRect
  readonly description: FdGraphCanvasAccessibilityDescription
  readonly relatedElementKeys: readonly string[]
}

export type FdGraphCanvasAccessibilitySnapshotID = string | number

const nodeKey = (nodeID: FdGraphElementID): string =>
  graphElementReferenceKey(graphNodeReference(nodeID))
const edgeKey = (edgeID: FdGraphElementID): string =>
  graphElementReferenceKey(graphEdgeReference(edgeID))
const portKey = (nodeID: FdGraphElementID, portID: FdGraphElementID): string =>
  graphElementReferenceKey(graphPortReference(nodeID, portID))

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

const validatedDescription = (
  description: FdGraphCanvasAccessibilityDescription,
): FdGraphCanvasAccessibilityDescription => {
  if (!description.label.trim()) throw new RangeError('accessibility label must not be empty')
  const actions = new Set<string>()
  for (const action of description.actions ?? []) {
    if (!action.label.trim()) throw new RangeError('accessibility action label must not be empty')
    if (actions.has(action.action)) {
      throw new RangeError(`duplicate accessibility action ${action.action}`)
    }
    actions.add(action.action)
  }
  return description
}

const isFiniteRect = (frame: FdCanvasRect): boolean =>
  Number.isFinite(frame.x) &&
  Number.isFinite(frame.y) &&
  Number.isFinite(frame.width) &&
  Number.isFinite(frame.height)

let snapshotSequence = 0

export class FdGraphCanvasAccessibilitySnapshot {
  readonly id: FdGraphCanvasAccessibilitySnapshotID
  readonly canvasDescription: FdGraphCanvasAccessibilityDescription
  private readonly itemValues: FdGraphCanvasAccessibilityItem[]
  private readonly indexByKey = new Map<string, number>()
  private readonly relationshipGraph: ReadonlyMap<string, readonly string[]>

  constructor(configuration: {
    readonly id?: FdGraphCanvasAccessibilitySnapshotID
    readonly canvasDescription: FdGraphCanvasAccessibilityDescription
    readonly items: readonly FdGraphCanvasAccessibilityItem[]
    readonly relationships?: ReadonlyMap<string, readonly string[]>
  }) {
    const { items } = configuration
    for (const [index, item] of items.entries()) {
      if (this.indexByKey.has(item.key)) {
        throw new RangeError(`duplicate accessibility element key ${item.key}`)
      }
      if (!isFiniteRect(item.frame)) {
        throw new RangeError(`invalid accessibility element frame ${item.key}`)
      }
      this.indexByKey.set(item.key, index)
    }
    const knownKeys = new Set(this.indexByKey.keys())
    const relationships = new Map(configuration.relationships ?? [])
    for (const item of items) {
      if (!relationships.has(item.key) && item.relatedElementKeys.length > 0) {
        relationships.set(item.key, item.relatedElementKeys)
      }
    }
    this.id = configuration.id ?? `accessibility-${++snapshotSequence}`
    this.canvasDescription = validatedDescription(configuration.canvasDescription)
    this.itemValues = items.map((item) => ({
      ...item,
      description: validatedDescription(item.description),
      relatedElementKeys: item.relatedElementKeys.filter((key) => knownKeys.has(key)),
    }))
    this.relationshipGraph = relationships
  }

  get items(): readonly FdGraphCanvasAccessibilityItem[] {
    return this.itemValues
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

  item(key: string): FdGraphCanvasAccessibilityItem | undefined {
    const index = this.indexByKey.get(key)
    return index === undefined ? undefined : this.itemValues[index]
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
    if (!this.contains(key)) return []
    const result: string[] = []
    const discovered = new Set([key])
    const queue = [...(this.relationshipGraph.get(key) ?? [])]
    for (let index = 0; index < queue.length; index += 1) {
      const candidate = queue[index]
      if (candidate === undefined || discovered.has(candidate)) continue
      discovered.add(candidate)
      if (this.contains(candidate)) result.push(candidate)
      else queue.push(...(this.relationshipGraph.get(candidate) ?? []))
    }
    return result
  }

  exposedItems(
    focusedKey: string | undefined,
    maximumCount: number,
  ): readonly FdGraphCanvasAccessibilityItem[] {
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

  updateGeometry(index: FdGraphSnapshotIndex, nodeIDs: ReadonlySet<FdGraphElementID>): void {
    const edgeIDs = new Set<FdGraphElementID>()
    for (const nodeID of nodeIDs) {
      const node = index.nodes.get(nodeID)
      if (!node) continue
      this.updateFrame(nodeKey(nodeID), node.frame)
      for (const port of node.ports ?? [])
        this.updateFrame(portKey(nodeID, port.id), portFrame(node, port))
      for (const edge of index.incidentEdges(nodeID)) edgeIDs.add(edge.id)
    }
    for (const edgeID of edgeIDs) {
      const edge = index.edges.get(edgeID)
      if (!edge) continue
      this.updateFrame(
        edgeKey(edgeID),
        edgeFrame(index.endpointPoint(edge, 'source'), index.endpointPoint(edge, 'target')),
      )
    }
  }

  private updateFrame(key: string, frame: FdCanvasRect): void {
    const index = this.indexByKey.get(key)
    const item = index === undefined ? undefined : this.itemValues[index]
    if (index === undefined || !item) return
    this.itemValues[index] = { ...item, frame }
  }
}

export function createGraphCanvasAccessibilitySnapshot(
  graph: FdAnyGraphSnapshot,
  configuration: FdResolvedGraphCanvasAccessibilityConfiguration,
): FdGraphCanvasAccessibilitySnapshot {
  const canvasDescription = { label: configuration.canvasLabel }
  if (!configuration.enabled) {
    return new FdGraphCanvasAccessibilitySnapshot({ canvasDescription, items: [] })
  }
  const items: FdGraphCanvasAccessibilityItem[] = []
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
  const relationships = new Map<string, string[]>()
  const appendRelationship = (source: string, target: string): void => {
    const related = relationships.get(source) ?? []
    related.push(target)
    relationships.set(source, related)
  }
  for (const edge of graph.edges) {
    const edgeElementKey = edgeKey(edge.id)
    const sourceKey =
      edge.source.portID === undefined
        ? nodeKey(edge.source.nodeID)
        : portKey(edge.source.nodeID, edge.source.portID)
    const targetKey =
      edge.target.portID === undefined
        ? nodeKey(edge.target.nodeID)
        : portKey(edge.target.nodeID, edge.target.portID)
    relationships.set(edgeElementKey, [sourceKey, targetKey])
    appendRelationship(sourceKey, edgeElementKey)
    appendRelationship(targetKey, edgeElementKey)
  }
  for (const node of graph.nodes) {
    for (const port of node.ports ?? []) {
      const nodeElementKey = nodeKey(node.id)
      const portElementKey = portKey(node.id, port.id)
      appendRelationship(portElementKey, nodeElementKey)
      appendRelationship(nodeElementKey, portElementKey)
    }
  }
  for (const node of graph.nodes) {
    const representation = configuration.nodeRepresentation(node)
    if (representation.kind === 'element') {
      items.push({
        key: nodeKey(node.id),
        kind: 'node',
        reference: { kind: 'node', nodeID: node.id },
        frame: node.frame,
        description: validatedDescription(representation.description),
        relatedElementKeys: relationships.get(nodeKey(node.id)) ?? [],
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
        description: validatedDescription(portRepresentation.description),
        relatedElementKeys: relationships.get(portKey(node.id, port.id)) ?? [],
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
      description: validatedDescription(representation.description),
      relatedElementKeys: relationships.get(edgeKey(edge.id)) ?? [],
    })
  }
  return new FdGraphCanvasAccessibilitySnapshot({ canvasDescription, items, relationships })
}
