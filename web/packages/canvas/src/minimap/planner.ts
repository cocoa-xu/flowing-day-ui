import type { FdCanvasPoint, FdCanvasRect } from '../geometry.js'
import type { FdAnyGraphSnapshot } from '../graph/model.js'
import { graphPortPoint } from '../graph/model.js'
import type { FdGraphSnapshotIndex } from '../graph/snapshot-index.js'
import type {
  FdGraphMiniMapRepresentation,
  FdResolvedGraphMiniMapPerformanceConfiguration,
} from './configuration.js'
import type { FdGraphMiniMapTransform } from './transform.js'

export interface FdGraphMiniMapNodeBatch {
  readonly styleIndex: number
  readonly rects: readonly FdCanvasRect[]
  readonly drawsStroke: boolean
}

export interface FdGraphMiniMapEdgeSegment {
  readonly source: FdCanvasPoint
  readonly target: FdCanvasPoint
}

export interface FdGraphMiniMapRenderPlan {
  readonly snapshotID: string | number
  readonly transform: FdGraphMiniMapTransform
  readonly nodeBatches: readonly FdGraphMiniMapNodeBatch[]
  readonly edgeSegments: readonly FdGraphMiniMapEdgeSegment[]
  readonly aggregated: boolean
}

export interface FdGraphMiniMapPlannerOptions {
  readonly snapshot: FdAnyGraphSnapshot
  readonly index: FdGraphSnapshotIndex
  readonly transform: FdGraphMiniMapTransform
  readonly representation: FdGraphMiniMapRepresentation
  readonly performance: FdResolvedGraphMiniMapPerformanceConfiguration
  readonly availableNodeStyleCount: number
  readonly nodeStyleIndex: (node: FdAnyGraphSnapshot['nodes'][number]) => number
  readonly signal?: AbortSignal
}

interface CellRange {
  readonly minimumColumn: number
  readonly maximumColumn: number
  readonly minimumRow: number
  readonly maximumRow: number
}

const cancellationStride = 2_048

const visibleNodeRect = (rect: FdCanvasRect): FdCanvasRect => {
  const width = Math.max(rect.width, 1)
  const height = Math.max(rect.height, 1)
  return {
    x: rect.x + rect.width / 2 - width / 2,
    y: rect.y + rect.height / 2 - height / 2,
    width,
    height,
  }
}

const checkCancellation = (signal: AbortSignal | undefined, index: number): void => {
  if (index % cancellationStride === 0) signal?.throwIfAborted()
}

const normalizedStyle = (style: number): number =>
  Number.isSafeInteger(style) && style >= 0 ? style : 0

const resolvedStyle = (
  requested: number,
  styles: { readonly size: number; has(value: number): boolean },
  maximumStyleCount: number,
  fallback: number | undefined,
): number =>
  styles.has(requested) || styles.size < maximumStyleCount ? requested : (fallback ?? 0)

export function planGraphMiniMap(options: FdGraphMiniMapPlannerOptions): FdGraphMiniMapRenderPlan {
  const viewArea = Math.max(options.transform.viewSize.width * options.transform.viewSize.height, 1)
  const nodeBudget = Math.max(
    Math.floor(viewArea * options.performance.maximumNodePrimitiveDensity),
    1,
  )
  const aggregated =
    options.representation === 'adaptive' && options.snapshot.nodes.length > nodeBudget
  const maximumStyleCount = Math.min(
    Math.max(options.availableNodeStyleCount, 1),
    options.performance.maximumAdaptiveStyleCount,
  )
  return {
    snapshotID: options.snapshot.id,
    transform: options.transform,
    nodeBatches: aggregated
      ? aggregateNodes(options, maximumStyleCount)
      : batchNodes(
          options,
          options.representation === 'adaptive' ? maximumStyleCount : Number.MAX_SAFE_INTEGER,
        ),
    edgeSegments: edgeSegments(options, viewArea),
    aggregated,
  }
}

function batchNodes(
  options: FdGraphMiniMapPlannerOptions,
  maximumStyleCount: number,
): FdGraphMiniMapNodeBatch[] {
  const rectsByStyle = new Map<number, FdCanvasRect[]>()
  let fallbackStyle: number | undefined
  for (let index = 0; index < options.snapshot.nodes.length; index += 1) {
    checkCancellation(options.signal, index)
    const node = options.snapshot.nodes[index]
    if (!node) continue
    const requested = normalizedStyle(options.nodeStyleIndex(node))
    const style = resolvedStyle(requested, rectsByStyle, maximumStyleCount, fallbackStyle)
    fallbackStyle ??= style
    const rects = rectsByStyle.get(style) ?? []
    rects.push(visibleNodeRect(options.transform.applyRect(node.frame)))
    rectsByStyle.set(style, rects)
  }
  return [...rectsByStyle]
    .sort(([first], [second]) => first - second)
    .map(([styleIndex, rects]) => ({ styleIndex, rects, drawsStroke: true }))
}

function aggregateNodes(
  options: FdGraphMiniMapPlannerOptions,
  maximumStyleCount: number,
): FdGraphMiniMapNodeBatch[] {
  const requestedCellSize = options.performance.aggregationCellSize
  const requestedCellCount =
    Math.ceil(options.transform.viewSize.width / requestedCellSize) *
    Math.ceil(options.transform.viewSize.height / requestedCellSize)
  const cellScale = Math.max(
    Math.sqrt(requestedCellCount / options.performance.maximumAggregationCellCount),
    1,
  )
  const cellSize = requestedCellSize * cellScale
  const columns = Math.max(Math.ceil(options.transform.viewSize.width / cellSize), 1)
  const rows = Math.max(Math.ceil(options.transform.viewSize.height / cellSize), 1)
  if (maximumStyleCount === 1) {
    return aggregateSingleStyleNodes(options, columns, rows, cellSize)
  }

  const rangesByStyle = new Map<number, number[]>()
  let fallbackStyle: number | undefined
  for (let index = 0; index < options.snapshot.nodes.length; index += 1) {
    checkCancellation(options.signal, index)
    const node = options.snapshot.nodes[index]
    if (!node) continue
    const range = cellRange(
      visibleNodeRect(options.transform.applyRect(node.frame)),
      columns,
      rows,
      cellSize,
    )
    if (!range) continue
    const requested = normalizedStyle(options.nodeStyleIndex(node))
    const style = resolvedStyle(requested, rangesByStyle, maximumStyleCount, fallbackStyle)
    fallbackStyle ??= style
    const ranges = rangesByStyle.get(style) ?? []
    ranges.push(range.minimumColumn, range.maximumColumn, range.minimumRow, range.maximumRow)
    rangesByStyle.set(style, ranges)
  }

  const winningCounts = new Int32Array(columns * rows)
  const winningStyles = new Int32Array(columns * rows)
  winningStyles.fill(fallbackStyle ?? 0)
  for (const [style, ranges] of [...rangesByStyle].sort(([first], [second]) => first - second)) {
    options.signal?.throwIfAborted()
    const difference = new Int32Array((columns + 1) * (rows + 1))
    addRanges(difference, columns + 1, ranges, options.signal)
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const differenceIndex = row * (columns + 1) + column
        const left = column > 0 ? (difference[differenceIndex - 1] ?? 0) : 0
        const above = row > 0 ? (difference[differenceIndex - columns - 1] ?? 0) : 0
        const diagonal =
          row > 0 && column > 0 ? (difference[differenceIndex - columns - 2] ?? 0) : 0
        difference[differenceIndex] = (difference[differenceIndex] ?? 0) + left + above - diagonal
        const cellIndex = row * columns + column
        if ((difference[differenceIndex] ?? 0) > (winningCounts[cellIndex] ?? 0)) {
          winningCounts[cellIndex] = difference[differenceIndex] ?? 0
          winningStyles[cellIndex] = style
        }
      }
    }
  }

  const rectsByStyle = new Map<number, FdCanvasRect[]>()
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column
      if ((winningCounts[index] ?? 0) <= 0) continue
      const style = winningStyles[index] ?? 0
      const rects = rectsByStyle.get(style) ?? []
      rects.push(cellRect(column, row, cellSize, options.transform.viewSize))
      rectsByStyle.set(style, rects)
    }
  }
  return [...rectsByStyle]
    .sort(([first], [second]) => first - second)
    .map(([styleIndex, rects]) => ({ styleIndex, rects, drawsStroke: false }))
}

function aggregateSingleStyleNodes(
  options: FdGraphMiniMapPlannerOptions,
  columns: number,
  rows: number,
  cellSize: number,
): FdGraphMiniMapNodeBatch[] {
  const stride = columns + 1
  const difference = new Int32Array(stride * (rows + 1))
  for (let index = 0; index < options.snapshot.nodes.length; index += 1) {
    checkCancellation(options.signal, index)
    const node = options.snapshot.nodes[index]
    if (!node) continue
    const range = cellRange(
      visibleNodeRect(options.transform.applyRect(node.frame)),
      columns,
      rows,
      cellSize,
    )
    if (range) addRange(difference, stride, range)
  }
  const rects: FdCanvasRect[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * stride + column
      const left = column > 0 ? (difference[index - 1] ?? 0) : 0
      const above = row > 0 ? (difference[index - stride] ?? 0) : 0
      const diagonal = row > 0 && column > 0 ? (difference[index - stride - 1] ?? 0) : 0
      difference[index] = (difference[index] ?? 0) + left + above - diagonal
      if ((difference[index] ?? 0) > 0) {
        rects.push(cellRect(column, row, cellSize, options.transform.viewSize))
      }
    }
  }
  return rects.length > 0 ? [{ styleIndex: 0, rects, drawsStroke: false }] : []
}

function edgeSegments(
  options: FdGraphMiniMapPlannerOptions,
  viewArea: number,
): FdGraphMiniMapEdgeSegment[] {
  if (options.representation === 'silhouette') return []
  if (
    options.representation === 'adaptive' &&
    options.snapshot.edges.length > viewArea * options.performance.maximumEdgePrimitiveDensity
  ) {
    return []
  }
  return options.snapshot.edges.flatMap((edge, index) => {
    checkCancellation(options.signal, index)
    const sourceNode = options.index.nodes.get(edge.source.nodeID)
    const targetNode = options.index.nodes.get(edge.target.nodeID)
    if (!sourceNode || !targetNode) return []
    return [
      {
        source: options.transform.applyPoint(graphPortPoint(sourceNode, edge.source.portID)),
        target: options.transform.applyPoint(graphPortPoint(targetNode, edge.target.portID)),
      },
    ]
  })
}

function addRanges(
  difference: Int32Array,
  stride: number,
  ranges: readonly number[],
  signal: AbortSignal | undefined,
): void {
  for (let index = 0; index < ranges.length; index += 4) {
    checkCancellation(signal, index)
    addRange(difference, stride, {
      minimumColumn: ranges[index] ?? 0,
      maximumColumn: ranges[index + 1] ?? 0,
      minimumRow: ranges[index + 2] ?? 0,
      maximumRow: ranges[index + 3] ?? 0,
    })
  }
}

function addRange(difference: Int32Array, stride: number, range: CellRange): void {
  const topLeft = range.minimumRow * stride + range.minimumColumn
  const topRight = range.minimumRow * stride + range.maximumColumn + 1
  const bottomLeft = (range.maximumRow + 1) * stride + range.minimumColumn
  const bottomRight = (range.maximumRow + 1) * stride + range.maximumColumn + 1
  difference[topLeft] = (difference[topLeft] ?? 0) + 1
  difference[topRight] = (difference[topRight] ?? 0) - 1
  difference[bottomLeft] = (difference[bottomLeft] ?? 0) - 1
  difference[bottomRight] = (difference[bottomRight] ?? 0) + 1
}

function cellRange(
  rect: FdCanvasRect,
  columns: number,
  rows: number,
  cellSize: number,
): CellRange | undefined {
  const minimumColumn = Math.max(Math.floor(rect.x / cellSize), 0)
  const maximumColumn = Math.min(Math.ceil((rect.x + rect.width) / cellSize) - 1, columns - 1)
  const minimumRow = Math.max(Math.floor(rect.y / cellSize), 0)
  const maximumRow = Math.min(Math.ceil((rect.y + rect.height) / cellSize) - 1, rows - 1)
  if (minimumColumn > maximumColumn || minimumRow > maximumRow) return undefined
  return { minimumColumn, maximumColumn, minimumRow, maximumRow }
}

function cellRect(
  column: number,
  row: number,
  cellSize: number,
  viewSize: { readonly width: number; readonly height: number },
): FdCanvasRect {
  const x = column * cellSize
  const y = row * cellSize
  return {
    x,
    y,
    width: Math.min(cellSize, viewSize.width - x),
    height: Math.min(cellSize, viewSize.height - y),
  }
}
