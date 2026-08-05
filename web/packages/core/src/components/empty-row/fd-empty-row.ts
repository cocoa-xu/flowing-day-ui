import { type CSSResultGroup, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { textRole } from '../../internal/typography.js'
import '../icon/fd-icon.js'

/**
 * Mirrors `SettingsEmptyRow`: the empty state for a section, faint and leading-aligned
 * with 14px of vertical padding rather than the 10/11 a populated row takes.
 *
 * @csspart message - The message text.
 */
@customElement('fd-empty-row')
export class FdEmptyRow extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      .empty {
        ${textRole('value')}
        display: flex;
        /* HStack(alignment: .firstTextBaseline) */
        align-items: baseline;
        gap: 8px;
        padding-inline: var(--_fd-metric-row-inset);
        padding-block: 14px;
        color: var(--_fd-palette-faint);
      }
    `,
  ]

  /** The message. Falls back to the element's text content. */
  @property({ reflect: true }) message: string | null = null

  @property({ reflect: true }) symbol: string | null = null

  override render() {
    return html`
      <div class="empty">
        ${this.symbol ? html`<fd-icon name=${this.symbol}></fd-icon>` : nothing}
        <span part="message">${this.message ?? html`<slot></slot>`}</span>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-empty-row': FdEmptyRow
  }
}
