import { type CSSResultGroup, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { textRole } from '../../internal/typography.js'
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
    css`
      .row {
        display: flex;
        align-items: center;
        gap: 14px;
        min-height: 42px;
        padding-inline: var(--_fd-metric-row-inset);
        padding-block: 10px;
      }

      :host([caption]) .row {
        padding-block: 11px;
      }

      .symbol {
        width: 20px;
        flex: none;
        display: flex;
        justify-content: center;
        font-size: 13px;
        font-weight: 500;
        color: var(--_fd-palette-muted);
      }

      .text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .label {
        ${textRole('row-title')}
        color: var(--_fd-palette-ink);
      }

      .caption {
        ${textRole('row-caption')}
        color: var(--_fd-palette-faint);
      }

      /* Spacer(minLength: 10); the stack's 14px spacing sits on either side of it. */
      .spacer {
        flex: 1 1 auto;
        min-width: 10px;
      }

      .trailing {
        flex: none;
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
      <div class="row" part="row">
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
