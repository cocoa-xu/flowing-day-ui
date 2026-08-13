import type { FdCanvasPoint, FdCanvasRect } from '../geometry.js'
import type {
  FdAnyGraphEdge,
  FdAnyGraphNode,
  FdGraphElementID,
  FdGraphElementReference,
} from '../graph/model.js'
import type { FdGraphRenderEdge, FdGraphRenderNode } from './backend.js'
import type { FdGraphEdgeGeometryResolver } from './edge-geometry.js'
import { defaultGraphEdgeGeometryResolver } from './edge-geometry.js'

export interface FdGraphRenderGeometryInput {
  readonly snapshotRevision: number
  readonly geometryRevision: number
  readonly nodes: readonly FdAnyGraphNode[]
  readonly edges: readonly FdAnyGraphEdge[]
  readonly selectedNodeIDs: ReadonlySet<FdGraphElementID>
  readonly selectedEdgeIDs: ReadonlySet<FdGraphElementID>
  readonly hoveredNodeID?: FdGraphElementID
  readonly focusedElement?: FdGraphElementReference
  readonly nodeFrame: (node: FdAnyGraphNode) => FdCanvasRect
  readonly edgeEndpoint: (edge: FdAnyGraphEdge, endpoint: 'source' | 'target') => FdCanvasPoint
  readonly edgeGeometry?: FdGraphEdgeGeometryResolver
}

export interface FdGraphRenderGeometry {
  readonly nodes: readonly FdGraphRenderNode[]
  readonly edges: readonly FdGraphRenderEdge[]
}

export class FdGraphRenderGeometryCache {
  private snapshotRevision = -1
  private geometryRevision = -1
  private geometry: FdGraphRenderGeometry = { nodes: [], edges: [] }

  resolve(input: FdGraphRenderGeometryInput): FdGraphRenderGeometry {
    if (
      input.snapshotRevision === this.snapshotRevision &&
      input.geometryRevision === this.geometryRevision
    ) {
      return this.geometry
    }
    this.snapshotRevision = input.snapshotRevision
    this.geometryRevision = input.geometryRevision
    this.geometry = {
      nodes: input.nodes.map((node) => ({
        node,
        frame: input.nodeFrame(node),
        selected: input.selectedNodeIDs.has(node.id),
        focused: input.focusedElement?.kind === 'node' && input.focusedElement.nodeID === node.id,
        hovered: input.hoveredNodeID === node.id,
      })),
      edges: input.edges.map((edge) => {
        const source = input.edgeEndpoint(edge, 'source')
        const target = input.edgeEndpoint(edge, 'target')
        return {
          edge,
          source,
          target,
          geometry: (input.edgeGeometry ?? defaultGraphEdgeGeometryResolver)({
            edge,
            source,
            target,
          }),
          selected: input.selectedEdgeIDs.has(edge.id),
          focused: input.focusedElement?.kind === 'edge' && input.focusedElement.edgeID === edge.id,
          hovered: false,
        }
      }),
    }
    return this.geometry
  }

  invalidate(): void {
    this.snapshotRevision = -1
    this.geometryRevision = -1
    this.geometry = { nodes: [], edges: [] }
  }
}
