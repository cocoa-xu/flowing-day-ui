import type { FdGraphNavigationDirection } from '../interactions/keyboard.js'
import type { FdGraphCanvasElementAction } from './configuration.js'
import type { FdGraphCanvasAccessibilityElementReference } from './snapshot.js'

export type FdGraphCanvasAccessibilityRequest =
  | { readonly kind: 'focus'; readonly element: FdGraphCanvasAccessibilityElementReference }
  | { readonly kind: 'select'; readonly element: FdGraphCanvasAccessibilityElementReference }
  | {
      readonly kind: 'perform'
      readonly element: FdGraphCanvasAccessibilityElementReference
      readonly action: FdGraphCanvasElementAction
    }
  | {
      readonly kind: 'move'
      readonly element: FdGraphCanvasAccessibilityElementReference
      readonly direction: FdGraphNavigationDirection
      readonly largeStep: boolean
    }

export type FdGraphCanvasAccessibilityRequestDetail = FdGraphCanvasAccessibilityRequest

declare global {
  interface HTMLElementEventMap {
    'fd-graph-canvas-accessibility-request': CustomEvent<FdGraphCanvasAccessibilityRequestDetail>
  }
}
