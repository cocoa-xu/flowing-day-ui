import { type CSSResultGroup, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { rowLayoutStyles } from '../../internal/row-layout.js'
import '../icon/fd-icon.js'

/**
 * Mirrors `SettingsRow`: optional symbol gutter, title/caption block, flexible gap,
 * trailing control. Vertical padding is 10px, or 11px once a caption is present.
 *
 * `label` rather than `title`, because `title` is a global HTML attribute and would
 * raise a native tooltip on the host element.
 *
 * @slot trailing - The control shown at the trailing edge.
 * @csspart row - The row container.
 * @csspart label - The title text.
 * @csspart caption - The caption text.
 */
@customElement('fd-row')
export class FdRow extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    rowLayoutStyles,
    css`
      /*
       * Rigid, because the controls that trail a row carry a .frame(width:) that never
       * gives way. A trailing view that is text rather than a control opts into
       * compressing by setting --_fd-row-trailing-flex, as fd-value-row does.
       */
      .trailing {
        flex: var(--_fd-row-trailing-flex, none);
        min-width: 0;
        display: flex;
        align-items: center;
      }
    `,
  ]

  /** Icon registry key for the leading gutter. */
  @property({ reflect: true }) symbol: string | null = null

  /** Primary row text. */
  @property({ reflect: true }) label = ''

  /** Secondary text below the title. */
  @property({ reflect: true }) caption: string | null = null

  override render() {
    return html`
      <div class="row" part="row" ?data-caption=${!!this.caption}>
        ${this.symbol ? html`<fd-icon class="symbol" name=${this.symbol}></fd-icon>` : nothing}
        <div class="text">
          <span class="label" part="label">${this.label}</span>
          ${this.caption ? html`<span class="caption" part="caption">${this.caption}</span>` : nothing}
        </div>
        <div class="spacer"></div>
        <div class="trailing"><slot name="trailing"></slot></div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-row': FdRow
  }
}
