import type { FdCanvasPoint } from '../geometry.js'

export type FdGraphMiniMapNavigationDetail =
  | {
      readonly kind: 'center'
      readonly worldPoint: FdCanvasPoint
      readonly phase: 'continuous' | 'ended'
    }
  | {
      readonly kind: 'zoom'
      readonly zoom: number
      readonly phase: 'continuous' | 'ended'
    }

declare global {
  interface HTMLElementEventMap {
    'fd-graph-minimap-navigation': CustomEvent<FdGraphMiniMapNavigationDetail>
  }
}
