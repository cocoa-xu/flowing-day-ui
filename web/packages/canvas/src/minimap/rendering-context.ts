import type { FdCanvasRect, FdCanvasViewport } from '../geometry.js'
import type { FdResolvedGraphMiniMapConfiguration } from './configuration.js'
import type { FdAnyGraphMiniMapSnapshot } from './model.js'
import type { FdGraphMiniMapTransform } from './transform.js'

export interface FdGraphMiniMapRenderingContext {
  readonly snapshot: FdAnyGraphMiniMapSnapshot
  readonly transform: FdGraphMiniMapTransform
  readonly viewport: FdCanvasViewport
  readonly viewportFrame: FdCanvasRect
  readonly configuration: FdResolvedGraphMiniMapConfiguration
}
