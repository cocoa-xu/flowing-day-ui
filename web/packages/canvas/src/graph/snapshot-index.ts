import { canvasRectsIntersect, type FdCanvasPoint, type FdCanvasRect } from '../geometry.js'
import {
  type FdAnyGraphEdge,
  type FdAnyGraphNode,
  type FdAnyGraphSnapshot,
  type FdGraphElementID,
  type FdGraphSnapshotIssue,
  FdGraphSnapshotValidationError,
  graphElementKey,
  graphPortPoint,
} from './model.js'

export interface FdGraphSpatialIndexConfiguration {
  readonly cellSize?: number
  readonly maximumCellsPerElement?: number
}

export interface FdGraphSpatialQueryOptions<ID extends FdGraphElementID = FdGraphElementID> {
  readonly maximumCount?: number
  readonly excluding?: ReadonlySet<ID>
}

const defaultSpatialIndexConfiguration = {
  cellSize: 512,
  maximumCellsPerElement: 64,
} as const

const edgeBounds = (source: FdCanvasPoint, target: FdCanvasPoint): FdCanvasRect => ({
  x: Math.min(source.x, target.x),
  y: Math.min(source.y, target.y),
  width: Math.abs(target.x - source.x),
  height: Math.abs(target.y - source.y),
})

const isValidFrame = (frame: FdCanvasRect): boolean =>
  Number.isFinite(frame.x) &&
  Number.isFinite(frame.y) &&
  Number.isFinite(frame.width) &&
  Number.isFinite(frame.height) &&
  frame.width >= 0 &&
  frame.height >= 0

class FdGraphBoundsGrid<ID extends FdGraphElementID> {
  private readonly cells = new Map<string, Set<ID>>()
  private readonly overflow = new Set<ID>()
  private readonly bounds = new Map<ID, FdCanvasRect>()

  constructor(
    private readonly cellSize: number,
    private readonly maximumCellsPerElement: number,
  ) {}

  insert(id: ID, bounds: FdCanvasRect): void {
    this.bounds.set(id, bounds)
    const range = this.cellRange(bounds)
    const cellCount = (range.maximumX - range.minimumX + 1) * (range.maximumY - range.minimumY + 1)
    if (cellCount > this.maximumCellsPerElement) {
      this.overflow.add(id)
      return
    }
    for (let y = range.minimumY; y <= range.maximumY; y += 1) {
      for (let x = range.minimumX; x <= range.maximumX; x += 1) {
        const key = `${x}:${y}`
        const values = this.cells.get(key) ?? new Set<ID>()
        values.add(id)
        this.cells.set(key, values)
      }
    }
  }

  remove(id: ID): FdCanvasRect | undefined {
    const bounds = this.bounds.get(id)
    if (!bounds) return undefined
    this.bounds.delete(id)
    if (this.overflow.delete(id)) return bounds
    const range = this.cellRange(bounds)
    for (let y = range.minimumY; y <= range.maximumY; y += 1) {
      for (let x = range.minimumX; x <= range.maximumX; x += 1) {
        const key = `${x}:${y}`
        const values = this.cells.get(key)
        values?.delete(id)
        if (values?.size === 0) this.cells.delete(key)
      }
    }
    return bounds
  }

  allBounds(): IterableIterator<FdCanvasRect> {
    return this.bounds.values()
  }

  query(rect: FdCanvasRect, options: FdGraphSpatialQueryOptions<ID> = {}): Set<ID> {
    const maximumCount = options.maximumCount ?? Number.MAX_SAFE_INTEGER
    if (!Number.isInteger(maximumCount) || maximumCount <= 0) {
      throw new RangeError('maximum query count must be a positive integer')
    }
    const candidates = new Set<ID>()
    const consider = (id: ID): boolean => {
      if (options.excluding?.has(id) || candidates.has(id)) return false
      const bounds = this.bounds.get(id)
      if (!bounds || !canvasRectsIntersect(bounds, rect)) return false
      candidates.add(id)
      return candidates.size >= maximumCount
    }
    for (const id of this.overflow) if (consider(id)) return candidates
    const range = this.cellRange(rect)
    for (let y = range.minimumY; y <= range.maximumY; y += 1) {
      for (let x = range.minimumX; x <= range.maximumX; x += 1) {
        for (const id of this.cells.get(`${x}:${y}`) ?? []) {
          if (consider(id)) return candidates
        }
      }
    }
    return candidates
  }

  private cellRange(rect: FdCanvasRect) {
    return {
      minimumX: Math.floor(rect.x / this.cellSize),
      minimumY: Math.floor(rect.y / this.cellSize),
      maximumX: Math.floor((rect.x + rect.width) / this.cellSize),
      maximumY: Math.floor((rect.y + rect.height) / this.cellSize),
    }
  }
}

export class FdGraphSnapshotIndex {
  snapshot: FdAnyGraphSnapshot
  readonly nodes = new Map<FdGraphElementID, FdAnyGraphNode>()
  readonly edges = new Map<FdGraphElementID, FdAnyGraphEdge>()
  contentBounds: FdCanvasRect = { x: 0, y: 0, width: 1, height: 1 }
  private readonly nodeGrid: FdGraphBoundsGrid<FdGraphElementID>
  private readonly edgeGrid: FdGraphBoundsGrid<FdGraphElementID>
  private readonly nodeOrder = new Map<FdGraphElementID, number>()
  private readonly edgeOrder = new Map<FdGraphElementID, number>()
  private readonly incidentEdgeIDs = new Map<FdGraphElementID, FdGraphElementID[]>()
  private minimumX = Number.POSITIVE_INFINITY
  private minimumY = Number.POSITIVE_INFINITY
  private maximumX = Number.NEGATIVE_INFINITY
  private maximumY = Number.NEGATIVE_INFINITY
  private minimumXCount = 0
  private minimumYCount = 0
  private maximumXCount = 0
  private maximumYCount = 0
  private contentBoundsNeedRecalculation = false

  constructor(snapshot: FdAnyGraphSnapshot, configuration: FdGraphSpatialIndexConfiguration = {}) {
    this.snapshot = snapshot
    const cellSize = configuration.cellSize ?? defaultSpatialIndexConfiguration.cellSize
    const maximumCellsPerElement =
      configuration.maximumCellsPerElement ??
      defaultSpatialIndexConfiguration.maximumCellsPerElement
    if (!Number.isFinite(cellSize) || cellSize <= 0)
      throw new RangeError('cell size must be positive')
    if (!Number.isInteger(maximumCellsPerElement) || maximumCellsPerElement <= 0) {
      throw new RangeError('maximum cells per element must be a positive integer')
    }
    this.nodeGrid = new FdGraphBoundsGrid(cellSize, maximumCellsPerElement)
    this.edgeGrid = new FdGraphBoundsGrid(cellSize, maximumCellsPerElement)

    const issues: FdGraphSnapshotIssue[] = []
    for (const [index, node] of snapshot.nodes.entries()) {
      if (this.nodes.has(node.id)) {
        issues.push({ kind: 'duplicateNodeID', nodeID: node.id })
        continue
      }
      if (!isValidFrame(node.frame)) issues.push({ kind: 'invalidNodeFrame', nodeID: node.id })
      const portIDs = new Set<string>()
      for (const port of node.ports ?? []) {
        const key = graphElementKey(port.id)
        if (portIDs.has(key)) {
          issues.push({ kind: 'duplicatePortID', nodeID: node.id, portID: port.id })
        }
        portIDs.add(key)
        if (
          port.offset !== undefined &&
          (!Number.isFinite(port.offset) || port.offset < 0 || port.offset > 1)
        ) {
          issues.push({ kind: 'invalidPortOffset', nodeID: node.id, portID: port.id })
        }
      }
      this.nodes.set(node.id, node)
      this.nodeOrder.set(node.id, index)
      if (isValidFrame(node.frame)) {
        this.nodeGrid.insert(node.id, node.frame)
        this.includeContentBounds(node.frame)
      }
    }

    for (const [index, edge] of snapshot.edges.entries()) {
      if (this.edges.has(edge.id)) {
        issues.push({ kind: 'duplicateEdgeID', edgeID: edge.id })
        continue
      }
      this.edges.set(edge.id, edge)
      this.edgeOrder.set(edge.id, index)
      const source = this.endpoint(edge.id, edge.source, issues)
      const target = this.endpoint(edge.id, edge.target, issues)
      if (!source || !target) continue
      const bounds = edgeBounds(source, target)
      this.edgeGrid.insert(edge.id, bounds)
      this.includeContentBounds(bounds)
      this.appendIncidentEdge(edge.source.nodeID, edge.id)
      if (edge.target.nodeID !== edge.source.nodeID) {
        this.appendIncidentEdge(edge.target.nodeID, edge.id)
      }
    }

    if (issues.length > 0) throw new FdGraphSnapshotValidationError(issues)
    this.syncContentBounds()
  }

  applyNodeFrames(
    snapshotID: string | number,
    updates: readonly { readonly nodeID: FdGraphElementID; readonly frame: FdCanvasRect }[],
  ): FdAnyGraphSnapshot {
    const frames = new Map<FdGraphElementID, FdCanvasRect>()
    const updatedNodes = new Map<FdGraphElementID, FdAnyGraphNode>()
    const affectedEdgeIDs = new Set<FdGraphElementID>()
    for (const { nodeID, frame } of updates) {
      if (frames.has(nodeID))
        throw new RangeError(`duplicate node frame ${graphElementKey(nodeID)}`)
      if (!isValidFrame(frame))
        throw new RangeError(`invalid node frame ${graphElementKey(nodeID)}`)
      const node = this.nodes.get(nodeID)
      if (!node) throw new RangeError(`missing node ${graphElementKey(nodeID)}`)
      frames.set(nodeID, frame)
      updatedNodes.set(nodeID, { ...node, frame })
      for (const edgeID of this.incidentEdgeIDs.get(nodeID) ?? []) affectedEdgeIDs.add(edgeID)
    }
    if (frames.size === 0) return this.snapshot

    for (const edgeID of affectedEdgeIDs) {
      const bounds = this.edgeGrid.remove(edgeID)
      if (bounds) this.removeContentBounds(bounds)
    }
    for (const [nodeID, node] of updatedNodes) {
      const bounds = this.nodeGrid.remove(nodeID)
      if (bounds) this.removeContentBounds(bounds)
      this.nodes.set(nodeID, node)
      this.nodeGrid.insert(nodeID, node.frame)
      this.includeContentBounds(node.frame)
    }
    for (const edgeID of affectedEdgeIDs) {
      const edge = this.edges.get(edgeID)
      if (!edge) continue
      const bounds = edgeBounds(
        this.endpointPoint(edge, 'source'),
        this.endpointPoint(edge, 'target'),
      )
      this.edgeGrid.insert(edgeID, bounds)
      this.includeContentBounds(bounds)
    }
    if (this.contentBoundsNeedRecalculation) this.recalculateContentBounds()
    this.syncContentBounds()

    this.snapshot = {
      ...this.snapshot,
      id: snapshotID,
      nodes: this.snapshot.nodes.map((node) => updatedNodes.get(node.id) ?? node),
    }
    return this.snapshot
  }

  incidentEdges(nodeID: FdGraphElementID): readonly FdAnyGraphEdge[] {
    return (this.incidentEdgeIDs.get(nodeID) ?? []).flatMap((edgeID) => {
      const edge = this.edges.get(edgeID)
      return edge ? [edge] : []
    })
  }

  nodesIn(rect: FdCanvasRect, options: FdGraphSpatialQueryOptions = {}): readonly FdAnyGraphNode[] {
    return this.orderedValues(this.nodeGrid.query(rect, options), this.nodes, this.nodeOrder)
  }

  edgesIn(rect: FdCanvasRect): readonly FdAnyGraphEdge[] {
    return this.orderedValues(this.edgeGrid.query(rect), this.edges, this.edgeOrder)
  }

  endpointPoint(edge: FdAnyGraphEdge, endpoint: 'source' | 'target'): FdCanvasPoint {
    const value = edge[endpoint]
    const node = this.nodes.get(value.nodeID)
    if (!node) throw new RangeError(`missing endpoint node ${graphElementKey(value.nodeID)}`)
    return graphPortPoint(node, value.portID)
  }

  private appendIncidentEdge(nodeID: FdGraphElementID, edgeID: FdGraphElementID): void {
    const values = this.incidentEdgeIDs.get(nodeID)
    if (values) values.push(edgeID)
    else this.incidentEdgeIDs.set(nodeID, [edgeID])
  }

  private includeContentBounds(bounds: FdCanvasRect): void {
    const maximumX = bounds.x + bounds.width
    const maximumY = bounds.y + bounds.height
    if (bounds.x < this.minimumX) {
      this.minimumX = bounds.x
      this.minimumXCount = 1
    } else if (bounds.x === this.minimumX) this.minimumXCount += 1
    if (bounds.y < this.minimumY) {
      this.minimumY = bounds.y
      this.minimumYCount = 1
    } else if (bounds.y === this.minimumY) this.minimumYCount += 1
    if (maximumX > this.maximumX) {
      this.maximumX = maximumX
      this.maximumXCount = 1
    } else if (maximumX === this.maximumX) this.maximumXCount += 1
    if (maximumY > this.maximumY) {
      this.maximumY = maximumY
      this.maximumYCount = 1
    } else if (maximumY === this.maximumY) this.maximumYCount += 1
  }

  private removeContentBounds(bounds: FdCanvasRect): void {
    if (bounds.x === this.minimumX && --this.minimumXCount === 0) {
      this.contentBoundsNeedRecalculation = true
    }
    if (bounds.y === this.minimumY && --this.minimumYCount === 0) {
      this.contentBoundsNeedRecalculation = true
    }
    if (bounds.x + bounds.width === this.maximumX && --this.maximumXCount === 0) {
      this.contentBoundsNeedRecalculation = true
    }
    if (bounds.y + bounds.height === this.maximumY && --this.maximumYCount === 0) {
      this.contentBoundsNeedRecalculation = true
    }
  }

  private recalculateContentBounds(): void {
    this.minimumX = Number.POSITIVE_INFINITY
    this.minimumY = Number.POSITIVE_INFINITY
    this.maximumX = Number.NEGATIVE_INFINITY
    this.maximumY = Number.NEGATIVE_INFINITY
    this.minimumXCount = 0
    this.minimumYCount = 0
    this.maximumXCount = 0
    this.maximumYCount = 0
    for (const bounds of this.nodeGrid.allBounds()) this.includeContentBounds(bounds)
    for (const bounds of this.edgeGrid.allBounds()) this.includeContentBounds(bounds)
    this.contentBoundsNeedRecalculation = false
  }

  private syncContentBounds(): void {
    this.contentBounds = Number.isFinite(this.minimumX)
      ? {
          x: this.minimumX,
          y: this.minimumY,
          width: this.maximumX - this.minimumX,
          height: this.maximumY - this.minimumY,
        }
      : { x: 0, y: 0, width: 1, height: 1 }
  }

  private endpoint(
    edgeID: FdGraphElementID,
    endpoint: { readonly nodeID: FdGraphElementID; readonly portID?: FdGraphElementID },
    issues: FdGraphSnapshotIssue[],
  ): FdCanvasPoint | undefined {
    const node = this.nodes.get(endpoint.nodeID)
    if (!node) {
      issues.push({ kind: 'missingEndpointNode', edgeID, nodeID: endpoint.nodeID })
      return undefined
    }
    if (endpoint.portID !== undefined && !node.ports?.some(({ id }) => id === endpoint.portID)) {
      issues.push({
        kind: 'missingEndpointPort',
        edgeID,
        nodeID: endpoint.nodeID,
        portID: endpoint.portID,
      })
      return undefined
    }
    return graphPortPoint(node, endpoint.portID)
  }

  private orderedValues<Value>(
    ids: Set<FdGraphElementID>,
    values: ReadonlyMap<FdGraphElementID, Value>,
    order: ReadonlyMap<FdGraphElementID, number>,
  ): Value[] {
    return [...ids]
      .sort((first, second) => (order.get(first) ?? 0) - (order.get(second) ?? 0))
      .flatMap((id) => {
        const value = values.get(id)
        return value === undefined ? [] : [value]
      })
  }
}
