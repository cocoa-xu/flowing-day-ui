import { type CSSResultGroup, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { textRole } from '../../internal/typography.js'
import '../card/fd-card.js'

/**
 * Mirrors `PreferencesSection`: uppercase header, card, and an optional footer whose
 * horizontal inset matches the row text above it.
 *
 * @slot - Rows placed inside the card.
 * @csspart header - The uppercase section title.
 * @csspart card - The `fd-card` wrapping the rows.
 * @csspart footer - The caption below the card.
 */
@customElement('fd-section')
export class FdSection extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        align-self: stretch;
        width: 100%;
      }

      .header {
        ${textRole('section-header')}
        text-transform: uppercase;
        letter-spacing: 0.7px;
        color: var(--_fd-palette-faint);
        padding-inline-start: 4px;
        padding-bottom: 7px;
      }

      .footer {
        ${textRole('row-caption')}
        color: var(--_fd-palette-faint);
        padding-inline: var(--_fd-metric-row-inset);
        padding-top: 7px;
      }
    `,
  ]

  /** Section title. Rendered uppercase; omit to render the card alone. */
  @property({ reflect: true }) label: string | null = null

  /** Caption below the card. */
  @property({ reflect: true }) footer: string | null = null

  override render() {
    return html`
      ${this.label ? html`<div class="header" part="header">${this.label}</div>` : nothing}
      <fd-card part="card"><slot></slot></fd-card>
      ${this.footer ? html`<div class="footer" part="footer">${this.footer}</div>` : nothing}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-section': FdSection
  }
}
