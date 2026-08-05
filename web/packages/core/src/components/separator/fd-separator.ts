import { type CSSResultGroup, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'

/**
 * Mirrors `PreferencesRowSeparator`: a 1px hairline inset by `rowInset`, plus a further
 * 34px when indented so it aligns past the leading symbol gutter.
 */
@customElement('fd-separator')
export class FdSeparator extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        padding-inline-start: var(--_fd-metric-row-inset);
      }

      :host([indented]) {
        padding-inline-start: calc(var(--_fd-metric-row-inset) + 34px);
      }

      .rule {
        height: 1px;
        background: var(--_fd-palette-hairline);
      }
    `,
  ]

  /** Aligns the rule with row text rather than the row edge. */
  @property({ type: Boolean, reflect: true }) indented = false

  override render() {
    return html`<div class="rule" role="separator"></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-separator': FdSeparator
  }
}
