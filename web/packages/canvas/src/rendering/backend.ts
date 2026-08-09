import type { FdCanvasPoint, FdCanvasRect, FdCanvasViewport } from '../geometry.js'
import type { FdAnyGraphEdge, FdAnyGraphNode, FdGraphElementID } from '../graph/model.js'

export type FdGraphRenderingBackendPreference = 'automatic' | 'dom'
export type FdGraphRenderingBackendKind = 'dom' | (string & {})

export interface FdGraphRenderNode {
  readonly node: FdAnyGraphNode
  readonly frame: FdCanvasRect
  readonly selected: boolean
  readonly focused: boolean
  readonly hovered: boolean
}

export interface FdGraphRenderEdge {
  readonly edge: FdAnyGraphEdge
  readonly source: FdCanvasPoint
  readonly target: FdCanvasPoint
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
  readonly selectedNodeIDs: ReadonlySet<FdGraphElementID>
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
