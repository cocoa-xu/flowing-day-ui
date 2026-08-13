import { canvasRectsIntersect, type FdCanvasPoint, type FdCanvasRect } from '../geometry.js'
import type { FdGraphElementID } from '../graph/model.js'
import { type FdGraphLayoutInput, sameLayoutInputID } from './model.js'
import type { FdGraphLayoutEdgeRoute, FdGraphLayoutResult, FdGraphNodeFrame } from './pipeline.js'
import {
  FdSpatialIndex,
  FdSpatialIndexConfiguration,
  type FdSpatialIndexConfigurationOptions,
  FdSpatialIndexIssue,
  type FdSpatialIndexEntry,
} from './spatial-index.js'

export interface FdGraphRenderIndexConfigurationOptions {
  readonly nodeIndex?: FdSpatialIndexConfiguration | FdSpatialIndexConfigurationOptions
  readonly edgeLeafCapacity?: number
  readonly edgeCullingMargin?: number
}

export class FdGraphRenderIndexConfiguration {
  readonly nodeIndex: FdSpatialIndexConfiguration
  readonly edgeLeafCapacity: number
  readonly edgeCullingMargin: number

  constructor(options: FdGraphRenderIndexConfigurationOptions = {}) {
    this.nodeIndex =
      options.nodeIndex instanceof FdSpatialIndexConfiguration
        ? options.nodeIndex
        : new FdSpatialIndexConfiguration(options.nodeIndex)
    this.edgeLeafCapacity = positiveInteger(options.edgeLeafCapacity ?? 8, 'edge leaf capacity')
    const margin = options.edgeCullingMargin ?? 12
    if (!Number.isFinite(margin) || margin < 0) {
      throw new RangeError('edge culling margin must be finite and nonnegative')
    }
    this.edgeCullingMargin = margin
  }
}

export class FdGraphRenderSlice<
  NodeID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly inputID: FdGraphLayoutResult<NodeID, FdGraphElementID, EdgeID>['inputID']
  readonly nodeIDs: readonly NodeID[]
  readonly edgeIDs: readonly EdgeID[]
  readonly nodeFrames: readonly FdGraphNodeFrame<NodeID>[]
  readonly edgeRoutes: readonly FdGraphLayoutEdgeRoute<EdgeID>[]

  constructor(options: {
    readonly inputID: FdGraphLayoutResult<NodeID, FdGraphElementID, EdgeID>['inputID']
    readonly nodeIDs: readonly NodeID[]
    readonly edgeIDs: readonly EdgeID[]
    readonly nodeFrames: readonly FdGraphNodeFrame<NodeID>[]
    readonly edgeRoutes: readonly FdGraphLayoutEdgeRoute<EdgeID>[]
  }) {
    this.inputID = options.inputID
    this.nodeIDs = options.nodeIDs
    this.edgeIDs = options.edgeIDs
    this.nodeFrames = options.nodeFrames
    this.edgeRoutes = options.edgeRoutes
  }
}

export class FdGraphRenderElementIDs<
  NodeID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly inputID: FdGraphLayoutResult<NodeID, FdGraphElementID, EdgeID>['inputID']
  readonly nodeIDs: readonly NodeID[]
  readonly edgeIDs: readonly EdgeID[]

  constructor(
    inputID: FdGraphLayoutResult<NodeID, FdGraphElementID, EdgeID>['inputID'],
    nodeIDs: readonly NodeID[],
    edgeIDs: readonly EdgeID[],
  ) {
    this.inputID = inputID
    this.nodeIDs = nodeIDs
    this.edgeIDs = edgeIDs
  }
}

export class FdGraphRenderIndexIssue extends Error {
  readonly kind = 'inputIdentityMismatch'

  constructor() {
    super('inputIdentityMismatch')
    this.name = 'FdGraphRenderIndexIssue'
  }
}

interface BoundsEntry<ItemID extends FdGraphElementID> {
  readonly id: ItemID
  readonly frame: FdCanvasRect
  readonly order: number
}

interface BoundsNode {
  readonly bounds: FdCanvasRect
  readonly lower?: number
  readonly upper?: number
  readonly firstChildIndex?: number
  readonly secondChildIndex?: number
}

class FdBoundsIndex<ItemID extends FdGraphElementID> {
  readonly #entries: BoundsEntry<ItemID>[]
  readonly #nodes: BoundsNode[] = []
  readonly #rootIndex: number | undefined

  constructor(sourceEntries: readonly FdSpatialIndexEntry<ItemID>[], leafCapacity: number) {
    const seenIDs = new Set<ItemID>()
    this.#entries = sourceEntries.map((entry, order) => {
      if (seenIDs.has(entry.id)) throw new FdSpatialIndexIssue('duplicateItemID', entry.id)
      if (!usableRect(entry.frame)) throw new FdSpatialIndexIssue('invalidFrame', entry.id)
      seenIDs.add(entry.id)
      return { ...entry, order }
    })
    this.#rootIndex =
      this.#entries.length === 0
        ? undefined
        : this.build(0, this.#entries.length, positiveInteger(leafCapacity, 'leaf capacity'))
  }

  itemIDs(intersecting: FdCanvasRect): readonly ItemID[] {
    return this.itemsUnordered(intersecting)
      .sort((first, second) => first.order - second.order)
      .map(({ id }) => id)
  }

  itemIDsUnordered(intersecting: FdCanvasRect): readonly ItemID[] {
    return this.itemsUnordered(intersecting).map(({ id }) => id)
  }

  private itemsUnordered(intersecting: FdCanvasRect): BoundsEntry<ItemID>[] {
    if (!usableRect(intersecting) || emptyRect(intersecting) || this.#rootIndex === undefined) {
      return []
    }
    const matches: BoundsEntry<ItemID>[] = []
    const pending = [this.#rootIndex]
    while (pending.length > 0) {
      const node = this.#nodes[pending.pop() as number]
      if (!node || !canvasRectsIntersect(node.bounds, intersecting)) continue
      if (node.lower !== undefined && node.upper !== undefined) {
        for (let index = node.lower; index < node.upper; index += 1) {
          const entry = this.#entries[index]
          if (entry && canvasRectsIntersect(entry.frame, intersecting)) matches.push(entry)
        }
      } else {
        if (node.firstChildIndex !== undefined) pending.push(node.firstChildIndex)
        if (node.secondChildIndex !== undefined) pending.push(node.secondChildIndex)
      }
    }
    return matches
  }

  private build(lower: number, upper: number, leafCapacity: number): number {
    const nodeIndex = this.#nodes.length
    const bounds = unionEntries(this.#entries, lower, upper)
    this.#nodes.push({ bounds, lower, upper })
    if (upper - lower <= leafCapacity) return nodeIndex
    const centerBounds = centerUnion(this.#entries, lower, upper)
    const sorted = this.#entries
      .slice(lower, upper)
      .sort((first, second) =>
        centerBounds.width >= centerBounds.height
          ? centerX(first.frame) - centerX(second.frame)
          : centerY(first.frame) - centerY(second.frame),
      )
    this.#entries.splice(lower, upper - lower, ...sorted)
    const middle = lower + Math.floor((upper - lower) / 2)
    const firstChildIndex = this.build(lower, middle, leafCapacity)
    const secondChildIndex = this.build(middle, upper, leafCapacity)
    this.#nodes[nodeIndex] = { bounds, firstChildIndex, secondChildIndex }
    return nodeIndex
  }
}

export class FdGraphRenderIndex<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> {
  readonly inputID: FdGraphLayoutInput<NodeID, PortID, EdgeID>['id']
  readonly configuration: FdGraphRenderIndexConfiguration
  readonly #result: FdGraphLayoutResult<NodeID, PortID, EdgeID>
  readonly #nodeIndex: FdSpatialIndex<NodeID>
  readonly #edgeIndex: FdBoundsIndex<EdgeID>

  constructor(
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
    result: FdGraphLayoutResult<NodeID, PortID, EdgeID>,
    configuration = new FdGraphRenderIndexConfiguration(),
  ) {
    if (!sameLayoutInputID(input.id, result.inputID)) throw new FdGraphRenderIndexIssue()
    this.inputID = input.id
    this.configuration = configuration
    this.#result = result
    this.#nodeIndex = new FdSpatialIndex(
      result.nodeFrames.map(({ nodeID, frame }) => ({ id: nodeID, frame })),
      configuration.nodeIndex,
    )
    this.#edgeIndex = new FdBoundsIndex(
      result.edgeRoutes.map(({ edgeID, route }) => ({
        id: edgeID,
        frame: insetRect(route.conservativeBounds, -configuration.edgeCullingMargin),
      })),
      configuration.edgeLeafCapacity,
    )
  }

  slice(intersecting: FdCanvasRect): FdGraphRenderSlice<NodeID, EdgeID> {
    const elementIDs = this.elementIDs(intersecting)
    return new FdGraphRenderSlice({
      inputID: this.inputID,
      nodeIDs: elementIDs.nodeIDs,
      edgeIDs: elementIDs.edgeIDs,
      nodeFrames: elementIDs.nodeIDs.flatMap((nodeID) => {
        const frame = this.#result.frame(nodeID)
        return frame ? [{ nodeID, frame }] : []
      }),
      edgeRoutes: elementIDs.edgeIDs.flatMap((edgeID) => {
        const route = this.#result.route(edgeID)
        return route ? [{ edgeID, route }] : []
      }),
    })
  }

  elementIDs(intersecting: FdCanvasRect): FdGraphRenderElementIDs<NodeID, EdgeID> {
    return new FdGraphRenderElementIDs(
      this.inputID,
      this.#nodeIndex.itemIDs(intersecting),
      this.#edgeIndex.itemIDs(intersecting),
    )
  }

  unorderedElementIDs(intersecting: FdCanvasRect): FdGraphRenderElementIDs<NodeID, EdgeID> {
    return new FdGraphRenderElementIDs(
      this.inputID,
      this.#nodeIndex.itemIDsUnordered(intersecting),
      this.#edgeIndex.itemIDsUnordered(intersecting),
    )
  }

  unorderedNodeIDs(intersecting: FdCanvasRect): readonly NodeID[] {
    return this.#nodeIndex.itemIDsUnordered(intersecting)
  }

  nodeIDs(intersecting: FdCanvasRect): readonly NodeID[] {
    return this.#nodeIndex.itemIDs(intersecting)
  }

  nearestNodeID(to: FdCanvasPoint, excluding: ReadonlySet<NodeID> = new Set()): NodeID | undefined {
    return this.#nodeIndex.nearestItemID(to, excluding)
  }
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

const insetRect = (rect: FdCanvasRect, amount: number): FdCanvasRect => ({
  x: rect.x + amount,
  y: rect.y + amount,
  width: rect.width - amount * 2,
  height: rect.height - amount * 2,
})

const unionRect = (first: FdCanvasRect, second: FdCanvasRect): FdCanvasRect => {
  const x = Math.min(first.x, second.x)
  const y = Math.min(first.y, second.y)
  return {
    x,
    y,
    width: Math.max(first.x + first.width, second.x + second.width) - x,
    height: Math.max(first.y + first.height, second.y + second.height) - y,
  }
}

const unionEntries = <ItemID extends FdGraphElementID>(
  entries: readonly BoundsEntry<ItemID>[],
  lower: number,
  upper: number,
): FdCanvasRect => {
  let result = entries[lower]?.frame as FdCanvasRect
  for (let index = lower + 1; index < upper; index += 1) {
    result = unionRect(result, (entries[index] as BoundsEntry<ItemID>).frame)
  }
  return result
}

const centerUnion = <ItemID extends FdGraphElementID>(
  entries: readonly BoundsEntry<ItemID>[],
  lower: number,
  upper: number,
): FdCanvasRect => {
  const first = entries[lower] as BoundsEntry<ItemID>
  let result = { x: centerX(first.frame), y: centerY(first.frame), width: 0, height: 0 }
  for (let index = lower + 1; index < upper; index += 1) {
    const frame = (entries[index] as BoundsEntry<ItemID>).frame
    result = unionRect(result, { x: centerX(frame), y: centerY(frame), width: 0, height: 0 })
  }
  return result
}

const centerX = (rect: FdCanvasRect): number => rect.x + rect.width / 2
const centerY = (rect: FdCanvasRect): number => rect.y + rect.height / 2
