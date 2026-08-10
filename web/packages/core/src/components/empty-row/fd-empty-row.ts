import { type CSSResultGroup, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import '../empty-state/fd-empty-state.js'

/**
 * Mirrors `PreferencesEmptyRow`: the empty state for a section, faint and leading-aligned
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
        padding-inline: var(--_fd-metric-row-inset);
        padding-block: 14px;
      }
    `,
  ]

  /** The message. Falls back to the element's text content. */
  @property({ reflect: true }) message: string | null = null

  @property({ reflect: true }) symbol: string | null = null

  override render() {
    return html`
      <fd-empty-state
        class="empty"
        exportparts="icon, message"
        layout="inline"
        .message=${this.message ?? this.textContent?.trim() ?? ''}
        .symbol=${this.symbol}
      ></fd-empty-state>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-empty-row': FdEmptyRow
  }
}
