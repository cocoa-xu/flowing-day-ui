import type { FdGraphNavigationDirection } from '../interactions/keyboard.js'
import type { FdGraphAccessibilityElementReference } from './snapshot.js'

export type FdGraphAccessibilityAction =
  | { readonly kind: 'focus' }
  | { readonly kind: 'select' }
  | { readonly kind: 'activate' }
  | {
      readonly kind: 'move'
      readonly direction: FdGraphNavigationDirection
      readonly large: boolean
    }

export interface FdGraphAccessibilityActionDetail {
  readonly element: FdGraphAccessibilityElementReference
  readonly action: FdGraphAccessibilityAction
}

declare global {
  interface HTMLElementEventMap {
    'fd-graph-accessibility-action': CustomEvent<FdGraphAccessibilityActionDetail>
  }
}
