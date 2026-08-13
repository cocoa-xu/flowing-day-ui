import {
  FdGraphEdge,
  FdGraphEdgeEndpoints,
  FdGraphEndpoint,
  FdGraphNode,
  FdGraphPort,
  FdGraphPortKey,
  type FdGraphSchema,
} from '../graph/core.js'
import type { FdGraphElementID } from '../graph/model.js'
import { FdGraph } from '../graph/storage.js'
import type { FdGraphLayoutEndpoint, FdGraphLayoutTopology } from './model.js'

export interface FdLayoutCoreSchema<
  NodeID extends FdGraphElementID,
  PortID extends FdGraphElementID,
  EdgeID extends FdGraphElementID,
> extends FdGraphSchema {
  readonly NodeID: NodeID
  readonly NodeValue: undefined
  readonly PortID: PortID
  readonly PortValue: undefined
  readonly EdgeID: EdgeID
  readonly EdgeValue: undefined
}

export const materializedGraph = <
  NodeID extends FdGraphElementID,
  PortID extends FdGraphElementID,
  EdgeID extends FdGraphElementID,
>(
  topology: FdGraphLayoutTopology<NodeID, PortID, EdgeID>,
): FdGraph<FdLayoutCoreSchema<NodeID, PortID, EdgeID>> => {
  type Schema = FdLayoutCoreSchema<NodeID, PortID, EdgeID>
  const graph = new FdGraph<Schema>()
  const result = graph.update((transaction) => {
    for (const nodeID of topology.nodeIDs) {
      transaction.insert(new FdGraphNode<Schema>(nodeID, undefined))
    }
    for (const port of topology.ports) {
      transaction.insert(
        new FdGraphPort<Schema>(new FdGraphPortKey<Schema>(port.nodeID, port.id), undefined),
      )
    }
    for (const edge of topology.edges) {
      const endpoints =
        edge.endpoints.kind === 'directed'
          ? FdGraphEdgeEndpoints.directed(
              coreEndpoint<Schema>(edge.endpoints.source),
              coreEndpoint<Schema>(edge.endpoints.target),
            )
          : FdGraphEdgeEndpoints.undirected(
              coreEndpoint<Schema>(edge.endpoints.first),
              coreEndpoint<Schema>(edge.endpoints.second),
            )
      transaction.insert(new FdGraphEdge<Schema>(edge.id, endpoints, undefined))
    }
  })
  if (result.kind !== 'committed') {
    throw new Error('Validated layout topology failed graph materialization')
  }
  return graph
}

const coreEndpoint = <Schema extends FdGraphSchema>(
  endpoint: FdGraphLayoutEndpoint<Schema['NodeID'], Schema['PortID']>,
) =>
  endpoint.kind === 'node'
    ? FdGraphEndpoint.node<Schema>(endpoint.nodeID)
    : FdGraphEndpoint.port<Schema>(new FdGraphPortKey(endpoint.key.nodeID, endpoint.key.portID))
