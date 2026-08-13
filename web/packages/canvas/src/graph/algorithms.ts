import type { FdGraphEndpoint, FdGraphSchema } from './core.js'
import type { FdGraph } from './storage.js'

export const FdGraphTraversalDirection = Object.freeze({
  outgoing: 'outgoing',
  incoming: 'incoming',
  incident: 'incident',
})

export type FdGraphTraversalDirection =
  (typeof FdGraphTraversalDirection)[keyof typeof FdGraphTraversalDirection]

export class FdGraphTraversalPolicy {
  readonly direction: FdGraphTraversalDirection
  readonly includesUndirected: boolean

  constructor(direction: FdGraphTraversalDirection, includesUndirected: boolean) {
    this.direction = direction
    this.includesUndirected = includesUndirected
  }

  static readonly outgoing = new FdGraphTraversalPolicy(FdGraphTraversalDirection.outgoing, true)
  static readonly incoming = new FdGraphTraversalPolicy(FdGraphTraversalDirection.incoming, true)
  static readonly incident = new FdGraphTraversalPolicy(FdGraphTraversalDirection.incident, true)
}

export class FdGraphPath<Schema extends FdGraphSchema> {
  readonly nodeIDs: readonly Schema['NodeID'][]
  readonly edgeIDs: readonly Schema['EdgeID'][]

  constructor(nodeIDs: readonly Schema['NodeID'][], edgeIDs: readonly Schema['EdgeID'][]) {
    this.nodeIDs = nodeIDs
    this.edgeIDs = edgeIDs
  }
}

export const FdDAGUndirectedEdgePolicy = Object.freeze({
  reject: 'reject',
})

export type FdDAGUndirectedEdgePolicy =
  (typeof FdDAGUndirectedEdgePolicy)[keyof typeof FdDAGUndirectedEdgePolicy]

export class FdDAGValidationConfiguration {
  readonly undirectedEdgePolicy: FdDAGUndirectedEdgePolicy

  constructor(undirectedEdgePolicy: FdDAGUndirectedEdgePolicy = FdDAGUndirectedEdgePolicy.reject) {
    this.undirectedEdgePolicy = undirectedEdgePolicy
  }
}

export type FdDAGValidationIssue<Schema extends FdGraphSchema> =
  | { readonly kind: 'cycle'; readonly edgePath: readonly Schema['EdgeID'][] }
  | { readonly kind: 'undirectedEdges'; readonly edgeIDs: readonly Schema['EdgeID'][] }

export const FdDAGValidationIssue = Object.freeze({
  cycle<Schema extends FdGraphSchema>(
    edgePath: readonly Schema['EdgeID'][],
  ): FdDAGValidationIssue<Schema> {
    return { kind: 'cycle', edgePath }
  },
  undirectedEdges<Schema extends FdGraphSchema>(
    edgeIDs: readonly Schema['EdgeID'][],
  ): FdDAGValidationIssue<Schema> {
    return { kind: 'undirectedEdges', edgeIDs }
  },
})

export interface FdDAGView<Schema extends FdGraphSchema> {
  readonly graph: FdGraph<Schema>
  readonly configuration: FdDAGValidationConfiguration
  readonly topologicalNodeIDs: readonly Schema['NodeID'][]
  readonly snapshotID: FdGraph<Schema>['snapshotID']
}

export type FdDAGValidationResult<Schema extends FdGraphSchema> =
  | { readonly kind: 'valid'; readonly view: FdDAGView<Schema> }
  | { readonly kind: 'invalid'; readonly issue: FdDAGValidationIssue<Schema> }

export const FdDAGValidationResult = Object.freeze({
  valid<Schema extends FdGraphSchema>(view: FdDAGView<Schema>): FdDAGValidationResult<Schema> {
    return { kind: 'valid', view }
  },
  invalid<Schema extends FdGraphSchema>(
    issue: FdDAGValidationIssue<Schema>,
  ): FdDAGValidationResult<Schema> {
    return { kind: 'invalid', issue }
  },
})

interface TraversalStep<Schema extends FdGraphSchema> {
  readonly edgeID: Schema['EdgeID']
  readonly nodeID: Schema['NodeID']
  readonly isUndirected: boolean
}

type FinishEvent<Schema extends FdGraphSchema> =
  | { readonly kind: 'enter'; readonly nodeID: Schema['NodeID'] }
  | { readonly kind: 'exit'; readonly nodeID: Schema['NodeID'] }

type CycleEvent<Schema extends FdGraphSchema> =
  | {
      readonly kind: 'enter'
      readonly nodeID: Schema['NodeID']
      readonly parentNodeID?: Schema['NodeID']
      readonly parentEdgeID?: Schema['EdgeID']
    }
  | {
      readonly kind: 'traverse'
      readonly source: Schema['NodeID']
      readonly step: TraversalStep<Schema>
    }
  | { readonly kind: 'exit'; readonly nodeID: Schema['NodeID'] }

export const fdReachableNodeIDs = <Schema extends FdGraphSchema>(
  graph: FdGraph<Schema>,
  start: Schema['NodeID'],
  policy: FdGraphTraversalPolicy,
  includesStart: boolean,
): Schema['NodeID'][] => {
  if (graph.node(start) === undefined) return []
  const discovered = new Set<Schema['NodeID']>([start])
  const result: Schema['NodeID'][] = []
  const stack: Schema['NodeID'][] = [start]
  while (stack.length > 0) {
    const current = stack.pop()
    if (current === undefined) break
    if (includesStart || current !== start) result.push(current)
    const neighbors = traversalSteps(graph, current, policy).map(({ nodeID }) => nodeID)
    for (let index = neighbors.length - 1; index >= 0; index -= 1) {
      const neighbor = neighbors[index]
      if (neighbor !== undefined && !discovered.has(neighbor)) {
        discovered.add(neighbor)
        stack.push(neighbor)
      }
    }
  }
  return result
}

export const fdShortestPath = <Schema extends FdGraphSchema>(
  graph: FdGraph<Schema>,
  start: Schema['NodeID'],
  destination: Schema['NodeID'],
  policy: FdGraphTraversalPolicy,
  excludedEdgeIDs: ReadonlySet<Schema['EdgeID']> = new Set(),
): FdGraphPath<Schema> | undefined => {
  if (graph.node(start) === undefined || graph.node(destination) === undefined) return undefined
  if (start === destination) return new FdGraphPath([start], [])
  const visited = new Set<Schema['NodeID']>([start])
  const parents = new Map<
    Schema['NodeID'],
    { readonly nodeID: Schema['NodeID']; readonly edgeID: Schema['EdgeID'] }
  >()
  const queue: Schema['NodeID'][] = [start]
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]
    if (current === undefined) continue
    for (const step of traversalSteps(graph, current, policy)) {
      if (excludedEdgeIDs.has(step.edgeID) || visited.has(step.nodeID)) continue
      visited.add(step.nodeID)
      parents.set(step.nodeID, { nodeID: current, edgeID: step.edgeID })
      if (step.nodeID === destination) return path(start, destination, parents)
      queue.push(step.nodeID)
    }
  }
  return undefined
}

export const fdWeaklyConnectedComponents = <Schema extends FdGraphSchema>(
  graph: FdGraph<Schema>,
): Schema['NodeID'][][] => {
  const visited = new Set<Schema['NodeID']>()
  const components: Schema['NodeID'][][] = []
  for (const start of graph.nodeIDs) {
    if (visited.has(start)) continue
    visited.add(start)
    const component: Schema['NodeID'][] = []
    const stack: Schema['NodeID'][] = [start]
    while (stack.length > 0) {
      const current = stack.pop()
      if (current === undefined) break
      component.push(current)
      const neighbors = traversalSteps(graph, current, FdGraphTraversalPolicy.incident).map(
        ({ nodeID }) => nodeID,
      )
      for (let index = neighbors.length - 1; index >= 0; index -= 1) {
        const neighbor = neighbors[index]
        if (neighbor !== undefined && !visited.has(neighbor)) {
          visited.add(neighbor)
          stack.push(neighbor)
        }
      }
    }
    components.push(component)
  }
  return components
}

export const fdStronglyConnectedComponents = <Schema extends FdGraphSchema>(
  graph: FdGraph<Schema>,
): Schema['NodeID'][][] => {
  const forward = new FdGraphTraversalPolicy(FdGraphTraversalDirection.outgoing, true)
  const reverse = new FdGraphTraversalPolicy(FdGraphTraversalDirection.incoming, true)
  const visited = new Set<Schema['NodeID']>()
  const finishOrder: Schema['NodeID'][] = []
  for (const nodeID of graph.nodeIDs) {
    if (!visited.has(nodeID)) depthFirstFinishOrder(graph, nodeID, forward, visited, finishOrder)
  }
  visited.clear()
  const components: Schema['NodeID'][][] = []
  for (let index = finishOrder.length - 1; index >= 0; index -= 1) {
    const start = finishOrder[index]
    if (start === undefined || visited.has(start)) continue
    visited.add(start)
    const component: Schema['NodeID'][] = []
    const stack: Schema['NodeID'][] = [start]
    while (stack.length > 0) {
      const current = stack.pop()
      if (current === undefined) break
      component.push(current)
      const neighbors = traversalSteps(graph, current, reverse).map(({ nodeID }) => nodeID)
      for (let neighborIndex = neighbors.length - 1; neighborIndex >= 0; neighborIndex -= 1) {
        const neighbor = neighbors[neighborIndex]
        if (neighbor !== undefined && !visited.has(neighbor)) {
          visited.add(neighbor)
          stack.push(neighbor)
        }
      }
    }
    components.push(component)
  }
  const rank = new Map(graph.nodeIDs.map((nodeID, index) => [nodeID, index]))
  for (const component of components) {
    component.sort(
      (first, second) =>
        (rank.get(first) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(second) ?? Number.MAX_SAFE_INTEGER),
    )
  }
  components.sort((first, second) => componentRank(first, rank) - componentRank(second, rank))
  return components
}

export const fdFirstCycleEdgeIDs = <Schema extends FdGraphSchema>(
  graph: FdGraph<Schema>,
): Schema['EdgeID'][] | undefined => {
  const components = fdStronglyConnectedComponents(graph)
  const componentByNodeID = new Map<Schema['NodeID'], number>()
  components.forEach((component, componentIndex) => {
    for (const nodeID of component) componentByNodeID.set(nodeID, componentIndex)
  })
  for (const edge of graph.edges) {
    if (edge.endpoints.kind !== 'directed') continue
    const source = endpointNodeID(edge.endpoints.source)
    const target = endpointNodeID(edge.endpoints.target)
    if (source === target) return [edge.id]
    if (componentByNodeID.get(source) !== componentByNodeID.get(target)) continue
    const returnPath = fdShortestPath(
      graph,
      target,
      source,
      FdGraphTraversalPolicy.outgoing,
      new Set([edge.id]),
    )
    if (returnPath !== undefined) return [edge.id, ...returnPath.edgeIDs]
  }
  return firstUndirectedCycleEdgeIDs(graph)
}

export type FdDAGValidationComputation<Schema extends FdGraphSchema> =
  | { readonly kind: 'valid'; readonly topologicalNodeIDs: readonly Schema['NodeID'][] }
  | { readonly kind: 'invalid'; readonly issue: FdDAGValidationIssue<Schema> }

export const fdValidateDAG = <Schema extends FdGraphSchema>(
  graph: FdGraph<Schema>,
  configuration: FdDAGValidationConfiguration,
): FdDAGValidationComputation<Schema> => {
  const undirectedEdgeIDs = graph.edges.flatMap((edge) =>
    edge.endpoints.kind === 'undirected' ? [edge.id] : [],
  )
  if (
    configuration.undirectedEdgePolicy === FdDAGUndirectedEdgePolicy.reject &&
    undirectedEdgeIDs.length > 0
  ) {
    return { kind: 'invalid', issue: FdDAGValidationIssue.undirectedEdges(undirectedEdgeIDs) }
  }
  const incomingCount = new Map(graph.nodeIDs.map((nodeID) => [nodeID, 0]))
  for (const edge of graph.edges) {
    if (edge.endpoints.kind !== 'directed') continue
    const target = endpointNodeID(edge.endpoints.target)
    incomingCount.set(target, (incomingCount.get(target) ?? 0) + 1)
  }
  const ready = graph.nodeIDs.filter((nodeID) => incomingCount.get(nodeID) === 0)
  const order: Schema['NodeID'][] = []
  const directedPolicy = new FdGraphTraversalPolicy(FdGraphTraversalDirection.outgoing, false)
  for (let index = 0; index < ready.length; index += 1) {
    const nodeID = ready[index]
    if (nodeID === undefined) continue
    order.push(nodeID)
    for (const step of traversalSteps(graph, nodeID, directedPolicy)) {
      const remaining = (incomingCount.get(step.nodeID) ?? 0) - 1
      incomingCount.set(step.nodeID, remaining)
      if (remaining === 0) ready.push(step.nodeID)
    }
  }
  if (order.length !== graph.nodeIDs.length) {
    const edgePath = fdFirstCycleEdgeIDs(graph)
    if (edgePath === undefined) throw new Error('Cyclic graph did not produce a cycle diagnostic')
    return { kind: 'invalid', issue: FdDAGValidationIssue.cycle(edgePath) }
  }
  return { kind: 'valid', topologicalNodeIDs: order }
}

const traversalSteps = <Schema extends FdGraphSchema>(
  graph: FdGraph<Schema>,
  nodeID: Schema['NodeID'],
  policy: FdGraphTraversalPolicy,
): TraversalStep<Schema>[] => {
  const candidateEdgeIDs =
    policy.direction === FdGraphTraversalDirection.outgoing
      ? graph.outgoingEdgeIDs(nodeID)
      : policy.direction === FdGraphTraversalDirection.incoming
        ? graph.incomingEdgeIDs(nodeID)
        : graph.incidentEdgeIDs(nodeID)
  return candidateEdgeIDs.flatMap<TraversalStep<Schema>>((edgeID) => {
    const endpoints = graph.edge(edgeID)?.endpoints
    if (endpoints === undefined) return []
    if (endpoints.kind === 'directed') {
      const source = endpointNodeID(endpoints.source)
      const target = endpointNodeID(endpoints.target)
      if (policy.direction === FdGraphTraversalDirection.outgoing && source === nodeID) {
        return [{ edgeID, nodeID: target, isUndirected: false }]
      }
      if (policy.direction === FdGraphTraversalDirection.incoming && target === nodeID) {
        return [{ edgeID, nodeID: source, isUndirected: false }]
      }
      if (policy.direction === FdGraphTraversalDirection.incident && source === nodeID) {
        return [{ edgeID, nodeID: target, isUndirected: false }]
      }
      if (policy.direction === FdGraphTraversalDirection.incident && target === nodeID) {
        return [{ edgeID, nodeID: source, isUndirected: false }]
      }
      return []
    }
    if (!policy.includesUndirected) return []
    const first = endpointNodeID(endpoints.first)
    const second = endpointNodeID(endpoints.second)
    if (first === nodeID) return [{ edgeID, nodeID: second, isUndirected: true }]
    if (second === nodeID) return [{ edgeID, nodeID: first, isUndirected: true }]
    return []
  })
}

const depthFirstFinishOrder = <Schema extends FdGraphSchema>(
  graph: FdGraph<Schema>,
  start: Schema['NodeID'],
  policy: FdGraphTraversalPolicy,
  visited: Set<Schema['NodeID']>,
  finishOrder: Schema['NodeID'][],
): void => {
  const stack: FinishEvent<Schema>[] = [{ kind: 'enter', nodeID: start }]
  while (stack.length > 0) {
    const event = stack.pop()
    if (event === undefined) break
    if (event.kind === 'exit') {
      finishOrder.push(event.nodeID)
      continue
    }
    if (visited.has(event.nodeID)) continue
    visited.add(event.nodeID)
    stack.push({ kind: 'exit', nodeID: event.nodeID })
    const neighbors = traversalSteps(graph, event.nodeID, policy).map(({ nodeID }) => nodeID)
    for (let index = neighbors.length - 1; index >= 0; index -= 1) {
      const neighbor = neighbors[index]
      if (neighbor !== undefined && !visited.has(neighbor)) {
        stack.push({ kind: 'enter', nodeID: neighbor })
      }
    }
  }
}

const firstUndirectedCycleEdgeIDs = <Schema extends FdGraphSchema>(
  graph: FdGraph<Schema>,
): Schema['EdgeID'][] | undefined => {
  const visited = new Set<Schema['NodeID']>()
  const active = new Set<Schema['NodeID']>()
  const parentNodeByNodeID = new Map<Schema['NodeID'], Schema['NodeID']>()
  const parentEdgeByNodeID = new Map<Schema['NodeID'], Schema['EdgeID']>()
  for (const root of graph.nodeIDs) {
    if (visited.has(root)) continue
    const stack: CycleEvent<Schema>[] = [{ kind: 'enter', nodeID: root }]
    while (stack.length > 0) {
      const event = stack.pop()
      if (event === undefined) break
      if (event.kind === 'exit') {
        active.delete(event.nodeID)
        continue
      }
      if (event.kind === 'traverse') {
        if (parentEdgeByNodeID.get(event.source) === event.step.edgeID) continue
        if (active.has(event.step.nodeID)) {
          return cyclePath(
            event.source,
            event.step.nodeID,
            event.step.edgeID,
            parentNodeByNodeID,
            parentEdgeByNodeID,
          )
        }
        if (!visited.has(event.step.nodeID)) {
          stack.push({
            kind: 'enter',
            nodeID: event.step.nodeID,
            parentNodeID: event.source,
            parentEdgeID: event.step.edgeID,
          })
        }
        continue
      }
      if (visited.has(event.nodeID)) continue
      visited.add(event.nodeID)
      active.add(event.nodeID)
      if (event.parentNodeID !== undefined && event.parentEdgeID !== undefined) {
        parentNodeByNodeID.set(event.nodeID, event.parentNodeID)
        parentEdgeByNodeID.set(event.nodeID, event.parentEdgeID)
      }
      stack.push({ kind: 'exit', nodeID: event.nodeID })
      const steps = traversalSteps(graph, event.nodeID, FdGraphTraversalPolicy.incident).filter(
        ({ isUndirected }) => isUndirected,
      )
      for (let index = steps.length - 1; index >= 0; index -= 1) {
        const step = steps[index]
        if (step !== undefined) stack.push({ kind: 'traverse', source: event.nodeID, step })
      }
    }
  }
  return undefined
}

const path = <Schema extends FdGraphSchema>(
  start: Schema['NodeID'],
  destination: Schema['NodeID'],
  parents: ReadonlyMap<
    Schema['NodeID'],
    { readonly nodeID: Schema['NodeID']; readonly edgeID: Schema['EdgeID'] }
  >,
): FdGraphPath<Schema> => {
  const nodeIDs: Schema['NodeID'][] = [destination]
  const edgeIDs: Schema['EdgeID'][] = []
  let current = destination
  while (current !== start) {
    const parent = parents.get(current)
    if (parent === undefined) throw new Error('Path reconstruction is missing a parent')
    edgeIDs.push(parent.edgeID)
    current = parent.nodeID
    nodeIDs.push(current)
  }
  return new FdGraphPath(nodeIDs.reverse(), edgeIDs.reverse())
}

const cyclePath = <Schema extends FdGraphSchema>(
  source: Schema['NodeID'],
  target: Schema['NodeID'],
  closingEdgeID: Schema['EdgeID'],
  parentNodeByNodeID: ReadonlyMap<Schema['NodeID'], Schema['NodeID']>,
  parentEdgeByNodeID: ReadonlyMap<Schema['NodeID'], Schema['EdgeID']>,
): Schema['EdgeID'][] => {
  const reversedPath = [closingEdgeID]
  let current = source
  while (current !== target) {
    const edgeID = parentEdgeByNodeID.get(current)
    const parentNodeID = parentNodeByNodeID.get(current)
    if (edgeID === undefined || parentNodeID === undefined) {
      throw new Error('Cycle reconstruction is missing a parent')
    }
    reversedPath.push(edgeID)
    current = parentNodeID
  }
  return reversedPath.reverse()
}

const endpointNodeID = <Schema extends FdGraphSchema>(
  endpoint: FdGraphEndpoint<Schema>,
): Schema['NodeID'] => (endpoint.kind === 'node' ? endpoint.nodeID : endpoint.key.nodeID)

const componentRank = <ID>(component: readonly ID[], rank: ReadonlyMap<ID, number>): number => {
  const first = component[0]
  return first === undefined
    ? Number.MAX_SAFE_INTEGER
    : (rank.get(first) ?? Number.MAX_SAFE_INTEGER)
}
