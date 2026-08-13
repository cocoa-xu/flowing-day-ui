import type { FdGraphNavigationDirection } from '../interactions/keyboard.js'
import type { FdGraphCanvasElementAction } from './configuration.js'
import type { FdGraphAccessibilityElementReference } from './snapshot.js'

export type FdGraphCanvasAccessibilityRequest =
  | { readonly kind: 'focus'; readonly element: FdGraphAccessibilityElementReference }
  | { readonly kind: 'select'; readonly element: FdGraphAccessibilityElementReference }
  | {
      readonly kind: 'perform'
      readonly element: FdGraphAccessibilityElementReference
      readonly action: FdGraphCanvasElementAction
    }
  | {
      readonly kind: 'move'
      readonly element: FdGraphAccessibilityElementReference
      readonly direction: FdGraphNavigationDirection
      readonly largeStep: boolean
    }

export type FdGraphCanvasAccessibilityRequestDetail = FdGraphCanvasAccessibilityRequest

declare global {
  interface HTMLElementEventMap {
    'fd-graph-canvas-accessibility-request': CustomEvent<FdGraphCanvasAccessibilityRequestDetail>
  }
}
