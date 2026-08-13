import type { FdCanvasPoint, FdCanvasRect } from '../../geometry.js'
import type { FdGraphCanvasContent } from '../../graph/content.js'
import type {
  FdAnyGraphSnapshot,
  FdGraphElementID,
  FdGraphPortSide,
  FdGraphSnapshotEndpoint,
  FdGraphSnapshotPort,
} from '../../graph/model.js'
import { graphPortPoint } from '../../graph/model.js'
import type {
  FdGraphPresentationEdge,
  FdGraphPresentationLocalElementID,
  FdGraphPresentationNode,
  FdGraphPresentationPort,
} from '../../graph/presentation.js'
import { FdGraphCanvasTransientGeometry } from '../../interactions/transient-geometry.js'
import type { FdGraphEdgeRoute } from '../../layout/pipeline.js'
import {
  defaultGraphEdgeGeometryResolver,
  type FdGraphEdgeGeometryResolver,
  graphEdgeArrowGeometry,
} from '../../rendering/edge-geometry.js'

export interface FdGraphCanvasEngineNodeData<
  ElementID extends FdGraphElementID = FdGraphElementID,
> {
  readonly localID: FdGraphPresentationLocalElementID
  readonly presentation: FdGraphPresentationNode<ElementID>
}

export interface FdGraphCanvasEngineEdgeData<
  ElementID extends FdGraphElementID = FdGraphElementID,
> {
  readonly localID: FdGraphPresentationLocalElementID
  readonly presentation: FdGraphPresentationEdge<ElementID>
  readonly route: FdGraphEdgeRoute
  readonly sourcePosition: FdCanvasPoint
  readonly targetPosition: FdCanvasPoint
  readonly isDirected: boolean
}

export interface FdGraphCanvasEnginePortData<
  ElementID extends FdGraphElementID = FdGraphElementID,
> {
  readonly localID: FdGraphPresentationLocalElementID
  readonly presentation: FdGraphPresentationPort<ElementID>
}

export interface FdGraphCanvasEnginePort<ElementID extends FdGraphElementID = FdGraphElementID>
  extends FdGraphSnapshotPort<ElementID> {
  readonly data: FdGraphCanvasEnginePortData<ElementID>
}

export const graphCanvasEngineSnapshot = <ElementID extends FdGraphElementID>(
  content: FdGraphCanvasContent<ElementID>,
): FdAnyGraphSnapshot => ({
  id: content.presentation.snapshotID,
  nodes: content.presentation.nodes.flatMap((node) => {
    const frame = content.frame(node.localID)
    if (!frame) return []
    return [
      {
        id: node.id,
        frame,
        ports: content.portLocalIDs(node.localID).flatMap((portLocalID) => {
          const port = content.port(portLocalID)
          const anchor = content.anchor(portLocalID)
          if (!port || !anchor) return []
          return [enginePort(port, portLocalID, anchor.position, anchor.normal, frame)]
        }),
        data: {
          localID: node.localID,
          presentation: node,
        } satisfies FdGraphCanvasEngineNodeData<ElementID>,
      },
    ]
  }),
  edges: content.presentation.edges.flatMap((edge) => {
    const route = content.route(edge.localID)
    if (!route) return []
    const endpoints =
      edge.endpoints.kind === 'directed'
        ? { first: edge.endpoints.source, second: edge.endpoints.target }
        : { first: edge.endpoints.first, second: edge.endpoints.second }
    const source = engineEndpoint(content, endpoints.first)
    const target = engineEndpoint(content, endpoints.second)
    const sourcePosition = engineEndpointPosition(content, endpoints.first)
    const targetPosition = engineEndpointPosition(content, endpoints.second)
    if (!source || !target || !sourcePosition || !targetPosition) return []
    return [
      {
        id: edge.id,
        source,
        target,
        data: {
          localID: edge.localID,
          presentation: edge,
          route,
          sourcePosition,
          targetPosition,
          isDirected: edge.endpoints.kind === 'directed',
        } satisfies FdGraphCanvasEngineEdgeData<ElementID>,
      },
    ]
  }),
})

export const graphCanvasEngineEdgeGeometryResolver: FdGraphEdgeGeometryResolver = (input) => {
  const data = input.edge.data as FdGraphCanvasEngineEdgeData | undefined
  if (!data?.route) return defaultGraphEdgeGeometryResolver(input)
  const route = FdGraphCanvasTransientGeometry.deforming(
    data.route,
    {
      width: input.source.x - data.sourcePosition.x,
      height: input.source.y - data.sourcePosition.y,
    },
    {
      width: input.target.x - data.targetPosition.x,
      height: input.target.y - data.targetPosition.y,
    },
  )
  const targetArrow = data.isDirected ? graphEdgeArrowGeometry(route, 6, 6) : undefined
  return { route, ...(targetArrow ? { targetArrow } : {}) }
}

const enginePort = <ElementID extends FdGraphElementID>(
  port: FdGraphPresentationPort<ElementID>,
  localID: FdGraphPresentationLocalElementID,
  position: FdCanvasPoint,
  normal: { readonly dx: number; readonly dy: number },
  frame: FdCanvasRect,
): FdGraphCanvasEnginePort<ElementID> => {
  const side = portSide(position, normal, frame)
  const length = side === 'top' || side === 'bottom' ? frame.width : frame.height
  const origin = side === 'top' || side === 'bottom' ? frame.x : frame.y
  return {
    id: port.id,
    side,
    offset: length === 0 ? 0.5 : clamp((axisPosition(position, side) - origin) / length),
    data: { localID, presentation: port } satisfies FdGraphCanvasEnginePortData<ElementID>,
  }
}

const engineEndpoint = <ElementID extends FdGraphElementID>(
  content: FdGraphCanvasContent<ElementID>,
  endpoint: { readonly kind: 'node' | 'port'; readonly id: ElementID },
): FdGraphSnapshotEndpoint | undefined => {
  if (endpoint.kind === 'node') return { nodeID: endpoint.id }
  const localID = content.localID(endpoint.id)
  const nodeLocalID = localID ? content.nodeLocalID(localID) : undefined
  const nodeID = nodeLocalID ? content.elementID(nodeLocalID) : undefined
  return nodeID === undefined ? undefined : { nodeID, portID: endpoint.id }
}

const engineEndpointPosition = <ElementID extends FdGraphElementID>(
  content: FdGraphCanvasContent<ElementID>,
  endpoint: { readonly kind: 'node' | 'port'; readonly id: ElementID },
): FdCanvasPoint | undefined => {
  const localID = content.localID(endpoint.id)
  if (!localID) return undefined
  if (endpoint.kind === 'port') {
    const nodeLocalID = content.nodeLocalID(localID)
    const port = content.port(localID)
    const anchor = content.anchor(localID)
    const frame = nodeLocalID ? content.frame(nodeLocalID) : undefined
    if (!port || !anchor || !frame) return undefined
    const renderedPort = enginePort(port, localID, anchor.position, anchor.normal, frame)
    return graphPortPoint({ id: endpoint.id, frame, ports: [renderedPort] }, endpoint.id)
  }
  const frame = content.frame(localID)
  return frame ? { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 } : undefined
}

const portSide = (
  position: FdCanvasPoint,
  normal: { readonly dx: number; readonly dy: number },
  frame: FdCanvasRect,
): FdGraphPortSide => {
  if (normal.dx !== 0 || normal.dy !== 0) {
    if (Math.abs(normal.dx) >= Math.abs(normal.dy)) return normal.dx >= 0 ? 'right' : 'left'
    return normal.dy >= 0 ? 'bottom' : 'top'
  }
  const distances: readonly [FdGraphPortSide, number][] = [
    ['top', Math.abs(position.y - frame.y)],
    ['right', Math.abs(position.x - (frame.x + frame.width))],
    ['bottom', Math.abs(position.y - (frame.y + frame.height))],
    ['left', Math.abs(position.x - frame.x)],
  ]
  return distances.reduce((closest, candidate) =>
    candidate[1] < closest[1] ? candidate : closest,
  )[0]
}

const axisPosition = (position: FdCanvasPoint, side: FdGraphPortSide): number =>
  side === 'top' || side === 'bottom' ? position.x : position.y

const clamp = (value: number): number => Math.min(Math.max(value, 0), 1)
