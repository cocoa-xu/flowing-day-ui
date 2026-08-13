import { canvasRectsIntersect, type FdCanvasPoint, type FdCanvasRect } from '../geometry.js'
import type { FdGraphElementID } from '../graph/model.js'

export interface FdSpatialIndexConfigurationOptions {
  readonly bucketSize?: number
  readonly maximumCellsPerItem?: number
  readonly maximumCellsPerQuery?: number
  readonly maximumNearestCellsVisited?: number
}

export class FdSpatialIndexConfiguration {
  readonly bucketSize: number
  readonly maximumCellsPerItem: number
  readonly maximumCellsPerQuery: number
  readonly maximumNearestCellsVisited: number

  constructor(options: FdSpatialIndexConfigurationOptions = {}) {
    this.bucketSize = positiveNumber(options.bucketSize ?? 384, 'bucket size')
    this.maximumCellsPerItem = positiveInteger(
      options.maximumCellsPerItem ?? 4_096,
      'maximum cells per item',
    )
    this.maximumCellsPerQuery = positiveInteger(
      options.maximumCellsPerQuery ?? 65_536,
      'maximum cells per query',
    )
    this.maximumNearestCellsVisited = positiveInteger(
      options.maximumNearestCellsVisited ?? 65_536,
      'maximum nearest cells visited',
    )
  }
}

export interface FdSpatialIndexEntry<ItemID extends FdGraphElementID = FdGraphElementID> {
  readonly id: ItemID
  readonly frame: FdCanvasRect
}

export type FdSpatialIndexIssueKind =
  | 'duplicateItemID'
  | 'unknownItemID'
  | 'invalidFrame'
  | 'coordinateOutOfRange'
  | 'itemCellBudgetExceeded'

export class FdSpatialIndexIssue<ItemID extends FdGraphElementID = FdGraphElementID> extends Error {
  readonly kind: FdSpatialIndexIssueKind
  readonly itemID: ItemID

  constructor(kind: FdSpatialIndexIssueKind, itemID: ItemID) {
    super(kind)
    this.name = 'FdSpatialIndexIssue'
    this.kind = kind
    this.itemID = itemID
  }
}

interface Cell {
  readonly column: number
  readonly row: number
}

const cellKey = ({ column, row }: Cell): string => `${column}:${row}`

export class FdSpatialIndex<ItemID extends FdGraphElementID = FdGraphElementID> {
  readonly configuration: FdSpatialIndexConfiguration
  readonly orderedItemIDs: readonly ItemID[]
  readonly #orderByID = new Map<ItemID, number>()
  readonly #frameByID = new Map<ItemID, FdCanvasRect>()
  readonly #cellsByID = new Map<ItemID, readonly Cell[]>()
  readonly #buckets = new Map<string, Set<ItemID>>()
  #minimumColumn: number | undefined
  #maximumColumn: number | undefined
  #minimumRow: number | undefined
  #maximumRow: number | undefined

  constructor(
    entries: readonly FdSpatialIndexEntry<ItemID>[],
    configuration = new FdSpatialIndexConfiguration(),
  ) {
    this.configuration = configuration
    const orderedItemIDs: ItemID[] = []
    for (const entry of entries) {
      if (this.#orderByID.has(entry.id)) {
        throw new FdSpatialIndexIssue('duplicateItemID', entry.id)
      }
      const cells = this.cells(entry.frame, entry.id)
      this.#orderByID.set(entry.id, orderedItemIDs.length)
      orderedItemIDs.push(entry.id)
      this.#frameByID.set(entry.id, entry.frame)
      this.#cellsByID.set(entry.id, cells)
      this.insert(entry.id, cells)
    }
    this.orderedItemIDs = orderedItemIDs
  }

  frame(itemID: ItemID): FdCanvasRect | undefined {
    return this.#frameByID.get(itemID)
  }

  itemIDs(intersecting: FdCanvasRect): readonly ItemID[] {
    return this.itemIDsUnordered(intersecting).sort(
      (first, second) =>
        (this.#orderByID.get(first) as number) - (this.#orderByID.get(second) as number),
    )
  }

  itemIDsUnordered(intersecting: FdCanvasRect): ItemID[] {
    if (!usableRect(intersecting) || emptyRect(intersecting) || this.#buckets.size === 0) return []
    const queryCells = this.queryCells(intersecting)
    if (!queryCells) {
      return this.orderedItemIDs.filter((id) => {
        const frame = this.#frameByID.get(id)
        return frame ? canvasRectsIntersect(frame, intersecting) : false
      })
    }
    const matches = new Set<ItemID>()
    for (const cell of queryCells) {
      for (const itemID of this.#buckets.get(cellKey(cell)) ?? []) {
        const frame = this.#frameByID.get(itemID)
        if (frame && canvasRectsIntersect(frame, intersecting)) matches.add(itemID)
      }
    }
    return [...matches]
  }

  nearestItemID(to: FdCanvasPoint, excluding: ReadonlySet<ItemID> = new Set()): ItemID | undefined {
    if (!Number.isFinite(to.x) || !Number.isFinite(to.y)) return undefined
    const origin = this.cellContaining(to)
    if (
      !origin ||
      this.#minimumColumn === undefined ||
      this.#maximumColumn === undefined ||
      this.#minimumRow === undefined ||
      this.#maximumRow === undefined
    ) {
      return undefined
    }
    if (
      origin.column < this.#minimumColumn ||
      origin.column > this.#maximumColumn ||
      origin.row < this.#minimumRow ||
      origin.row > this.#maximumRow
    ) {
      return this.nearestItemIDByScanning(to, excluding)
    }
    const maximumRadius = Math.max(
      Math.abs(origin.column - this.#minimumColumn),
      Math.abs(origin.column - this.#maximumColumn),
      Math.abs(origin.row - this.#minimumRow),
      Math.abs(origin.row - this.#maximumRow),
    )
    const visited = new Set<ItemID>()
    let nearestID: ItemID | undefined
    let nearestDistance = Number.POSITIVE_INFINITY
    for (let radius = 0; radius <= maximumRadius; radius += 1) {
      if (cellsVisited(radius) > this.configuration.maximumNearestCellsVisited) {
        return this.nearestItemIDByScanning(to, excluding)
      }
      for (const cell of perimeter(origin, radius)) {
        for (const itemID of this.#buckets.get(cellKey(cell)) ?? []) {
          if (visited.has(itemID)) continue
          visited.add(itemID)
          const frame = this.#frameByID.get(itemID)
          if (!frame || excluding.has(itemID)) continue
          const distance = distanceSquared(to, frame)
          if (
            distance < nearestDistance ||
            (distance === nearestDistance && this.isOrdered(itemID, nearestID))
          ) {
            nearestID = itemID
            nearestDistance = distance
          }
        }
      }
      const boundaryDistance = distanceToOutside(to, origin, radius, this.configuration.bucketSize)
      if (nearestDistance <= boundaryDistance * boundaryDistance) break
    }
    return nearestID
  }

  updateFrame(frame: FdCanvasRect, itemID: ItemID): void {
    const oldCells = this.#cellsByID.get(itemID)
    if (!oldCells) throw new FdSpatialIndexIssue('unknownItemID', itemID)
    const newCells = this.cells(frame, itemID)
    const oldCellKeys = new Set(oldCells.map(cellKey))
    const newCellKeys = new Set(newCells.map(cellKey))
    for (const key of oldCellKeys) {
      if (newCellKeys.has(key)) continue
      const bucket = this.#buckets.get(key)
      bucket?.delete(itemID)
      if (bucket?.size === 0) this.#buckets.delete(key)
    }
    this.insert(
      itemID,
      newCells.filter((cell) => !oldCellKeys.has(cellKey(cell))),
    )
    this.#frameByID.set(itemID, frame)
    this.#cellsByID.set(itemID, newCells)
  }

  private cells(frame: FdCanvasRect, itemID: ItemID): readonly Cell[] {
    if (!usableRect(frame)) throw new FdSpatialIndexIssue('invalidFrame', itemID)
    const columns = this.cellRange(frame.x, frame.x + frame.width)
    const rows = this.cellRange(frame.y, frame.y + frame.height)
    if (!columns || !rows) throw new FdSpatialIndexIssue('coordinateOutOfRange', itemID)
    const cellCount = (columns.upper - columns.lower + 1) * (rows.upper - rows.lower + 1)
    if (!Number.isSafeInteger(cellCount) || cellCount > this.configuration.maximumCellsPerItem) {
      throw new FdSpatialIndexIssue('itemCellBudgetExceeded', itemID)
    }
    const result: Cell[] = []
    for (let column = columns.lower; column <= columns.upper; column += 1) {
      for (let row = rows.lower; row <= rows.upper; row += 1) result.push({ column, row })
    }
    return result
  }

  private queryCells(rect: FdCanvasRect): readonly Cell[] | undefined {
    const columns = this.cellRange(rect.x, rect.x + rect.width)
    const rows = this.cellRange(rect.y, rect.y + rect.height)
    if (!columns || !rows) return undefined
    const cellCount = (columns.upper - columns.lower + 1) * (rows.upper - rows.lower + 1)
    if (!Number.isSafeInteger(cellCount) || cellCount > this.configuration.maximumCellsPerQuery) {
      return undefined
    }
    const result: Cell[] = []
    for (let column = columns.lower; column <= columns.upper; column += 1) {
      for (let row = rows.lower; row <= rows.upper; row += 1) result.push({ column, row })
    }
    return result
  }

  private cellRange(minimum: number, maximum: number) {
    const lower = Math.floor(minimum / this.configuration.bucketSize)
    const upper = Math.floor(maximum / this.configuration.bucketSize)
    const limit = Math.floor(Number.MAX_SAFE_INTEGER / 4)
    if (lower < -limit || lower > limit || upper < -limit || upper > limit) return undefined
    return { lower, upper }
  }

  private cellContaining(point: FdCanvasPoint): Cell | undefined {
    const columns = this.cellRange(point.x, point.x)
    const rows = this.cellRange(point.y, point.y)
    return columns && rows ? { column: columns.lower, row: rows.lower } : undefined
  }

  private insert(itemID: ItemID, cells: readonly Cell[]): void {
    for (const cell of cells) {
      const key = cellKey(cell)
      const bucket = this.#buckets.get(key) ?? new Set<ItemID>()
      bucket.add(itemID)
      this.#buckets.set(key, bucket)
      this.#minimumColumn = Math.min(this.#minimumColumn ?? cell.column, cell.column)
      this.#maximumColumn = Math.max(this.#maximumColumn ?? cell.column, cell.column)
      this.#minimumRow = Math.min(this.#minimumRow ?? cell.row, cell.row)
      this.#maximumRow = Math.max(this.#maximumRow ?? cell.row, cell.row)
    }
  }

  private isOrdered(itemID: ItemID, otherID: ItemID | undefined): boolean {
    return (
      otherID === undefined ||
      (this.#orderByID.get(itemID) as number) < (this.#orderByID.get(otherID) as number)
    )
  }

  private nearestItemIDByScanning(
    point: FdCanvasPoint,
    excluding: ReadonlySet<ItemID>,
  ): ItemID | undefined {
    let nearestID: ItemID | undefined
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const itemID of this.orderedItemIDs) {
      if (excluding.has(itemID)) continue
      const frame = this.#frameByID.get(itemID)
      if (!frame) continue
      const distance = distanceSquared(point, frame)
      if (distance < nearestDistance) {
        nearestID = itemID
        nearestDistance = distance
      }
    }
    return nearestID
  }
}

const positiveNumber = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive`)
  return value
}

const positiveInteger = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`)
  }
  return value
}

const usableRect = (rect: FdCanvasRect): boolean =>
  Number.isFinite(rect.x) &&
  Number.isFinite(rect.y) &&
  Number.isFinite(rect.width) &&
  Number.isFinite(rect.height) &&
  rect.width >= 0 &&
  rect.height >= 0

const emptyRect = (rect: FdCanvasRect): boolean => rect.width === 0 || rect.height === 0

const cellsVisited = (radius: number): number => {
  const side = radius * 2 + 1
  return Number.isSafeInteger(side) && Number.isSafeInteger(side * side)
    ? side * side
    : Number.MAX_SAFE_INTEGER
}

const perimeter = (origin: Cell, radius: number): readonly Cell[] => {
  if (radius === 0) return [origin]
  const minimumColumn = origin.column - radius
  const maximumColumn = origin.column + radius
  const minimumRow = origin.row - radius
  const maximumRow = origin.row + radius
  const result: Cell[] = []
  for (let column = minimumColumn; column <= maximumColumn; column += 1) {
    result.push({ column, row: minimumRow }, { column, row: maximumRow })
  }
  for (let row = minimumRow + 1; row < maximumRow; row += 1) {
    result.push({ column: minimumColumn, row }, { column: maximumColumn, row })
  }
  return result
}

const distanceToOutside = (
  point: FdCanvasPoint,
  origin: Cell,
  radius: number,
  bucketSize: number,
): number =>
  Math.min(
    point.x - (origin.column - radius) * bucketSize,
    (origin.column + radius + 1) * bucketSize - point.x,
    point.y - (origin.row - radius) * bucketSize,
    (origin.row + radius + 1) * bucketSize - point.y,
  )

const distanceSquared = (point: FdCanvasPoint, rect: FdCanvasRect): number => {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width))
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height))
  return dx * dx + dy * dy
}
