import { type CSSResultGroup, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'

export type FdRowSeparatorLeadingEdge = 'content' | 'iconText'

/**
 * Mirrors `PreferencesRowSeparator`: a 1px hairline aligned with either the section's
 * content edge or the text following its leading symbol gutter.
 */
@customElement('fd-separator')
export class FdRowSeparator extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        --_leading-inset: var(--_fd-section-separator-leading-inset, 0px);
        padding-inline-start: calc(var(--_fd-metric-row-inset) + var(--_leading-inset));
      }

      :host([leading-edge='content']) {
        --_leading-inset: 0px;
      }

      :host([leading-edge='iconText']) {
        --_leading-inset: 34px;
      }

      .rule {
        height: 1px;
        background: var(--_fd-palette-hairline);
      }
    `,
  ]

  /** Overrides the containing section's separator alignment. */
  @property({ attribute: 'leading-edge', reflect: true })
  leadingEdge: FdRowSeparatorLeadingEdge | null = null

  override render() {
    return html`<div class="rule" role="separator"></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-separator': FdRowSeparator
  }
}
