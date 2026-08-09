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
      -webkit-user-select: var(--fd-user-select, none);
      user-select: var(--fd-user-select, none);
    }

    :host([hidden]) {
      display: none !important;
    }

    *,
    *::before,
    *::after {
      box-sizing: inherit;
    }

    /*
     * Every SVG here is a glyph, never run-in text. Left inline it would sit on the
     * text baseline of its own line box and drop out the bottom of a box sized to the
     * glyph — several pixels low, on a mark only nine tall.
     */
    svg {
      display: block;
    }

    input,
    textarea,
    [contenteditable='true'] {
      -webkit-user-select: text;
      user-select: text;
    }
  `,
]

export class FdElement extends LitElement {
  static override styles: CSSResultGroup = baseStyles
}
