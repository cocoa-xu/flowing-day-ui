import { type CSSResultGroup, css, LitElement } from 'lit'
import { themeStyles } from '../tokens/theme.js'

/**
 * Adopted by every component, so tokens resolve without the consumer importing
 * a stylesheet. Subclasses extend it: `static styles = [baseStyles, css\`…\`]`.
 */
export const baseStyles: CSSResultGroup = [
  themeStyles,
  css`
    :host {
      display: block;
      box-sizing: border-box;
      font-family: var(--_fd-font-standard);
      -webkit-font-smoothing: antialiased;
    }

    :host([hidden]) {
      display: none !important;
    }

    *,
    *::before,
    *::after {
      box-sizing: inherit;
    }
  `,
]

export class FdElement extends LitElement {
  static override styles: CSSResultGroup = baseStyles
}
