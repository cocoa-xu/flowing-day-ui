import type { FdCanvasPoint, FdCanvasRect } from '../geometry.js'

export type FdGraphElementID = string | number

export type FdGraphPortSide = 'top' | 'right' | 'bottom' | 'left'

export interface FdGraphPort<PortID extends FdGraphElementID = FdGraphElementID> {
  readonly id: PortID
  readonly side: FdGraphPortSide
  readonly offset?: number
  readonly label?: string
}

export interface FdGraphNodeCapabilities {
  readonly selectable?: boolean
  readonly draggable?: boolean
  readonly resizable?: boolean
  readonly keyboardNavigable?: boolean
  readonly arrangementParticipant?: boolean
}

export interface FdGraphNodeStyle {
  readonly fill?: string
  readonly stroke?: string
  readonly color?: string
  readonly accent?: string
}

export interface FdGraphNode<
  NodeID extends FdGraphElementID = FdGraphElementID,
  NodeData = unknown,
> {
  readonly id: NodeID
  readonly frame: FdCanvasRect
  readonly label?: string
  readonly subtitle?: string
  readonly accessibilityLabel?: string
  readonly ports?: readonly FdGraphPort[]
  readonly capabilities?: FdGraphNodeCapabilities
  readonly style?: FdGraphNodeStyle
  readonly data?: NodeData
}

export interface FdGraphEndpoint<NodeID extends FdGraphElementID = FdGraphElementID> {
  readonly nodeID: NodeID
  readonly portID?: FdGraphElementID
}

export interface FdGraphEdgeStyle {
  readonly color?: string
  readonly width?: number
  readonly dashed?: boolean
}

export interface FdGraphEdge<
  NodeID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
  EdgeData = unknown,
> {
  readonly id: EdgeID
  readonly source: FdGraphEndpoint<NodeID>
  readonly target: FdGraphEndpoint<NodeID>
  readonly label?: string
  readonly accessibilityLabel?: string
  readonly style?: FdGraphEdgeStyle
  readonly data?: EdgeData
}

export interface FdGraphSnapshot<
  NodeID extends FdGraphElementID = FdGraphElementID,
  EdgeID extends FdGraphElementID = FdGraphElementID,
  NodeData = unknown,
  EdgeData = unknown,
> {
  readonly id: string | number
  readonly nodes: readonly FdGraphNode<NodeID, NodeData>[]
  readonly edges: readonly FdGraphEdge<NodeID, EdgeID, EdgeData>[]
}

export type FdAnyGraphNode = FdGraphNode<FdGraphElementID, unknown>
export type FdAnyGraphEdge = FdGraphEdge<FdGraphElementID, FdGraphElementID, unknown>
export type FdAnyGraphSnapshot = FdGraphSnapshot<
  FdGraphElementID,
  FdGraphElementID,
  unknown,
  unknown
>

export type FdGraphSnapshotIssue =
  | { readonly kind: 'duplicateNodeID'; readonly nodeID: FdGraphElementID }
  | { readonly kind: 'duplicateEdgeID'; readonly edgeID: FdGraphElementID }
  | { readonly kind: 'invalidNodeFrame'; readonly nodeID: FdGraphElementID }
  | {
      readonly kind: 'duplicatePortID'
      readonly nodeID: FdGraphElementID
      readonly portID: FdGraphElementID
    }
  | {
      readonly kind: 'invalidPortOffset'
      readonly nodeID: FdGraphElementID
      readonly portID: FdGraphElementID
    }
  | {
      readonly kind: 'missingEndpointNode'
      readonly edgeID: FdGraphElementID
      readonly nodeID: FdGraphElementID
    }
  | {
      readonly kind: 'missingEndpointPort'
      readonly edgeID: FdGraphElementID
      readonly nodeID: FdGraphElementID
      readonly portID: FdGraphElementID
    }

export class FdGraphSnapshotValidationError extends Error {
  readonly issues: readonly FdGraphSnapshotIssue[]

  constructor(issues: readonly FdGraphSnapshotIssue[]) {
    super(
      `Graph snapshot contains ${issues.length} validation issue${issues.length === 1 ? '' : 's'}`,
    )
    this.name = 'FdGraphSnapshotValidationError'
    this.issues = issues
  }
}

export const graphElementKey = (id: FdGraphElementID): string =>
  `${typeof id === 'number' ? 'n' : 's'}:${id}`

export function graphElementIDFromKey(key: string): FdGraphElementID | undefined {
  const prefix = key.slice(0, 2)
  const value = key.slice(2)
  if (prefix === 's:') return value
  if (prefix !== 'n:' || value.length === 0) return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

export function graphPortPoint(node: FdAnyGraphNode, portID?: FdGraphElementID): FdCanvasPoint {
  const port = portID === undefined ? undefined : node.ports?.find(({ id }) => id === portID)
  const offset = port?.offset ?? 0.5
  switch (port?.side) {
    case 'top':
      return { x: node.frame.x + node.frame.width * offset, y: node.frame.y }
    case 'bottom':
      return {
        x: node.frame.x + node.frame.width * offset,
        y: node.frame.y + node.frame.height,
      }
    case 'left':
      return { x: node.frame.x, y: node.frame.y + node.frame.height * offset }
    case 'right':
      return {
        x: node.frame.x + node.frame.width,
        y: node.frame.y + node.frame.height * offset,
      }
    default:
      return {
        x: node.frame.x + node.frame.width / 2,
        y: node.frame.y + node.frame.height / 2,
      }
  }
}
