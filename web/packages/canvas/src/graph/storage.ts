import {
  FdDAGValidationConfiguration,
  FdDAGValidationResult,
  type FdDAGValidationResult as FdDAGValidationResultType,
  type FdDAGView,
  type FdGraphPath,
  FdGraphTraversalDirection,
  type FdGraphTraversalPolicy,
  FdGraphTraversalPolicy as FdGraphTraversalPolicyValue,
  fdFirstCycleEdgeIDs,
  fdReachableNodeIDs,
  fdShortestPath,
  fdStronglyConnectedComponents,
  fdValidateDAG,
  fdWeaklyConnectedComponents,
} from './algorithms.js'
import {
  type FdGraphEdge,
  type FdGraphEdgeEndpoints,
  type FdGraphEndpoint,
  FdGraphNode,
  type FdGraphOrderPosition,
  FdGraphPort,
  FdGraphPortKey,
  type FdGraphSchema,
  FdGraphSnapshotID,
} from './core.js'
import type { FdGraphElementID } from './model.js'
import type { FdGraphLocalElementID } from './presentation.js'

export class FdGraphElementChange<ID, Value> {
  readonly id: ID
  readonly oldValue: Value | undefined
  readonly newValue: Value | undefined

  constructor(id: ID, oldValue: Value | undefined, newValue: Value | undefined) {
    this.id = id
    this.oldValue = oldValue
    this.newValue = newValue
  }

  inverted(): FdGraphElementChange<ID, Value> {
    return new FdGraphElementChange(this.id, this.newValue, this.oldValue)
  }
}

export class FdGraphOrderChange<ID> {
  readonly id: ID
  readonly oldPosition: FdGraphOrderPosition<ID> | undefined
  readonly newPosition: FdGraphOrderPosition<ID> | undefined

  constructor(
    id: ID,
    oldPosition: FdGraphOrderPosition<ID> | undefined,
    newPosition: FdGraphOrderPosition<ID> | undefined,
  ) {
    this.id = id
    this.oldPosition = oldPosition
    this.newPosition = newPosition
  }

  inverted(): FdGraphOrderChange<ID> {
    return new FdGraphOrderChange(this.id, this.newPosition, this.oldPosition)
  }
}

export class FdGraphChangeSet<Schema extends FdGraphSchema> {
  readonly oldSnapshotID: FdGraphSnapshotID
  readonly newSnapshotID: FdGraphSnapshotID
  readonly nodeChanges: readonly FdGraphElementChange<Schema['NodeID'], FdGraphNode<Schema>>[]
  readonly portChanges: readonly FdGraphElementChange<FdGraphPortKey<Schema>, FdGraphPort<Schema>>[]
  readonly edgeChanges: readonly FdGraphElementChange<Schema['EdgeID'], FdGraphEdge<Schema>>[]
  readonly nodeOrderChanges: readonly FdGraphOrderChange<Schema['NodeID']>[]
  readonly portOrderChanges: readonly FdGraphOrderChange<FdGraphPortKey<Schema>>[]
  readonly edgeOrderChanges: readonly FdGraphOrderChange<Schema['EdgeID']>[]

  constructor(options: {
    readonly oldSnapshotID: FdGraphSnapshotID
    readonly newSnapshotID: FdGraphSnapshotID
    readonly nodeChanges: readonly FdGraphElementChange<Schema['NodeID'], FdGraphNode<Schema>>[]
    readonly portChanges: readonly FdGraphElementChange<
      FdGraphPortKey<Schema>,
      FdGraphPort<Schema>
    >[]
    readonly edgeChanges: readonly FdGraphElementChange<Schema['EdgeID'], FdGraphEdge<Schema>>[]
    readonly nodeOrderChanges: readonly FdGraphOrderChange<Schema['NodeID']>[]
    readonly portOrderChanges: readonly FdGraphOrderChange<FdGraphPortKey<Schema>>[]
    readonly edgeOrderChanges: readonly FdGraphOrderChange<Schema['EdgeID']>[]
  }) {
    this.oldSnapshotID = options.oldSnapshotID
    this.newSnapshotID = options.newSnapshotID
    this.nodeChanges = options.nodeChanges
    this.portChanges = options.portChanges
    this.edgeChanges = options.edgeChanges
    this.nodeOrderChanges = options.nodeOrderChanges
    this.portOrderChanges = options.portOrderChanges
    this.edgeOrderChanges = options.edgeOrderChanges
  }

  get isEmpty(): boolean {
    return (
      this.nodeChanges.length === 0 &&
      this.portChanges.length === 0 &&
      this.edgeChanges.length === 0 &&
      this.nodeOrderChanges.length === 0 &&
      this.portOrderChanges.length === 0 &&
      this.edgeOrderChanges.length === 0
    )
  }

  inverted(): FdGraphChangeSet<Schema> {
    return new FdGraphChangeSet({
      oldSnapshotID: this.newSnapshotID,
      newSnapshotID: this.oldSnapshotID,
      nodeChanges: this.nodeChanges.map((change) => change.inverted()),
      portChanges: this.portChanges.map((change) => change.inverted()),
      edgeChanges: this.edgeChanges.map((change) => change.inverted()),
      nodeOrderChanges: this.nodeOrderChanges.map((change) => change.inverted()),
      portOrderChanges: this.portOrderChanges.map((change) => change.inverted()),
      edgeOrderChanges: this.edgeOrderChanges.map((change) => change.inverted()),
    })
  }
}

export const FdGraphRemovalPolicy = Object.freeze({
  cascade: 'cascade',
  strict: 'strict',
})

export type FdGraphRemovalPolicy = (typeof FdGraphRemovalPolicy)[keyof typeof FdGraphRemovalPolicy]

export type FdGraphMutationIssue<Schema extends FdGraphSchema> =
  | {
      readonly kind: 'duplicateElement'
      readonly element: FdGraphLocalElementID<Schema['NodeID'], Schema['PortID'], Schema['EdgeID']>
    }
  | {
      readonly kind: 'unknownElement'
      readonly element: FdGraphLocalElementID<Schema['NodeID'], Schema['PortID'], Schema['EdgeID']>
    }
  | { readonly kind: 'unknownEndpoint'; readonly endpoint: FdGraphEndpoint<Schema> }
  | {
      readonly kind: 'incidentEdgesPreventRemoval'
      readonly element: FdGraphLocalElementID<Schema['NodeID'], Schema['PortID'], Schema['EdgeID']>
    }

export const FdGraphMutationIssue = Object.freeze({
  duplicateElement<Schema extends FdGraphSchema>(
    element: FdGraphLocalElementID<Schema['NodeID'], Schema['PortID'], Schema['EdgeID']>,
  ): FdGraphMutationIssue<Schema> {
    return { kind: 'duplicateElement', element }
  },
  unknownElement<Schema extends FdGraphSchema>(
    element: FdGraphLocalElementID<Schema['NodeID'], Schema['PortID'], Schema['EdgeID']>,
  ): FdGraphMutationIssue<Schema> {
    return { kind: 'unknownElement', element }
  },
  unknownEndpoint<Schema extends FdGraphSchema>(
    endpoint: FdGraphEndpoint<Schema>,
  ): FdGraphMutationIssue<Schema> {
    return { kind: 'unknownEndpoint', endpoint }
  },
  incidentEdgesPreventRemoval<Schema extends FdGraphSchema>(
    element: FdGraphLocalElementID<Schema['NodeID'], Schema['PortID'], Schema['EdgeID']>,
  ): FdGraphMutationIssue<Schema> {
    return { kind: 'incidentEdgesPreventRemoval', element }
  },
})

export type FdGraphUpdateResult<Schema extends FdGraphSchema> =
  | { readonly kind: 'committed'; readonly changeSet: FdGraphChangeSet<Schema> }
  | { readonly kind: 'rejected'; readonly issue: FdGraphMutationIssue<Schema> }

export const FdGraphUpdateResult = Object.freeze({
  committed<Schema extends FdGraphSchema>(
    changeSet: FdGraphChangeSet<Schema>,
  ): FdGraphUpdateResult<Schema> {
    return { kind: 'committed', changeSet }
  },
  rejected<Schema extends FdGraphSchema>(
    issue: FdGraphMutationIssue<Schema>,
  ): FdGraphUpdateResult<Schema> {
    return { kind: 'rejected', issue }
  },
})

export interface FdGraphTransaction<Schema extends FdGraphSchema> {
  insert(node: FdGraphNode<Schema>): void
  insert(port: FdGraphPort<Schema>): void
  insert(edge: FdGraphEdge<Schema>): void
  update(node: FdGraphNode<Schema>): void
  update(port: FdGraphPort<Schema>): void
  update(edge: FdGraphEdge<Schema>): void
  removeNode(id: Schema['NodeID'], policy?: FdGraphRemovalPolicy): void
  removePort(key: FdGraphPortKey<Schema>, policy?: FdGraphRemovalPolicy): void
  removeEdge(id: Schema['EdgeID']): void
  moveNode(id: Schema['NodeID'], position: FdGraphOrderPosition<Schema['NodeID']>): void
  movePort(key: FdGraphPortKey<Schema>, position: FdGraphOrderPosition<Schema['PortID']>): void
  moveEdge(id: Schema['EdgeID'], position: FdGraphOrderPosition<Schema['EdgeID']>): void
}

interface GraphState<Schema extends FdGraphSchema> {
  snapshotID: FdGraphSnapshotID
  localRevision: number
  nodesByID: Map<Schema['NodeID'], FdGraphNode<Schema>>
  portsByKey: Map<string, FdGraphPort<Schema>>
  edgesByID: Map<Schema['EdgeID'], FdGraphEdge<Schema>>
  nodeOrder: Schema['NodeID'][]
  portOrderByNodeID: Map<Schema['NodeID'], Schema['PortID'][]>
  edgeOrder: Schema['EdgeID'][]
  edgeOrderIndex: Map<Schema['EdgeID'], number>
  directedOutgoingEdgeIDsByNodeID: Map<Schema['NodeID'], Schema['EdgeID'][]>
  directedIncomingEdgeIDsByNodeID: Map<Schema['NodeID'], Schema['EdgeID'][]>
  undirectedEdgeIDsByNodeID: Map<Schema['NodeID'], Schema['EdgeID'][]>
  incidentEdgeIDsByNodeID: Map<Schema['NodeID'], Schema['EdgeID'][]>
  incidentEdgeIDsByEndpoint: Map<string, Schema['EdgeID'][]>
}

export class FdGraph<Schema extends FdGraphSchema> {
  private state: GraphState<Schema>

  constructor() {
    this.state = {
      snapshotID: new FdGraphSnapshotID(),
      localRevision: 0,
      nodesByID: new Map(),
      portsByKey: new Map(),
      edgesByID: new Map(),
      nodeOrder: [],
      portOrderByNodeID: new Map(),
      edgeOrder: [],
      edgeOrderIndex: new Map(),
      directedOutgoingEdgeIDsByNodeID: new Map(),
      directedIncomingEdgeIDsByNodeID: new Map(),
      undirectedEdgeIDsByNodeID: new Map(),
      incidentEdgeIDsByNodeID: new Map(),
      incidentEdgeIDsByEndpoint: new Map(),
    }
  }

  get snapshotID(): FdGraphSnapshotID {
    return this.state.snapshotID
  }

  get localRevision(): number {
    return this.state.localRevision
  }

  get nodes(): readonly FdGraphNode<Schema>[] {
    return this.state.nodeOrder.flatMap((id) => {
      const node = this.state.nodesByID.get(id)
      return node === undefined ? [] : [node]
    })
  }

  get ports(): readonly FdGraphPort<Schema>[] {
    return this.state.nodeOrder.flatMap((nodeID) => this.portsForNode(nodeID))
  }

  get edges(): readonly FdGraphEdge<Schema>[] {
    return this.state.edgeOrder.flatMap((id) => {
      const edge = this.state.edgesByID.get(id)
      return edge === undefined ? [] : [edge]
    })
  }

  get nodeIDs(): readonly Schema['NodeID'][] {
    return this.state.nodeOrder
  }

  get portKeys(): readonly FdGraphPortKey<Schema>[] {
    return this.ports.map((port) => port.key)
  }

  get edgeIDs(): readonly Schema['EdgeID'][] {
    return this.state.edgeOrder
  }

  get isEmpty(): boolean {
    return this.nodeCount === 0 && this.portCount === 0 && this.edgeCount === 0
  }

  get nodeCount(): number {
    return this.state.nodesByID.size
  }

  get portCount(): number {
    return this.state.portsByKey.size
  }

  get edgeCount(): number {
    return this.state.edgesByID.size
  }

  node(id: Schema['NodeID']): FdGraphNode<Schema> | undefined {
    return this.state.nodesByID.get(id)
  }

  port(key: FdGraphPortKey<Schema>): FdGraphPort<Schema> | undefined {
    return this.state.portsByKey.get(portKey(key))
  }

  portsForNode(nodeID: Schema['NodeID']): readonly FdGraphPort<Schema>[] {
    return (this.state.portOrderByNodeID.get(nodeID) ?? []).flatMap((portID) => {
      const port = this.state.portsByKey.get(portKey(new FdGraphPortKey(nodeID, portID)))
      return port === undefined ? [] : [port]
    })
  }

  edge(id: Schema['EdgeID']): FdGraphEdge<Schema> | undefined {
    return this.state.edgesByID.get(id)
  }

  incidentEdgeIDs(nodeID: Schema['NodeID']): readonly Schema['EdgeID'][]
  incidentEdgeIDs(endpoint: FdGraphEndpoint<Schema>): readonly Schema['EdgeID'][]
  incidentEdgeIDs(
    nodeIDOrEndpoint: Schema['NodeID'] | FdGraphEndpoint<Schema>,
  ): readonly Schema['EdgeID'][] {
    return typeof nodeIDOrEndpoint === 'object'
      ? (this.state.incidentEdgeIDsByEndpoint.get(endpointKey(nodeIDOrEndpoint)) ?? [])
      : (this.state.incidentEdgeIDsByNodeID.get(nodeIDOrEndpoint) ?? [])
  }

  outgoingEdgeIDs(nodeID: Schema['NodeID']): readonly Schema['EdgeID'][] {
    return mergedEdgeIDs(
      this.state,
      this.state.directedOutgoingEdgeIDsByNodeID.get(nodeID) ?? [],
      this.state.undirectedEdgeIDsByNodeID.get(nodeID) ?? [],
    )
  }

  incomingEdgeIDs(nodeID: Schema['NodeID']): readonly Schema['EdgeID'][] {
    return mergedEdgeIDs(
      this.state,
      this.state.directedIncomingEdgeIDsByNodeID.get(nodeID) ?? [],
      this.state.undirectedEdgeIDsByNodeID.get(nodeID) ?? [],
    )
  }

  reachableNodeIDs(
    start: Schema['NodeID'],
    policy: FdGraphTraversalPolicy = FdGraphTraversalPolicyValue.outgoing,
    includesStart = true,
  ): readonly Schema['NodeID'][] {
    return fdReachableNodeIDs(this, start, policy, includesStart)
  }

  descendantNodeIDs(nodeID: Schema['NodeID'], includesStart = false): readonly Schema['NodeID'][] {
    return fdReachableNodeIDs(
      this,
      nodeID,
      new FdGraphTraversalPolicyValue(FdGraphTraversalDirection.outgoing, false),
      includesStart,
    )
  }

  ancestorNodeIDs(nodeID: Schema['NodeID'], includesStart = false): readonly Schema['NodeID'][] {
    return fdReachableNodeIDs(
      this,
      nodeID,
      new FdGraphTraversalPolicyValue(FdGraphTraversalDirection.incoming, false),
      includesStart,
    )
  }

  shortestPath(
    start: Schema['NodeID'],
    destination: Schema['NodeID'],
    policy: FdGraphTraversalPolicy = FdGraphTraversalPolicyValue.outgoing,
  ): FdGraphPath<Schema> | undefined {
    return fdShortestPath(this, start, destination, policy)
  }

  weaklyConnectedComponents(): readonly (readonly Schema['NodeID'][])[] {
    return fdWeaklyConnectedComponents(this)
  }

  stronglyConnectedComponents(): readonly (readonly Schema['NodeID'][])[] {
    return fdStronglyConnectedComponents(this)
  }

  firstCycleEdgeIDs(): readonly Schema['EdgeID'][] | undefined {
    return fdFirstCycleEdgeIDs(this)
  }

  validateDAG(
    configuration = new FdDAGValidationConfiguration(),
  ): FdDAGValidationResultType<Schema> {
    const computation = fdValidateDAG(this, configuration)
    if (computation.kind === 'invalid') {
      return FdDAGValidationResult.invalid(computation.issue)
    }
    const graph = this.snapshotCopy()
    const view: FdDAGView<Schema> = {
      graph,
      configuration,
      topologicalNodeIDs: computation.topologicalNodeIDs,
      snapshotID: graph.snapshotID,
    }
    return FdDAGValidationResult.valid(view)
  }

  update(body: (transaction: FdGraphTransaction<Schema>) => void): FdGraphUpdateResult<Schema> {
    const original = this.state
    const transaction = new GraphTransaction<Schema>(cloneState(original))
    body(transaction)

    if (transaction.issue !== undefined) {
      return FdGraphUpdateResult.rejected(transaction.issue)
    }

    if (!transaction.hasChanges) {
      return FdGraphUpdateResult.committed(emptyChangeSet(original.snapshotID))
    }

    const nextSnapshotID = new FdGraphSnapshotID()
    const changeSet = transaction.changeSet(original, nextSnapshotID)
    if (changeSet.isEmpty) {
      return FdGraphUpdateResult.committed(emptyChangeSet(original.snapshotID))
    }

    transaction.state.snapshotID = nextSnapshotID
    transaction.state.localRevision = original.localRevision + 1
    this.state = transaction.state
    return FdGraphUpdateResult.committed(changeSet)
  }

  private snapshotCopy(): FdGraph<Schema> {
    const graph = new FdGraph<Schema>()
    graph.state = cloneState(this.state)
    return graph
  }
}

class GraphTransaction<Schema extends FdGraphSchema> implements FdGraphTransaction<Schema> {
  readonly state: GraphState<Schema>
  issue: FdGraphMutationIssue<Schema> | undefined
  private readonly touchedNodeIDs = new Map<Schema['NodeID'], true>()
  private readonly touchedPortKeys = new Map<string, FdGraphPortKey<Schema>>()
  private readonly touchedEdgeIDs = new Map<Schema['EdgeID'], true>()
  private readonly touchedNodeOrderIDs = new Map<Schema['NodeID'], true>()
  private readonly touchedPortOrderKeys = new Map<string, FdGraphPortKey<Schema>>()
  private readonly touchedEdgeOrderIDs = new Map<Schema['EdgeID'], true>()

  constructor(state: GraphState<Schema>) {
    this.state = state
  }

  get hasChanges(): boolean {
    return (
      this.touchedNodeIDs.size > 0 ||
      this.touchedPortKeys.size > 0 ||
      this.touchedEdgeIDs.size > 0 ||
      this.touchedNodeOrderIDs.size > 0 ||
      this.touchedPortOrderKeys.size > 0 ||
      this.touchedEdgeOrderIDs.size > 0
    )
  }

  insert(element: FdGraphNode<Schema> | FdGraphPort<Schema> | FdGraphEdge<Schema>): void {
    if (this.issue !== undefined) return
    if (element instanceof FdGraphNode) {
      this.insertNode(element)
    } else if (element instanceof FdGraphPort) {
      this.insertPort(element)
    } else {
      this.insertEdge(element)
    }
  }

  update(element: FdGraphNode<Schema> | FdGraphPort<Schema> | FdGraphEdge<Schema>): void {
    if (this.issue !== undefined) return
    if (element instanceof FdGraphNode) {
      this.updateNode(element)
    } else if (element instanceof FdGraphPort) {
      this.updatePort(element)
    } else {
      this.updateEdge(element)
    }
  }

  removeNode(
    id: Schema['NodeID'],
    policy: FdGraphRemovalPolicy = FdGraphRemovalPolicy.cascade,
  ): void {
    if (this.issue !== undefined) return
    if (!this.state.nodesByID.has(id)) {
      this.reject(FdGraphMutationIssue.unknownElement({ kind: 'node', nodeID: id }))
      return
    }
    const incident = this.incidentEdgeIDsForNode(id)
    if (policy === FdGraphRemovalPolicy.strict && incident.length > 0) {
      this.reject(FdGraphMutationIssue.incidentEdgesPreventRemoval({ kind: 'node', nodeID: id }))
      return
    }
    for (const edgeID of incident) this.removeEdgeUnchecked(edgeID)
    for (const portID of this.state.portOrderByNodeID.get(id) ?? []) {
      const key = new FdGraphPortKey<Schema>(id, portID)
      this.state.portsByKey.delete(portKey(key))
      this.touchPort(key)
      this.touchPortOrder(key)
    }
    this.state.portOrderByNodeID.delete(id)
    this.state.nodesByID.delete(id)
    removeValue(this.state.nodeOrder, id)
    this.state.directedOutgoingEdgeIDsByNodeID.delete(id)
    this.state.directedIncomingEdgeIDsByNodeID.delete(id)
    this.state.undirectedEdgeIDsByNodeID.delete(id)
    this.state.incidentEdgeIDsByNodeID.delete(id)
    this.touchNode(id)
    this.touchNodeOrder(id)
  }

  removePort(
    key: FdGraphPortKey<Schema>,
    policy: FdGraphRemovalPolicy = FdGraphRemovalPolicy.cascade,
  ): void {
    if (this.issue !== undefined) return
    const storageKey = portKey(key)
    if (!this.state.portsByKey.has(storageKey)) {
      this.reject(FdGraphMutationIssue.unknownElement({ kind: 'port', key }))
      return
    }
    const incident = this.incidentEdgeIDsForEndpoint({ kind: 'port', key })
    if (policy === FdGraphRemovalPolicy.strict && incident.length > 0) {
      this.reject(FdGraphMutationIssue.incidentEdgesPreventRemoval({ kind: 'port', key }))
      return
    }
    for (const edgeID of incident) this.removeEdgeUnchecked(edgeID)
    this.state.portsByKey.delete(storageKey)
    const order = this.state.portOrderByNodeID.get(key.nodeID)
    if (order !== undefined) removeValue(order, key.portID)
    this.touchPort(key)
    this.touchPortOrder(key)
  }

  removeEdge(id: Schema['EdgeID']): void {
    if (this.issue !== undefined) return
    if (!this.state.edgesByID.has(id)) {
      this.reject(FdGraphMutationIssue.unknownElement({ kind: 'edge', edgeID: id }))
      return
    }
    this.removeEdgeUnchecked(id)
  }

  moveNode(id: Schema['NodeID'], position: FdGraphOrderPosition<Schema['NodeID']>): void {
    if (this.issue !== undefined) return
    if (!this.state.nodesByID.has(id)) {
      this.reject(FdGraphMutationIssue.unknownElement({ kind: 'node', nodeID: id }))
      return
    }
    const target = positionTarget(position)
    if (target !== undefined && !this.state.nodesByID.has(target)) {
      this.reject(FdGraphMutationIssue.unknownElement({ kind: 'node', nodeID: target }))
      return
    }
    this.state.nodeOrder = moving(id, this.state.nodeOrder, position)
    this.touchNodeOrder(id)
  }

  movePort(key: FdGraphPortKey<Schema>, position: FdGraphOrderPosition<Schema['PortID']>): void {
    if (this.issue !== undefined) return
    if (!this.state.portsByKey.has(portKey(key))) {
      this.reject(FdGraphMutationIssue.unknownElement({ kind: 'port', key }))
      return
    }
    const target = positionTarget(position)
    if (
      target !== undefined &&
      !this.state.portsByKey.has(portKey(new FdGraphPortKey(key.nodeID, target)))
    ) {
      this.reject(
        FdGraphMutationIssue.unknownElement({
          kind: 'port',
          key: new FdGraphPortKey(key.nodeID, target),
        }),
      )
      return
    }
    const order = this.state.portOrderByNodeID.get(key.nodeID) ?? []
    this.state.portOrderByNodeID.set(key.nodeID, moving(key.portID, order, position))
    this.touchPortOrder(key)
  }

  moveEdge(id: Schema['EdgeID'], position: FdGraphOrderPosition<Schema['EdgeID']>): void {
    if (this.issue !== undefined) return
    if (!this.state.edgesByID.has(id)) {
      this.reject(FdGraphMutationIssue.unknownElement({ kind: 'edge', edgeID: id }))
      return
    }
    const target = positionTarget(position)
    if (target !== undefined && !this.state.edgesByID.has(target)) {
      this.reject(FdGraphMutationIssue.unknownElement({ kind: 'edge', edgeID: target }))
      return
    }
    this.state.edgeOrder = moving(id, this.state.edgeOrder, position)
    rebuildEdgeOrderIndex(this.state)
    sortEdgeIndices(this.state)
    this.touchEdgeOrder(id)
  }

  changeSet(
    original: GraphState<Schema>,
    newSnapshotID: FdGraphSnapshotID,
  ): FdGraphChangeSet<Schema> {
    const oldNodePositions = positions(this.touchedNodeOrderIDs.keys(), original.nodeOrder)
    const newNodePositions = positions(this.touchedNodeOrderIDs.keys(), this.state.nodeOrder)
    const oldPortPositions = portPositions(this.touchedPortOrderKeys.values(), original)
    const newPortPositions = portPositions(this.touchedPortOrderKeys.values(), this.state)
    const oldEdgePositions = positions(this.touchedEdgeOrderIDs.keys(), original.edgeOrder)
    const newEdgePositions = positions(this.touchedEdgeOrderIDs.keys(), this.state.edgeOrder)

    return new FdGraphChangeSet({
      oldSnapshotID: original.snapshotID,
      newSnapshotID,
      nodeChanges: [...this.touchedNodeIDs.keys()].flatMap((id) => {
        const oldValue = original.nodesByID.get(id)
        const newValue = this.state.nodesByID.get(id)
        return oldValue === undefined && newValue === undefined
          ? []
          : [new FdGraphElementChange(id, oldValue, newValue)]
      }),
      portChanges: [...this.touchedPortKeys.values()].flatMap((key) => {
        const oldValue = original.portsByKey.get(portKey(key))
        const newValue = this.state.portsByKey.get(portKey(key))
        return oldValue === undefined && newValue === undefined
          ? []
          : [new FdGraphElementChange(key, oldValue, newValue)]
      }),
      edgeChanges: [...this.touchedEdgeIDs.keys()].flatMap((id) => {
        const oldValue = original.edgesByID.get(id)
        const newValue = this.state.edgesByID.get(id)
        return oldValue === undefined && newValue === undefined
          ? []
          : [new FdGraphElementChange(id, oldValue, newValue)]
      }),
      nodeOrderChanges: orderChanges(
        this.touchedNodeOrderIDs.keys(),
        oldNodePositions,
        newNodePositions,
      ),
      portOrderChanges: portOrderChanges(
        this.touchedPortOrderKeys.values(),
        oldPortPositions,
        newPortPositions,
      ),
      edgeOrderChanges: orderChanges(
        this.touchedEdgeOrderIDs.keys(),
        oldEdgePositions,
        newEdgePositions,
      ),
    })
  }

  private insertNode(node: FdGraphNode<Schema>): void {
    if (this.state.nodesByID.has(node.id)) {
      this.reject(FdGraphMutationIssue.duplicateElement({ kind: 'node', nodeID: node.id }))
      return
    }
    this.state.nodesByID.set(node.id, node)
    this.state.nodeOrder.push(node.id)
    this.state.portOrderByNodeID.set(node.id, [])
    this.touchNode(node.id)
    this.touchNodeOrder(node.id)
  }

  private updateNode(node: FdGraphNode<Schema>): void {
    if (!this.state.nodesByID.has(node.id)) {
      this.reject(FdGraphMutationIssue.unknownElement({ kind: 'node', nodeID: node.id }))
      return
    }
    this.state.nodesByID.set(node.id, node)
    this.touchNode(node.id)
  }

  private insertPort(port: FdGraphPort<Schema>): void {
    if (!this.state.nodesByID.has(port.key.nodeID)) {
      this.reject(FdGraphMutationIssue.unknownElement({ kind: 'node', nodeID: port.key.nodeID }))
      return
    }
    const key = portKey(port.key)
    if (this.state.portsByKey.has(key)) {
      this.reject(FdGraphMutationIssue.duplicateElement({ kind: 'port', key: port.key }))
      return
    }
    this.state.portsByKey.set(key, port)
    this.state.portOrderByNodeID.get(port.key.nodeID)?.push(port.key.portID)
    this.touchPort(port.key)
    this.touchPortOrder(port.key)
  }

  private updatePort(port: FdGraphPort<Schema>): void {
    const key = portKey(port.key)
    if (!this.state.portsByKey.has(key)) {
      this.reject(FdGraphMutationIssue.unknownElement({ kind: 'port', key: port.key }))
      return
    }
    this.state.portsByKey.set(key, port)
    this.touchPort(port.key)
  }

  private insertEdge(edge: FdGraphEdge<Schema>): void {
    if (this.state.edgesByID.has(edge.id)) {
      this.reject(FdGraphMutationIssue.duplicateElement({ kind: 'edge', edgeID: edge.id }))
      return
    }
    if (!this.validateEndpoints(edge.endpoints)) return
    this.state.edgesByID.set(edge.id, edge)
    this.state.edgeOrder.push(edge.id)
    this.state.edgeOrderIndex.set(edge.id, this.state.edgeOrder.length - 1)
    addEdgeToIndices(this.state, edge)
    this.touchEdge(edge.id)
    this.touchEdgeOrder(edge.id)
  }

  private updateEdge(edge: FdGraphEdge<Schema>): void {
    const previous = this.state.edgesByID.get(edge.id)
    if (previous === undefined) {
      this.reject(FdGraphMutationIssue.unknownElement({ kind: 'edge', edgeID: edge.id }))
      return
    }
    if (!this.validateEndpoints(edge.endpoints)) return
    removeEdgeFromIndices(this.state, previous)
    this.state.edgesByID.set(edge.id, edge)
    addEdgeToIndices(this.state, edge)
    this.touchEdge(edge.id)
  }

  private validateEndpoints(endpoints: FdGraphEdgeEndpoints<Schema>): boolean {
    for (const endpoint of endpointList(endpoints)) {
      const exists =
        endpoint.kind === 'node'
          ? this.state.nodesByID.has(endpoint.nodeID)
          : this.state.portsByKey.has(portKey(endpoint.key))
      if (!exists) {
        this.reject(FdGraphMutationIssue.unknownEndpoint(endpoint))
        return false
      }
    }
    return true
  }

  private incidentEdgeIDsForNode(nodeID: Schema['NodeID']): Schema['EdgeID'][] {
    return [...(this.state.incidentEdgeIDsByNodeID.get(nodeID) ?? [])]
  }

  private incidentEdgeIDsForEndpoint(endpoint: FdGraphEndpoint<Schema>): Schema['EdgeID'][] {
    return [...(this.state.incidentEdgeIDsByEndpoint.get(endpointKey(endpoint)) ?? [])]
  }

  private removeEdgeUnchecked(id: Schema['EdgeID']): void {
    const edge = this.state.edgesByID.get(id)
    if (edge === undefined) return
    removeEdgeFromIndices(this.state, edge)
    this.state.edgesByID.delete(id)
    removeValue(this.state.edgeOrder, id)
    rebuildEdgeOrderIndex(this.state)
    this.touchEdge(id)
    this.touchEdgeOrder(id)
  }

  private reject(issue: FdGraphMutationIssue<Schema>): void {
    this.issue = issue
  }

  private touchNode(id: Schema['NodeID']): void {
    this.touchedNodeIDs.set(id, true)
  }

  private touchPort(key: FdGraphPortKey<Schema>): void {
    this.touchedPortKeys.set(portKey(key), key)
  }

  private touchEdge(id: Schema['EdgeID']): void {
    this.touchedEdgeIDs.set(id, true)
  }

  private touchNodeOrder(id: Schema['NodeID']): void {
    this.touchedNodeOrderIDs.set(id, true)
  }

  private touchPortOrder(key: FdGraphPortKey<Schema>): void {
    this.touchedPortOrderKeys.set(portKey(key), key)
  }

  private touchEdgeOrder(id: Schema['EdgeID']): void {
    this.touchedEdgeOrderIDs.set(id, true)
  }
}

const cloneState = <Schema extends FdGraphSchema>(
  state: GraphState<Schema>,
): GraphState<Schema> => ({
  snapshotID: state.snapshotID,
  localRevision: state.localRevision,
  nodesByID: new Map(state.nodesByID),
  portsByKey: new Map(state.portsByKey),
  edgesByID: new Map(state.edgesByID),
  nodeOrder: [...state.nodeOrder],
  portOrderByNodeID: new Map(
    [...state.portOrderByNodeID].map(([nodeID, order]) => [nodeID, [...order]]),
  ),
  edgeOrder: [...state.edgeOrder],
  edgeOrderIndex: new Map(state.edgeOrderIndex),
  directedOutgoingEdgeIDsByNodeID: cloneOrderMap(state.directedOutgoingEdgeIDsByNodeID),
  directedIncomingEdgeIDsByNodeID: cloneOrderMap(state.directedIncomingEdgeIDsByNodeID),
  undirectedEdgeIDsByNodeID: cloneOrderMap(state.undirectedEdgeIDsByNodeID),
  incidentEdgeIDsByNodeID: cloneOrderMap(state.incidentEdgeIDsByNodeID),
  incidentEdgeIDsByEndpoint: cloneOrderMap(state.incidentEdgeIDsByEndpoint),
})

const emptyChangeSet = <Schema extends FdGraphSchema>(
  snapshotID: FdGraphSnapshotID,
): FdGraphChangeSet<Schema> =>
  new FdGraphChangeSet({
    oldSnapshotID: snapshotID,
    newSnapshotID: snapshotID,
    nodeChanges: [],
    portChanges: [],
    edgeChanges: [],
    nodeOrderChanges: [],
    portOrderChanges: [],
    edgeOrderChanges: [],
  })

const idKey = (id: FdGraphElementID): string =>
  typeof id === 'number' ? `number:${id}` : `string:${id.length}:${id}`

const portKey = <Schema extends FdGraphSchema>(key: FdGraphPortKey<Schema>): string =>
  `${idKey(key.nodeID)}|${idKey(key.portID)}`

const endpointKey = <Schema extends FdGraphSchema>(endpoint: FdGraphEndpoint<Schema>): string =>
  endpoint.kind === 'node' ? `node:${idKey(endpoint.nodeID)}` : `port:${portKey(endpoint.key)}`

const endpointNodeID = <Schema extends FdGraphSchema>(
  endpoint: FdGraphEndpoint<Schema>,
): Schema['NodeID'] => (endpoint.kind === 'node' ? endpoint.nodeID : endpoint.key.nodeID)

const endpointList = <Schema extends FdGraphSchema>(
  endpoints: FdGraphEdgeEndpoints<Schema>,
): readonly [FdGraphEndpoint<Schema>, FdGraphEndpoint<Schema>] =>
  endpoints.kind === 'directed'
    ? [endpoints.source, endpoints.target]
    : [endpoints.first, endpoints.second]

const mergedEdgeIDs = <Schema extends FdGraphSchema>(
  state: GraphState<Schema>,
  first: readonly Schema['EdgeID'][],
  second: readonly Schema['EdgeID'][],
): Schema['EdgeID'][] => {
  const result: Schema['EdgeID'][] = []
  let firstIndex = 0
  let secondIndex = 0
  while (firstIndex < first.length && secondIndex < second.length) {
    const firstID = first[firstIndex]
    const secondID = second[secondIndex]
    if (firstID === undefined || secondID === undefined) break
    if (
      (state.edgeOrderIndex.get(firstID) ?? Number.MAX_SAFE_INTEGER) <
      (state.edgeOrderIndex.get(secondID) ?? Number.MAX_SAFE_INTEGER)
    ) {
      result.push(firstID)
      firstIndex += 1
    } else {
      result.push(secondID)
      secondIndex += 1
    }
  }
  result.push(...first.slice(firstIndex), ...second.slice(secondIndex))
  return result
}

const addEdgeToIndices = <Schema extends FdGraphSchema>(
  state: GraphState<Schema>,
  edge: FdGraphEdge<Schema>,
): void => {
  const endpoints = endpointList(edge.endpoints)
  const nodeIDs = new Set(endpoints.map(endpointNodeID))
  const distinctEndpoints = new Map(endpoints.map((endpoint) => [endpointKey(endpoint), endpoint]))
  for (const key of distinctEndpoints.keys())
    appendToOrderMap(state.incidentEdgeIDsByEndpoint, key, edge.id)
  for (const nodeID of nodeIDs) appendToOrderMap(state.incidentEdgeIDsByNodeID, nodeID, edge.id)
  if (edge.endpoints.kind === 'directed') {
    appendToOrderMap(
      state.directedOutgoingEdgeIDsByNodeID,
      endpointNodeID(edge.endpoints.source),
      edge.id,
    )
    appendToOrderMap(
      state.directedIncomingEdgeIDsByNodeID,
      endpointNodeID(edge.endpoints.target),
      edge.id,
    )
  } else {
    for (const nodeID of nodeIDs) appendToOrderMap(state.undirectedEdgeIDsByNodeID, nodeID, edge.id)
  }
}

const removeEdgeFromIndices = <Schema extends FdGraphSchema>(
  state: GraphState<Schema>,
  edge: FdGraphEdge<Schema>,
): void => {
  const endpoints = endpointList(edge.endpoints)
  const nodeIDs = new Set(endpoints.map(endpointNodeID))
  const endpointKeys = new Set(endpoints.map(endpointKey))
  for (const key of endpointKeys) removeFromOrderMap(state.incidentEdgeIDsByEndpoint, key, edge.id)
  for (const nodeID of nodeIDs) removeFromOrderMap(state.incidentEdgeIDsByNodeID, nodeID, edge.id)
  if (edge.endpoints.kind === 'directed') {
    removeFromOrderMap(
      state.directedOutgoingEdgeIDsByNodeID,
      endpointNodeID(edge.endpoints.source),
      edge.id,
    )
    removeFromOrderMap(
      state.directedIncomingEdgeIDsByNodeID,
      endpointNodeID(edge.endpoints.target),
      edge.id,
    )
  } else {
    for (const nodeID of nodeIDs)
      removeFromOrderMap(state.undirectedEdgeIDsByNodeID, nodeID, edge.id)
  }
}

const appendToOrderMap = <Key, ID>(map: Map<Key, ID[]>, key: Key, id: ID): void => {
  const values = map.get(key)
  if (values === undefined) map.set(key, [id])
  else if (!values.includes(id)) values.push(id)
}

const removeFromOrderMap = <Key, ID>(map: Map<Key, ID[]>, key: Key, id: ID): void => {
  const values = map.get(key)
  if (values === undefined) return
  const index = values.indexOf(id)
  if (index >= 0) values.splice(index, 1)
  if (values.length === 0) map.delete(key)
}

const sortEdgeIndices = <Schema extends FdGraphSchema>(state: GraphState<Schema>): void => {
  const compare = (first: Schema['EdgeID'], second: Schema['EdgeID']) =>
    (state.edgeOrderIndex.get(first) ?? Number.MAX_SAFE_INTEGER) -
    (state.edgeOrderIndex.get(second) ?? Number.MAX_SAFE_INTEGER)
  for (const map of [
    state.directedOutgoingEdgeIDsByNodeID,
    state.directedIncomingEdgeIDsByNodeID,
    state.undirectedEdgeIDsByNodeID,
    state.incidentEdgeIDsByNodeID,
  ]) {
    for (const values of map.values()) values.sort(compare)
  }
  for (const values of state.incidentEdgeIDsByEndpoint.values()) values.sort(compare)
}

const rebuildEdgeOrderIndex = <Schema extends FdGraphSchema>(state: GraphState<Schema>): void => {
  state.edgeOrderIndex = new Map(state.edgeOrder.map((edgeID, index) => [edgeID, index]))
}

const cloneOrderMap = <Key, ID>(map: Map<Key, ID[]>): Map<Key, ID[]> =>
  new Map([...map].map(([key, values]) => [key, [...values]]))

const positionTarget = <ID extends FdGraphElementID>(
  position: FdGraphOrderPosition<ID>,
): ID | undefined =>
  position.kind === 'before' || position.kind === 'after' ? position.id : undefined

const moving = <ID extends FdGraphElementID>(
  id: ID,
  order: readonly ID[],
  position: FdGraphOrderPosition<ID>,
): ID[] => {
  const target = positionTarget(position)
  if (target === id) return [...order]
  const result = order.filter((candidate) => candidate !== id)
  if (position.kind === 'first') return [id, ...result]
  if (position.kind === 'last') return [...result, id]
  const targetIndex = result.indexOf(position.id)
  result.splice(position.kind === 'before' ? targetIndex : targetIndex + 1, 0, id)
  return result
}

const removeValue = <ID extends FdGraphElementID>(values: ID[], id: ID): void => {
  const index = values.indexOf(id)
  if (index >= 0) values.splice(index, 1)
}

const positions = <ID extends FdGraphElementID>(
  requestedIDs: Iterable<ID>,
  order: readonly ID[],
): Map<ID, FdGraphOrderPosition<ID>> => {
  const requested = new Set(requestedIDs)
  const result = new Map<ID, FdGraphOrderPosition<ID>>()
  let previous: ID | undefined
  for (const id of order) {
    if (requested.has(id)) {
      result.set(id, previous === undefined ? { kind: 'first' } : { kind: 'after', id: previous })
    }
    previous = id
  }
  return result
}

const portPositions = <Schema extends FdGraphSchema>(
  requestedKeys: Iterable<FdGraphPortKey<Schema>>,
  state: GraphState<Schema>,
): Map<string, FdGraphOrderPosition<FdGraphPortKey<Schema>>> => {
  const requested = new Map([...requestedKeys].map((key) => [portKey(key), key]))
  const result = new Map<string, FdGraphOrderPosition<FdGraphPortKey<Schema>>>()
  for (const nodeID of state.nodeOrder) {
    let previous: FdGraphPortKey<Schema> | undefined
    for (const portID of state.portOrderByNodeID.get(nodeID) ?? []) {
      const current = new FdGraphPortKey<Schema>(nodeID, portID)
      const key = portKey(current)
      if (requested.has(key)) {
        result.set(
          key,
          previous === undefined ? { kind: 'first' } : { kind: 'after', id: previous },
        )
      }
      previous = current
    }
  }
  return result
}

const portOrderChanges = <Schema extends FdGraphSchema>(
  keys: Iterable<FdGraphPortKey<Schema>>,
  oldPositions: Map<string, FdGraphOrderPosition<FdGraphPortKey<Schema>>>,
  newPositions: Map<string, FdGraphOrderPosition<FdGraphPortKey<Schema>>>,
): FdGraphOrderChange<FdGraphPortKey<Schema>>[] =>
  [...keys].flatMap((key) => {
    const oldPosition = oldPositions.get(portKey(key))
    const newPosition = newPositions.get(portKey(key))
    return portOrderPositionEquals(oldPosition, newPosition)
      ? []
      : [new FdGraphOrderChange(key, oldPosition, newPosition)]
  })

const orderChanges = <ID extends FdGraphElementID>(
  ids: Iterable<ID>,
  oldPositions: Map<ID, FdGraphOrderPosition<ID>>,
  newPositions: Map<ID, FdGraphOrderPosition<ID>>,
): FdGraphOrderChange<ID>[] =>
  [...ids].flatMap((id) => {
    const oldPosition = oldPositions.get(id)
    const newPosition = newPositions.get(id)
    return orderPositionEquals(oldPosition, newPosition)
      ? []
      : [new FdGraphOrderChange(id, oldPosition, newPosition)]
  })

const orderPositionEquals = <ID extends FdGraphElementID>(
  first: FdGraphOrderPosition<ID> | undefined,
  second: FdGraphOrderPosition<ID> | undefined,
): boolean => {
  if (first === undefined || second === undefined) return first === second
  if (first.kind !== second.kind) return false
  if (first.kind === 'first' || first.kind === 'last') return true
  return (second.kind === 'before' || second.kind === 'after') && first.id === second.id
}

const portOrderPositionEquals = <Schema extends FdGraphSchema>(
  first: FdGraphOrderPosition<FdGraphPortKey<Schema>> | undefined,
  second: FdGraphOrderPosition<FdGraphPortKey<Schema>> | undefined,
): boolean => {
  if (first === undefined || second === undefined) return first === second
  if (first.kind !== second.kind) return false
  if (first.kind === 'first' || first.kind === 'last') return true
  return (
    (second.kind === 'before' || second.kind === 'after') &&
    portKey(first.id) === portKey(second.id)
  )
}
