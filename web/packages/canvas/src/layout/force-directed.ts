import type { FdCanvasPoint, FdCanvasRect, FdCanvasSize } from '../geometry.js'
import type { FdGraphElementID } from '../graph/model.js'
import { FdCubicEdgeRouter } from './edge-routing.js'
import type { FdLayoutInsets } from './layered.js'
import {
  type FdGraphLayoutEndpoint,
  type FdGraphLayoutInput,
  FdLayoutComponentIdentity,
  FdLayoutPipelineIdentity,
} from './model.js'
import {
  type FdGraphEdgeRoutingStrategy,
  FdGraphLayoutPipeline,
  type FdGraphLayoutPostprocessor,
  type FdGraphLayoutResult,
  type FdGraphLayoutStrategy,
  type FdGraphNodeFrame,
  FdGraphNodePlacement,
  type FdGraphNodePlacementStrategy,
} from './pipeline.js'

export class FdForceSimulationConfiguration {
  readonly iterationLimit: number
  readonly idealEdgeLength: number
  readonly repulsionStrength: number
  readonly attractionStrength: number
  readonly centeringStrength: number
  readonly collisionStrength: number
  readonly collisionPadding: number
  readonly timeStep: number
  readonly damping: number
  readonly maximumDisplacement: number
  readonly convergenceTolerance: number
  readonly barnesHutTheta: number
  readonly maximumTreeDepth: number

  constructor(
    iterationLimit: number,
    idealEdgeLength: number,
    repulsionStrength: number,
    attractionStrength: number,
    centeringStrength: number,
    collisionStrength: number,
    collisionPadding: number,
    timeStep: number,
    damping: number,
    maximumDisplacement: number,
    convergenceTolerance: number,
    barnesHutTheta: number,
    maximumTreeDepth: number,
  ) {
    nonnegativeInteger(iterationLimit, 'iterationLimit')
    positiveFinite(idealEdgeLength, 'idealEdgeLength')
    nonnegativeFinite(repulsionStrength, 'repulsionStrength')
    nonnegativeFinite(attractionStrength, 'attractionStrength')
    nonnegativeFinite(centeringStrength, 'centeringStrength')
    nonnegativeFinite(collisionStrength, 'collisionStrength')
    nonnegativeFinite(collisionPadding, 'collisionPadding')
    positiveFinite(timeStep, 'timeStep')
    if (!Number.isFinite(damping) || damping < 0 || damping > 1) {
      throw new RangeError('damping must be finite and between zero and one')
    }
    positiveFinite(maximumDisplacement, 'maximumDisplacement')
    nonnegativeFinite(convergenceTolerance, 'convergenceTolerance')
    positiveFinite(barnesHutTheta, 'barnesHutTheta')
    positiveInteger(maximumTreeDepth, 'maximumTreeDepth')
    this.iterationLimit = iterationLimit
    this.idealEdgeLength = idealEdgeLength
    this.repulsionStrength = repulsionStrength
    this.attractionStrength = attractionStrength
    this.centeringStrength = centeringStrength
    this.collisionStrength = collisionStrength
    this.collisionPadding = collisionPadding
    this.timeStep = timeStep
    this.damping = damping
    this.maximumDisplacement = maximumDisplacement
    this.convergenceTolerance = convergenceTolerance
    this.barnesHutTheta = barnesHutTheta
    this.maximumTreeDepth = maximumTreeDepth
  }
}

export class FdForceComponentPackingConfiguration {
  readonly componentSpacing: number
  readonly componentPadding: number
  readonly targetAspectRatio: number
  readonly canvasInsets: FdLayoutInsets
  readonly minimumCanvasSize: FdCanvasSize

  constructor(
    componentSpacing: number,
    componentPadding: number,
    targetAspectRatio: number,
    canvasInsets: FdLayoutInsets,
    minimumCanvasSize: FdCanvasSize,
  ) {
    nonnegativeFinite(componentSpacing, 'componentSpacing')
    nonnegativeFinite(componentPadding, 'componentPadding')
    positiveFinite(targetAspectRatio, 'targetAspectRatio')
    nonnegativeFinite(minimumCanvasSize.width, 'minimumCanvasSize.width')
    nonnegativeFinite(minimumCanvasSize.height, 'minimumCanvasSize.height')
    this.componentSpacing = componentSpacing
    this.componentPadding = componentPadding
    this.targetAspectRatio = targetAspectRatio
    this.canvasInsets = canvasInsets
    this.minimumCanvasSize = minimumCanvasSize
  }
}

export class FdForceDirectedLayoutConfiguration {
  readonly simulation: FdForceSimulationConfiguration
  readonly packing: FdForceComponentPackingConfiguration

  constructor(
    simulation: FdForceSimulationConfiguration,
    packing: FdForceComponentPackingConfiguration,
  ) {
    this.simulation = simulation
    this.packing = packing
  }
}

export class FdForceDirectedPlacement<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> implements FdGraphNodePlacementStrategy<NodeID, PortID, EdgeID>
{
  readonly identity: FdLayoutPipelineIdentity
  readonly configuration: FdForceDirectedLayoutConfiguration

  constructor(
    configuration: FdForceDirectedLayoutConfiguration,
    identity = new FdLayoutComponentIdentity(),
  ) {
    this.configuration = configuration
    this.identity = new FdLayoutPipelineIdentity(identity)
  }

  place(
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
  ): FdGraphNodePlacement<NodeID, PortID, EdgeID> {
    if (input.topology.nodeIDs.length === 0) {
      return new FdGraphNodePlacement(input, [], {
        x: 0,
        y: 0,
        ...this.configuration.packing.minimumCanvasSize,
      })
    }
    const nodeOrder = new Map(input.topology.nodeIDs.map((nodeID, index) => [nodeID, index]))
    const components = input.topology.weaklyConnectedComponents()
    const componentRootByNodeID = new Map<NodeID, NodeID>()
    for (const component of components) {
      const root = component[0]
      if (root === undefined) continue
      for (const nodeID of component) componentRootByNodeID.set(nodeID, root)
    }
    const edgePairsByRoot = new Map<NodeID, NodePair<NodeID>[]>()
    for (const pair of this.uniqueEdgePairs(input, nodeOrder)) {
      const root = componentRootByNodeID.get(pair.first)
      if (root === undefined) continue
      const pairs = edgePairsByRoot.get(root)
      if (pairs === undefined) edgePairsByRoot.set(root, [pair])
      else pairs.push(pair)
    }
    const geometries: ComponentGeometry<NodeID>[] = []
    for (const nodeIDs of components) {
      const root = nodeIDs[0]
      if (root !== undefined) {
        geometries.push(this.componentGeometry(nodeIDs, edgePairsByRoot.get(root) ?? [], input))
      }
    }
    const packedFrames = this.pack(geometries, input)
    const packing = this.configuration.packing
    const measuredWidth =
      maximum([...packedFrames.values()].map(rectMaxX)) +
      packing.componentPadding +
      packing.canvasInsets.trailing
    const measuredHeight =
      maximum([...packedFrames.values()].map(rectMaxY)) +
      packing.componentPadding +
      packing.canvasInsets.bottom
    const measuredBounds: FdCanvasRect = {
      x: 0,
      y: 0,
      width: Math.max(measuredWidth, packing.minimumCanvasSize.width),
      height: Math.max(measuredHeight, packing.minimumCanvasSize.height),
    }
    const contentBounds = [...packedFrames.values()].reduce(unionRects, measuredBounds)
    return new FdGraphNodePlacement(
      input,
      input.topology.nodeIDs.map((nodeID) => ({
        nodeID,
        frame: required(packedFrames.get(nodeID), 'force-directed frame'),
      })),
      contentBounds,
    )
  }

  private uniqueEdgePairs(
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
    nodeOrder: ReadonlyMap<NodeID, number>,
  ): NodePair<NodeID>[] {
    const knownPairs = new Set<string>()
    const pairs: NodePair<NodeID>[] = []
    for (const edge of input.topology.edges) {
      const endpoints = endpointList(edge.endpoints)
      const first = input.topology.nodeID(endpoints[0])
      const second = input.topology.nodeID(endpoints[1])
      if (first === second) continue
      const firstIndex = required(nodeOrder.get(first), 'force-directed node order')
      const secondIndex = required(nodeOrder.get(second), 'force-directed node order')
      const pair = firstIndex < secondIndex ? { first, second } : { first: second, second: first }
      const key = `${Math.min(firstIndex, secondIndex)}:${Math.max(firstIndex, secondIndex)}`
      if (!knownPairs.has(key)) {
        knownPairs.add(key)
        pairs.push(pair)
      }
    }
    return pairs
  }

  private componentGeometry(
    nodeIDs: readonly NodeID[],
    edgePairs: readonly NodePair<NodeID>[],
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
  ): ComponentGeometry<NodeID> {
    const indexByNodeID = new Map(nodeIDs.map((nodeID, index) => [nodeID, index]))
    const indexedEdges = edgePairs.map(({ first, second }) => ({
      first: required(indexByNodeID.get(first), 'force-directed edge source'),
      second: required(indexByNodeID.get(second), 'force-directed edge target'),
    }))
    const sizes = nodeIDs.map((nodeID) => required(input.size(nodeID), 'force-directed node size'))
    const radii = sizes.map((size) => Math.hypot(size.width, size.height) / 2)
    const positions = initialPositions(
      nodeIDs.length,
      this.configuration.simulation.idealEdgeLength,
    )
    runSimulation(this.configuration.simulation, radii, indexedEdges, positions)
    let bounds: FdCanvasRect | undefined
    const frames = nodeIDs.map((nodeID, index): FdGraphNodeFrame<NodeID> => {
      const size = required(sizes[index], 'force-directed node size')
      const position = required(positions[index], 'force-directed position')
      const frame = {
        x: position.x - size.width / 2,
        y: position.y - size.height / 2,
        ...size,
      }
      bounds = bounds === undefined ? frame : unionRects(bounds, frame)
      return { nodeID, frame }
    })
    const resolvedBounds = required(bounds, 'force-directed component bounds')
    const padding = this.configuration.packing.componentPadding
    return {
      frames: frames.map(({ nodeID, frame }) => ({
        nodeID,
        frame: offsetRect(frame, padding - resolvedBounds.x, padding - resolvedBounds.y),
      })),
      size: {
        width: resolvedBounds.width + 2 * padding,
        height: resolvedBounds.height + 2 * padding,
      },
    }
  }

  private pack(
    geometries: readonly ComponentGeometry<NodeID>[],
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
  ): Map<NodeID, FdCanvasRect> {
    const packing = this.configuration.packing
    const totalArea = geometries.reduce(
      (sum, geometry) => sum + geometry.size.width * geometry.size.height,
      0,
    )
    const targetWidth = Math.max(
      maximum(geometries.map(({ size }) => size.width)),
      Math.sqrt(totalArea * packing.targetAspectRatio),
    )
    const cursor = { x: packing.canvasInsets.leading, y: packing.canvasInsets.top }
    let rowHeight = 0
    const frames = new Map<NodeID, FdCanvasRect>()
    for (const geometry of geometries) {
      if (
        cursor.x > packing.canvasInsets.leading &&
        cursor.x + geometry.size.width > packing.canvasInsets.leading + targetWidth
      ) {
        cursor.x = packing.canvasInsets.leading
        cursor.y += rowHeight + packing.componentSpacing
        rowHeight = 0
      }
      for (const entry of geometry.frames) {
        const offset = input.placementOffset(entry.nodeID) ?? { width: 0, height: 0 }
        frames.set(
          entry.nodeID,
          offsetRect(entry.frame, cursor.x + offset.width, cursor.y + offset.height),
        )
      }
      cursor.x += geometry.size.width + packing.componentSpacing
      rowHeight = Math.max(rowHeight, geometry.size.height)
    }
    return frames
  }
}

export class FdForceDirectedLayout<
  NodeID extends FdGraphElementID = FdGraphElementID,
  PortID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
> implements FdGraphLayoutStrategy<NodeID, PortID, EdgeID>
{
  readonly #pipeline: FdGraphLayoutPipeline<NodeID, PortID, EdgeID>

  constructor(configuration: FdForceDirectedLayoutConfiguration)
  constructor(
    placement: FdForceDirectedPlacement<NodeID, PortID, EdgeID>,
    edgeRouter: FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>,
  )
  constructor(
    placement: FdForceDirectedPlacement<NodeID, PortID, EdgeID>,
    postprocessors: readonly FdGraphLayoutPostprocessor<NodeID, PortID, EdgeID>[],
    edgeRouter: FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>,
  )
  constructor(
    configurationOrPlacement:
      | FdForceDirectedLayoutConfiguration
      | FdForceDirectedPlacement<NodeID, PortID, EdgeID>,
    postprocessorsOrRouter?:
      | readonly FdGraphLayoutPostprocessor<NodeID, PortID, EdgeID>[]
      | FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>,
    edgeRouter?: FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>,
  ) {
    if (configurationOrPlacement instanceof FdForceDirectedLayoutConfiguration) {
      this.#pipeline = new FdGraphLayoutPipeline(
        new FdForceDirectedPlacement(configurationOrPlacement),
        new FdCubicEdgeRouter(),
      )
      return
    }
    if (postprocessorsOrRouter === undefined) {
      throw new TypeError('force-directed layout requires an edge router')
    }
    if (Array.isArray(postprocessorsOrRouter)) {
      if (edgeRouter === undefined)
        throw new TypeError('force-directed layout requires an edge router')
      this.#pipeline = new FdGraphLayoutPipeline(
        configurationOrPlacement,
        postprocessorsOrRouter,
        edgeRouter,
      )
    } else {
      this.#pipeline = new FdGraphLayoutPipeline(
        configurationOrPlacement,
        postprocessorsOrRouter as FdGraphEdgeRoutingStrategy<NodeID, PortID, EdgeID>,
      )
    }
  }

  get identity(): FdLayoutPipelineIdentity {
    return this.#pipeline.identity
  }

  layout(
    input: FdGraphLayoutInput<NodeID, PortID, EdgeID>,
  ): FdGraphLayoutResult<NodeID, PortID, EdgeID> {
    return this.#pipeline.layout(input)
  }
}

interface ComponentGeometry<NodeID> {
  readonly frames: readonly FdGraphNodeFrame<NodeID & FdGraphElementID>[]
  readonly size: FdCanvasSize
}

interface NodePair<NodeID> {
  readonly first: NodeID
  readonly second: NodeID
}

interface IndexedPair {
  readonly first: number
  readonly second: number
}

interface Vector {
  readonly dx: number
  readonly dy: number
}

interface Cell {
  readonly bounds: FdCanvasRect
  mass: number
  weightedX: number
  weightedY: number
  maximumRadius: number
  childrenStart: number | undefined
  bodyHead: number
}

const runSimulation = (
  configuration: FdForceSimulationConfiguration,
  radii: readonly number[],
  edges: readonly IndexedPair[],
  positions: FdCanvasPoint[],
): void => {
  if (positions.length <= 1 || configuration.iterationLimit === 0) return
  const velocities = positions.map((): Vector => ({ dx: 0, dy: 0 }))
  for (let iteration = 0; iteration < configuration.iterationLimit; iteration += 1) {
    const tree = new ForceQuadTree(
      positions,
      radii,
      configuration.idealEdgeLength,
      configuration.maximumTreeDepth,
    )
    const forces = tree.repulsiveForces(configuration)
    applyAttraction(configuration, edges, positions, forces)
    applyCentering(configuration, positions, forces)
    const maximumMovement = integrate(configuration, positions, velocities, forces)
    recenter(positions)
    if (maximumMovement <= configuration.convergenceTolerance) break
  }
}

class ForceQuadTree {
  readonly #cells: Cell[]
  readonly #nextBody: number[]
  readonly #positions: readonly FdCanvasPoint[]
  readonly #radii: readonly number[]
  readonly #maximumDepth: number

  constructor(
    positions: readonly FdCanvasPoint[],
    radii: readonly number[],
    minimumExtent: number,
    maximumDepth: number,
  ) {
    this.#positions = positions
    this.#radii = radii
    this.#maximumDepth = maximumDepth
    this.#nextBody = positions.map(() => -1)
    this.#cells = [cell(rootBounds(positions, minimumExtent))]
    for (let bodyIndex = 0; bodyIndex < positions.length; bodyIndex += 1) {
      this.insert(bodyIndex, 0, 0)
    }
  }

  repulsiveForces(configuration: FdForceSimulationConfiguration): Vector[] {
    const result = this.#positions.map((): Vector => ({ dx: 0, dy: 0 }))
    const stack: number[] = []
    for (let bodyIndex = 0; bodyIndex < this.#positions.length; bodyIndex += 1) {
      stack.length = 0
      stack.push(0)
      let force: Vector = { dx: 0, dy: 0 }
      while (stack.length > 0) {
        const cellIndex = stack.pop()
        if (cellIndex === undefined) break
        const current = required(this.#cells[cellIndex], 'force-directed quadtree cell')
        if (current.mass <= 0) continue
        if (current.childrenStart !== undefined) {
          const delta = between(
            centerOfMass(current),
            required(this.#positions[bodyIndex], 'force-directed body position'),
            bodyIndex,
            bodyIndex + 1,
          )
          const clearance =
            vectorLength(delta) -
            Math.hypot(current.bounds.width, current.bounds.height) / 2 -
            required(this.#radii[bodyIndex], 'force-directed body radius') -
            current.maximumRadius -
            configuration.collisionPadding
          if (
            !rectContainsPoint(current.bounds, required(this.#positions[bodyIndex], 'body')) &&
            clearance > 0 &&
            Math.max(current.bounds.width, current.bounds.height) / vectorLength(delta) <
              configuration.barnesHutTheta
          ) {
            force = addVectors(
              force,
              repulsion(delta, current.mass, configuration.repulsionStrength),
            )
          } else {
            for (
              let child = current.childrenStart + 3;
              child >= current.childrenStart;
              child -= 1
            ) {
              stack.push(child)
            }
          }
        } else {
          let otherIndex = current.bodyHead
          while (otherIndex >= 0) {
            if (otherIndex !== bodyIndex) {
              const delta = between(
                required(this.#positions[otherIndex], 'other body position'),
                required(this.#positions[bodyIndex], 'body position'),
                bodyIndex,
                otherIndex,
              )
              force = addVectors(
                force,
                directRepulsion(
                  delta,
                  required(this.#radii[bodyIndex], 'body radius') +
                    required(this.#radii[otherIndex], 'other body radius') +
                    configuration.collisionPadding,
                  configuration,
                ),
              )
            }
            otherIndex = required(this.#nextBody[otherIndex], 'next quadtree body')
          }
        }
      }
      result[bodyIndex] = force
    }
    return result
  }

  private insert(bodyIndex: number, cellIndex: number, depth: number): void {
    let currentCellIndex = cellIndex
    let currentDepth = depth
    while (true) {
      const current = required(this.#cells[currentCellIndex], 'quadtree insertion cell')
      addBody(
        current,
        required(this.#positions[bodyIndex], 'quadtree body'),
        required(this.#radii[bodyIndex], 'quadtree radius'),
      )
      if (current.childrenStart !== undefined) {
        currentCellIndex = this.childIndex(bodyIndex, currentCellIndex, current.childrenStart)
        currentDepth += 1
        continue
      }
      if (current.bodyHead < 0) {
        current.bodyHead = bodyIndex
        return
      }
      if (currentDepth >= this.#maximumDepth) {
        this.#nextBody[bodyIndex] = current.bodyHead
        current.bodyHead = bodyIndex
        return
      }
      const existingHead = current.bodyHead
      const childrenStart = this.subdivide(currentCellIndex)
      current.bodyHead = -1
      let existingIndex = existingHead
      while (existingIndex >= 0) {
        const nextIndex = required(this.#nextBody[existingIndex], 'quadtree next body')
        this.#nextBody[existingIndex] = -1
        const destination = this.childIndex(existingIndex, currentCellIndex, childrenStart)
        this.insert(existingIndex, destination, currentDepth + 1)
        existingIndex = nextIndex
      }
      currentCellIndex = this.childIndex(bodyIndex, currentCellIndex, childrenStart)
      currentDepth += 1
    }
  }

  private subdivide(cellIndex: number): number {
    const parent = required(this.#cells[cellIndex], 'quadtree parent')
    const { bounds } = parent
    const halfWidth = bounds.width / 2
    const halfHeight = bounds.height / 2
    const start = this.#cells.length
    this.#cells.push(
      cell({ x: bounds.x, y: bounds.y, width: halfWidth, height: halfHeight }),
      cell({ x: bounds.x + halfWidth, y: bounds.y, width: halfWidth, height: halfHeight }),
      cell({ x: bounds.x, y: bounds.y + halfHeight, width: halfWidth, height: halfHeight }),
      cell({
        x: bounds.x + halfWidth,
        y: bounds.y + halfHeight,
        width: halfWidth,
        height: halfHeight,
      }),
    )
    parent.childrenStart = start
    return start
  }

  private childIndex(bodyIndex: number, parentIndex: number, childrenStart: number): number {
    const bounds = required(this.#cells[parentIndex], 'quadtree parent').bounds
    const position = required(this.#positions[bodyIndex], 'quadtree body position')
    const horizontal = position.x >= bounds.x + bounds.width / 2 ? 1 : 0
    const vertical = position.y >= bounds.y + bounds.height / 2 ? 2 : 0
    return childrenStart + horizontal + vertical
  }
}

const applyAttraction = (
  configuration: FdForceSimulationConfiguration,
  edges: readonly IndexedPair[],
  positions: readonly FdCanvasPoint[],
  forces: Vector[],
): void => {
  for (const edge of edges) {
    const delta = between(
      required(positions[edge.first], 'edge source position'),
      required(positions[edge.second], 'edge target position'),
      edge.first,
      edge.second,
    )
    const magnitude =
      configuration.attractionStrength * (vectorLength(delta) - configuration.idealEdgeLength)
    const force = scaleVector(unitVector(delta), magnitude)
    forces[edge.first] = addVectors(required(forces[edge.first], 'edge source force'), force)
    forces[edge.second] = subtractVectors(required(forces[edge.second], 'edge target force'), force)
  }
}

const applyCentering = (
  configuration: FdForceSimulationConfiguration,
  positions: readonly FdCanvasPoint[],
  forces: Vector[],
): void => {
  for (let index = 0; index < positions.length; index += 1) {
    const position = required(positions[index], 'centering position')
    const force = required(forces[index], 'centering force')
    forces[index] = {
      dx: force.dx - position.x * configuration.centeringStrength,
      dy: force.dy - position.y * configuration.centeringStrength,
    }
  }
}

const integrate = (
  configuration: FdForceSimulationConfiguration,
  positions: FdCanvasPoint[],
  velocities: Vector[],
  forces: readonly Vector[],
): number => {
  let maximumMovement = 0
  for (let index = 0; index < positions.length; index += 1) {
    let velocity = scaleVector(
      addVectors(
        required(velocities[index], 'simulation velocity'),
        scaleVector(required(forces[index], 'simulation force'), configuration.timeStep),
      ),
      configuration.damping,
    )
    let movement = scaleVector(velocity, configuration.timeStep)
    const distance = vectorLength(movement)
    if (distance > configuration.maximumDisplacement) {
      movement = scaleVector(movement, configuration.maximumDisplacement / distance)
      velocity = scaleVector(movement, 1 / configuration.timeStep)
    }
    const position = required(positions[index], 'simulation position')
    positions[index] = { x: position.x + movement.dx, y: position.y + movement.dy }
    velocities[index] = velocity
    maximumMovement = Math.max(maximumMovement, vectorLength(movement))
  }
  return maximumMovement
}

const recenter = (positions: FdCanvasPoint[]): void => {
  const sum = positions.reduce(
    (result, position) => ({ x: result.x + position.x, y: result.y + position.y }),
    { x: 0, y: 0 },
  )
  const average = { x: sum.x / positions.length, y: sum.y / positions.length }
  for (let index = 0; index < positions.length; index += 1) {
    const position = required(positions[index], 'recenter position')
    positions[index] = { x: position.x - average.x, y: position.y - average.y }
  }
}

const initialPositions = (count: number, spacing: number): FdCanvasPoint[] => {
  if (count === 0) return []
  const columns = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / columns)
  const origin = {
    x: (-(columns - 1) * spacing) / 2,
    y: (-(rows - 1) * spacing) / 2,
  }
  return Array.from({ length: count }, (_, index) => ({
    x: origin.x + (index % columns) * spacing,
    y: origin.y + Math.floor(index / columns) * spacing,
  }))
}

const rootBounds = (positions: readonly FdCanvasPoint[], minimumExtent: number): FdCanvasRect => {
  const first = required(positions[0], 'quadtree root position')
  let minimumX = first.x
  let maximumX = first.x
  let minimumY = first.y
  let maximumY = first.y
  for (let index = 1; index < positions.length; index += 1) {
    const position = required(positions[index], 'quadtree position')
    minimumX = Math.min(minimumX, position.x)
    maximumX = Math.max(maximumX, position.x)
    minimumY = Math.min(minimumY, position.y)
    maximumY = Math.max(maximumY, position.y)
  }
  const extent = Math.max(maximumX - minimumX, maximumY - minimumY, minimumExtent)
  const center = { x: (minimumX + maximumX) / 2, y: (minimumY + maximumY) / 2 }
  return {
    x: center.x - extent / 2,
    y: center.y - extent / 2,
    width: extent,
    height: extent,
  }
}

const cell = (bounds: FdCanvasRect): Cell => ({
  bounds,
  mass: 0,
  weightedX: 0,
  weightedY: 0,
  maximumRadius: 0,
  childrenStart: undefined,
  bodyHead: -1,
})

const addBody = (cell: Cell, position: FdCanvasPoint, radius: number): void => {
  cell.mass += 1
  cell.weightedX += position.x
  cell.weightedY += position.y
  cell.maximumRadius = Math.max(cell.maximumRadius, radius)
}

const centerOfMass = (cell: Cell): FdCanvasPoint => ({
  x: cell.weightedX / cell.mass,
  y: cell.weightedY / cell.mass,
})

const directRepulsion = (
  delta: Vector,
  requiredDistance: number,
  configuration: FdForceSimulationConfiguration,
): Vector => {
  let force = repulsion(delta, 1, configuration.repulsionStrength)
  const length = vectorLength(delta)
  if (length < requiredDistance) {
    force = addVectors(
      force,
      scaleVector(unitVector(delta), configuration.collisionStrength * (requiredDistance - length)),
    )
  }
  return force
}

const repulsion = (delta: Vector, sourceMass: number, strength: number): Vector =>
  scaleVector(
    unitVector(delta),
    (strength * sourceMass) / Math.max(vectorLengthSquared(delta), 2.2250738585072014e-308),
  )

const between = (
  source: FdCanvasPoint,
  target: FdCanvasPoint,
  firstIndex: number,
  secondIndex: number,
): Vector => {
  const value = { dx: target.x - source.x, dy: target.y - source.y }
  return value.dx === 0 && value.dy === 0 ? { dx: firstIndex < secondIndex ? -1 : 1, dy: 0 } : value
}

const vectorLengthSquared = (vector: Vector): number =>
  vector.dx * vector.dx + vector.dy * vector.dy
const vectorLength = (vector: Vector): number => Math.hypot(vector.dx, vector.dy)
const unitVector = (vector: Vector): Vector =>
  scaleVector(vector, 1 / Math.max(vectorLength(vector), 2.2250738585072014e-308))
const addVectors = (first: Vector, second: Vector): Vector => ({
  dx: first.dx + second.dx,
  dy: first.dy + second.dy,
})
const subtractVectors = (first: Vector, second: Vector): Vector => ({
  dx: first.dx - second.dx,
  dy: first.dy - second.dy,
})
const scaleVector = (vector: Vector, scale: number): Vector => ({
  dx: vector.dx * scale,
  dy: vector.dy * scale,
})

const endpointList = <NodeID extends FdGraphElementID, PortID extends FdGraphElementID>(
  endpoints:
    | {
        readonly kind: 'directed'
        readonly source: FdGraphLayoutEndpoint<NodeID, PortID>
        readonly target: FdGraphLayoutEndpoint<NodeID, PortID>
      }
    | {
        readonly kind: 'undirected'
        readonly first: FdGraphLayoutEndpoint<NodeID, PortID>
        readonly second: FdGraphLayoutEndpoint<NodeID, PortID>
      },
): readonly [FdGraphLayoutEndpoint<NodeID, PortID>, FdGraphLayoutEndpoint<NodeID, PortID>] =>
  endpoints.kind === 'directed'
    ? [endpoints.source, endpoints.target]
    : [endpoints.first, endpoints.second]

const unionRects = (first: FdCanvasRect, second: FdCanvasRect): FdCanvasRect => {
  const minimumX = Math.min(first.x, second.x)
  const minimumY = Math.min(first.y, second.y)
  const maximumX = Math.max(rectMaxX(first), rectMaxX(second))
  const maximumY = Math.max(rectMaxY(first), rectMaxY(second))
  return {
    x: minimumX,
    y: minimumY,
    width: maximumX - minimumX,
    height: maximumY - minimumY,
  }
}

const offsetRect = (rect: FdCanvasRect, dx: number, dy: number): FdCanvasRect => ({
  ...rect,
  x: rect.x + dx,
  y: rect.y + dy,
})
const rectMaxX = (rect: FdCanvasRect): number => rect.x + rect.width
const rectMaxY = (rect: FdCanvasRect): number => rect.y + rect.height
const rectContainsPoint = (rect: FdCanvasRect, point: FdCanvasPoint): boolean =>
  point.x >= rect.x && point.x <= rectMaxX(rect) && point.y >= rect.y && point.y <= rectMaxY(rect)
const maximum = (values: readonly number[]): number => {
  let result = 0
  for (const value of values) result = Math.max(result, value)
  return result
}

const required = <Value>(value: Value | undefined, name: string): Value => {
  if (value === undefined) throw new Error(`${name} invariant failed`)
  return value
}

const positiveFinite = (value: number, name: string): void => {
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError(`${name} must be positive and finite`)
}

const nonnegativeFinite = (value: number, name: string): void => {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be nonnegative and finite`)
}

const positiveInteger = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new RangeError(`${name} must be a positive integer`)
}

const nonnegativeInteger = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError(`${name} must be a nonnegative integer`)
}
