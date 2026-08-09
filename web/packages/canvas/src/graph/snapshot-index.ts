import {
  canvasRectsIntersect,
  type FdCanvasPoint,
  type FdCanvasRect,
  unionCanvasRects,
} from '../geometry.js'
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

  query(rect: FdCanvasRect): Set<ID> {
    const candidates = new Set(this.overflow)
    const range = this.cellRange(rect)
    for (let y = range.minimumY; y <= range.maximumY; y += 1) {
      for (let x = range.minimumX; x <= range.maximumX; x += 1) {
        for (const id of this.cells.get(`${x}:${y}`) ?? []) candidates.add(id)
      }
    }
    for (const id of candidates) {
      const bounds = this.bounds.get(id)
      if (!bounds || !canvasRectsIntersect(bounds, rect)) candidates.delete(id)
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
  readonly snapshot: FdAnyGraphSnapshot
  readonly nodes = new Map<FdGraphElementID, FdAnyGraphNode>()
  readonly edges = new Map<FdGraphElementID, FdAnyGraphEdge>()
  readonly contentBounds: FdCanvasRect
  private readonly nodeGrid: FdGraphBoundsGrid<FdGraphElementID>
  private readonly edgeGrid: FdGraphBoundsGrid<FdGraphElementID>
  private readonly nodeOrder = new Map<FdGraphElementID, number>()
  private readonly edgeOrder = new Map<FdGraphElementID, number>()

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
    let contentBounds: FdCanvasRect | undefined
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
        contentBounds = unionCanvasRects(contentBounds, node.frame)
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
      contentBounds = unionCanvasRects(contentBounds, bounds)
    }

    if (issues.length > 0) throw new FdGraphSnapshotValidationError(issues)
    this.contentBounds = contentBounds ?? { x: 0, y: 0, width: 1, height: 1 }
  }

  nodesIn(rect: FdCanvasRect): readonly FdAnyGraphNode[] {
    return this.orderedValues(this.nodeGrid.query(rect), this.nodes, this.nodeOrder)
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
