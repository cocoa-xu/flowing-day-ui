import type { FdCanvasInsets, FdCanvasRect, FdCanvasSize } from '../geometry.js'
import type { FdAnyGraphSnapshot, FdGraphElementID } from '../graph/model.js'
import { FdGraphSnapshotIndex } from '../graph/snapshot-index.js'

function mapValue<Key, Value>(map: ReadonlyMap<Key, Value>, key: Key): Value {
  const value = map.get(key)
  if (value === undefined) throw new Error('Layered layout invariant failed')
  return value
}

function arrayValue<Value>(values: readonly Value[], index: number): Value {
  const value = values[index]
  if (value === undefined) throw new Error('Layered layout invariant failed')
  return value
}

export type FdLayeredLayoutDirection = 'topToBottom' | 'leftToRight'

export interface FdLayeredLayoutConfiguration {
  readonly direction?: FdLayeredLayoutDirection
  readonly horizontalNodeSpacing: number
  readonly verticalNodeSpacing: number
  readonly componentSpacing: number
  readonly canvasInsets: FdCanvasInsets
  readonly minimumCanvasSize: FdCanvasSize
}

export interface FdLayeredGraphLayoutResult {
  readonly nodeFrames: ReadonlyMap<FdGraphElementID, FdCanvasRect>
  readonly contentBounds: FdCanvasRect
}

export class FdLayeredGraphLayoutCycleError extends Error {
  constructor() {
    super('Layered graph layout requires an acyclic directed graph')
    this.name = 'FdLayeredGraphLayoutCycleError'
  }
}

export function layoutLayeredGraph(
  snapshot: FdAnyGraphSnapshot,
  configuration: FdLayeredLayoutConfiguration,
): FdLayeredGraphLayoutResult {
  new FdGraphSnapshotIndex(snapshot)
  validateConfiguration(configuration)
  const direction = configuration.direction ?? 'topToBottom'
  const nodeByID = new Map(snapshot.nodes.map((node) => [node.id, node]))
  if (snapshot.nodes.length === 0) {
    return {
      nodeFrames: new Map(),
      contentBounds: {
        x: 0,
        y: 0,
        width: configuration.minimumCanvasSize.width,
        height: configuration.minimumCanvasSize.height,
      },
    }
  }

  const order = new Map(snapshot.nodes.map((node, index) => [node.id, index]))
  const successors = new Map(snapshot.nodes.map((node) => [node.id, [] as FdGraphElementID[]]))
  const predecessors = new Map(snapshot.nodes.map((node) => [node.id, [] as FdGraphElementID[]]))
  const neighbors = new Map(snapshot.nodes.map((node) => [node.id, [] as FdGraphElementID[]]))
  for (const edge of snapshot.edges) {
    mapValue(successors, edge.source.nodeID).push(edge.target.nodeID)
    mapValue(predecessors, edge.target.nodeID).push(edge.source.nodeID)
    mapValue(neighbors, edge.source.nodeID).push(edge.target.nodeID)
    mapValue(neighbors, edge.target.nodeID).push(edge.source.nodeID)
  }

  const indegree = new Map(
    snapshot.nodes.map((node) => [node.id, mapValue(predecessors, node.id).length]),
  )
  const queue = snapshot.nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id)
  const topologicalOrder: FdGraphElementID[] = []
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const nodeID = arrayValue(queue, cursor)
    topologicalOrder.push(nodeID)
    for (const targetID of mapValue(successors, nodeID)) {
      const next = mapValue(indegree, targetID) - 1
      indegree.set(targetID, next)
      if (next === 0) queue.push(targetID)
    }
  }
  if (topologicalOrder.length !== snapshot.nodes.length) throw new FdLayeredGraphLayoutCycleError()

  const ranks = new Map(snapshot.nodes.map((node) => [node.id, 0]))
  for (const sourceID of topologicalOrder) {
    for (const targetID of mapValue(successors, sourceID)) {
      ranks.set(targetID, Math.max(mapValue(ranks, targetID), mapValue(ranks, sourceID) + 1))
    }
  }

  const parentOrder = new Map<FdGraphElementID, number>()
  for (const node of snapshot.nodes) {
    let minimum = Number.MAX_SAFE_INTEGER
    for (const parentID of mapValue(predecessors, node.id)) {
      minimum = Math.min(minimum, mapValue(order, parentID))
    }
    parentOrder.set(node.id, minimum)
  }
  const components: FdGraphElementID[][] = []
  const visited = new Set<FdGraphElementID>()
  for (const node of snapshot.nodes) {
    if (visited.has(node.id)) continue
    const component: FdGraphElementID[] = []
    const stack = [node.id]
    visited.add(node.id)
    while (stack.length > 0) {
      const nodeID = stack.pop()
      if (nodeID === undefined) break
      component.push(nodeID)
      for (const neighborID of mapValue(neighbors, nodeID)) {
        if (visited.has(neighborID)) continue
        visited.add(neighborID)
        stack.push(neighborID)
      }
    }
    components.push(component.sort((left, right) => mapValue(order, left) - mapValue(order, right)))
  }

  const primarySize = (id: FdGraphElementID) => {
    const frame = mapValue(nodeByID, id).frame
    return direction === 'topToBottom' ? frame.height : frame.width
  }
  const crossSize = (id: FdGraphElementID) => {
    const frame = mapValue(nodeByID, id).frame
    return direction === 'topToBottom' ? frame.width : frame.height
  }
  const primarySpacing =
    direction === 'topToBottom'
      ? configuration.verticalNodeSpacing
      : configuration.horizontalNodeSpacing
  const crossSpacing =
    direction === 'topToBottom'
      ? configuration.horizontalNodeSpacing
      : configuration.verticalNodeSpacing
  const primaryLeading =
    direction === 'topToBottom' ? configuration.canvasInsets.top : configuration.canvasInsets.left
  const primaryTrailing =
    direction === 'topToBottom'
      ? configuration.canvasInsets.bottom
      : configuration.canvasInsets.right
  const crossLeading =
    direction === 'topToBottom' ? configuration.canvasInsets.left : configuration.canvasInsets.top
  const crossTrailing =
    direction === 'topToBottom'
      ? configuration.canvasInsets.right
      : configuration.canvasInsets.bottom

  const rankPrimarySizes = new Map<number, number>()
  for (const node of snapshot.nodes) {
    const rank = mapValue(ranks, node.id)
    rankPrimarySizes.set(rank, Math.max(rankPrimarySizes.get(rank) ?? 0, primarySize(node.id)))
  }
  const occupiedRanks = [...rankPrimarySizes.keys()].sort((left, right) => left - right)
  const rankPrimaryOrigins = new Map<number, number>()
  let precedingPrimarySizes = 0
  for (const rank of occupiedRanks) {
    rankPrimaryOrigins.set(rank, primaryLeading + rank * primarySpacing + precedingPrimarySizes)
    precedingPrimarySizes += mapValue(rankPrimarySizes, rank)
  }

  const frames = new Map<FdGraphElementID, FdCanvasRect>()
  let componentCrossOrigin = crossLeading
  for (const component of components) {
    const layers = new Map<number, FdGraphElementID[]>()
    for (const nodeID of component) {
      const rank = mapValue(ranks, nodeID)
      const layer = layers.get(rank) ?? []
      layer.push(nodeID)
      layers.set(rank, layer)
    }
    for (const layer of layers.values()) {
      layer.sort((left, right) => {
        const parentDifference = mapValue(parentOrder, left) - mapValue(parentOrder, right)
        return parentDifference === 0
          ? mapValue(order, left) - mapValue(order, right)
          : parentDifference
      })
    }
    const layerCrossSize = (ids: readonly FdGraphElementID[]) =>
      ids.reduce<number>((total, id) => total + crossSize(id), 0) +
      Math.max(ids.length - 1, 0) * crossSpacing
    let componentCrossSize = 0
    for (const layer of layers.values()) {
      componentCrossSize = Math.max(componentCrossSize, layerCrossSize(layer))
    }
    for (const [rank, nodeIDs] of [...layers.entries()].sort(([left], [right]) => right - left)) {
      const occupied = layerCrossSize(nodeIDs)
      let cursor = componentCrossOrigin + (componentCrossSize - occupied) / 2
      const defaultCenters = nodeIDs.map((nodeID) => {
        const center = cursor + crossSize(nodeID) / 2
        cursor += crossSize(nodeID) + crossSpacing
        return center
      })
      let centers = nodeIDs.map((nodeID, index) => {
        const childCenters = mapValue(successors, nodeID)
          .map((childID) => frames.get(childID))
          .filter((frame): frame is FdCanvasRect => frame !== undefined)
          .map((frame) =>
            direction === 'topToBottom' ? frame.x + frame.width / 2 : frame.y + frame.height / 2,
          )
        return childCenters.length === 0
          ? arrayValue(defaultCenters, index)
          : childCenters.reduce((sum, value) => sum + value, 0) / childCenters.length
      })
      for (let index = 1; index < centers.length; index += 1) {
        const minimum =
          arrayValue(centers, index - 1) +
          (crossSize(arrayValue(nodeIDs, index - 1)) + crossSize(arrayValue(nodeIDs, index))) / 2 +
          crossSpacing
        centers[index] = Math.max(arrayValue(centers, index), minimum)
      }
      const firstNodeID = arrayValue(nodeIDs, 0)
      const lastNodeID = arrayValue(nodeIDs, nodeIDs.length - 1)
      const minimumCenter = componentCrossOrigin + crossSize(firstNodeID) / 2
      const maximumCenter = componentCrossOrigin + componentCrossSize - crossSize(lastNodeID) / 2
      if (arrayValue(centers, 0) < minimumCenter) {
        const adjustment = minimumCenter - arrayValue(centers, 0)
        centers = centers.map((center) => center + adjustment)
      }
      if (arrayValue(centers, centers.length - 1) > maximumCenter) {
        const adjustment = arrayValue(centers, centers.length - 1) - maximumCenter
        centers = centers.map((center) => center - adjustment)
      }
      if (arrayValue(centers, 0) < minimumCenter) centers = defaultCenters
      for (const [index, nodeID] of nodeIDs.entries()) {
        const node = mapValue(nodeByID, nodeID)
        const crossOrigin = arrayValue(centers, index) - crossSize(nodeID) / 2
        const primaryOrigin =
          mapValue(rankPrimaryOrigins, rank) +
          (mapValue(rankPrimarySizes, rank) - primarySize(nodeID)) / 2
        frames.set(
          nodeID,
          direction === 'topToBottom'
            ? {
                x: crossOrigin,
                y: primaryOrigin,
                width: node.frame.width,
                height: node.frame.height,
              }
            : {
                x: primaryOrigin,
                y: crossOrigin,
                width: node.frame.width,
                height: node.frame.height,
              },
        )
      }
    }
    componentCrossOrigin += componentCrossSize + configuration.componentSpacing
  }

  const measuredCross = componentCrossOrigin - configuration.componentSpacing + crossTrailing
  const lastRank = arrayValue(occupiedRanks, occupiedRanks.length - 1)
  const measuredPrimary =
    mapValue(rankPrimaryOrigins, lastRank) + mapValue(rankPrimarySizes, lastRank) + primaryTrailing
  const measuredSize =
    direction === 'topToBottom'
      ? { width: measuredCross, height: measuredPrimary }
      : { width: measuredPrimary, height: measuredCross }
  let maximumX = 0
  let maximumY = 0
  for (const frame of frames.values()) {
    maximumX = Math.max(maximumX, frame.x + frame.width)
    maximumY = Math.max(maximumY, frame.y + frame.height)
  }
  return {
    nodeFrames: frames,
    contentBounds: {
      x: 0,
      y: 0,
      width: Math.max(measuredSize.width, maximumX, configuration.minimumCanvasSize.width),
      height: Math.max(measuredSize.height, maximumY, configuration.minimumCanvasSize.height),
    },
  }
}

function validateConfiguration(configuration: FdLayeredLayoutConfiguration): void {
  const values = [
    configuration.horizontalNodeSpacing,
    configuration.verticalNodeSpacing,
    configuration.componentSpacing,
    configuration.canvasInsets.top,
    configuration.canvasInsets.right,
    configuration.canvasInsets.bottom,
    configuration.canvasInsets.left,
    configuration.minimumCanvasSize.width,
    configuration.minimumCanvasSize.height,
  ]
  if (values.some((value) => !Number.isFinite(value) || value < 0))
    throw new RangeError('layered graph layout values must be finite and nonnegative')
}
