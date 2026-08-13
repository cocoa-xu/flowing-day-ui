import type { FdCanvasPoint, FdCanvasRect, FdCanvasViewport } from '../geometry.js'
import type { FdGraphCanvasNodeCapabilities } from '../graph/interaction-policy.js'
import type {
  FdAnyGraphEdge,
  FdAnyGraphNode,
  FdGraphElementID,
  FdGraphElementReference,
} from '../graph/model.js'
import type { FdGraphCubicEdgeGeometry } from './edge-geometry.js'

export type FdGraphRenderingBackendPreference = 'automatic' | 'webgl2' | 'dom'
export type FdGraphRenderingBackendKind = 'webgl2' | 'dom' | (string & {})

export interface FdGraphRenderingCapabilities {
  readonly webgl2: boolean
}

export interface FdGraphRenderNode {
  readonly node: FdAnyGraphNode
  readonly frame: FdCanvasRect
  readonly selected: boolean
  readonly focused: boolean
  readonly hovered: boolean
  readonly capabilities?: Required<FdGraphCanvasNodeCapabilities>
}

export interface FdGraphRenderEdge {
  readonly edge: FdAnyGraphEdge
  readonly source: FdCanvasPoint
  readonly target: FdCanvasPoint
  readonly geometry: FdGraphCubicEdgeGeometry
  readonly selected: boolean
  readonly focused: boolean
  readonly hovered: boolean
}

export interface FdGraphRenderFrame {
  readonly snapshotID: string | number
  readonly snapshotRevision: number
  readonly presentationRevision: number
  readonly viewport: FdCanvasViewport
  readonly renderWorldRect: FdCanvasRect
  readonly nodes: readonly FdGraphRenderNode[]
  readonly edges: readonly FdGraphRenderEdge[]
  readonly selectedElements: readonly FdGraphElementReference[]
  readonly selectedNodeIDs: ReadonlySet<FdGraphElementID>
  readonly selectedEdgeIDs: ReadonlySet<FdGraphElementID>
  readonly selectedPortIDsByNode: ReadonlyMap<FdGraphElementID, ReadonlySet<FdGraphElementID>>
  readonly focusedElement?: FdGraphElementReference
  readonly focusedNodeID?: FdGraphElementID
  readonly hoveredNodeID?: FdGraphElementID
  readonly pixelRatio: number
}

export interface FdGraphRenderingSurface {
  readonly viewport: HTMLElement
  readonly world: HTMLElement
}

export interface FdGraphRenderingBackend {
  readonly kind: FdGraphRenderingBackendKind
  mount(surface: FdGraphRenderingSurface): void
  render(frame: FdGraphRenderFrame): void
  unmount(): void
}

export function detectGraphRenderingCapabilities(): FdGraphRenderingCapabilities {
  return { webgl2: typeof WebGL2RenderingContext !== 'undefined' }
}

let cachedGraphRenderingCapabilities: FdGraphRenderingCapabilities | undefined

export function graphRenderingCapabilities(): FdGraphRenderingCapabilities {
  cachedGraphRenderingCapabilities ??= detectGraphRenderingCapabilities()
  return cachedGraphRenderingCapabilities
}

export function resolveGraphRenderingBackendKind(
  preference: FdGraphRenderingBackendPreference,
  capabilities: FdGraphRenderingCapabilities,
): 'webgl2' | 'dom' {
  switch (preference) {
    case 'automatic':
    case 'webgl2':
      return capabilities.webgl2 ? 'webgl2' : 'dom'
    case 'dom':
      return 'dom'
  }
}
