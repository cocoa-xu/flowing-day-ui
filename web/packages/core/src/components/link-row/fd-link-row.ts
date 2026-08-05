import { type CSSResultGroup, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { arrowUpRight } from '../../internal/glyphs.js'
import { softButtonStyles } from '../../internal/soft-button.js'
import '../row/fd-row.js'

/**
 * Mirrors `SettingsLinkRow`: `SettingsButtonRow` chrome on a `Link`, with an
 * `arrow.up.right` glyph 5px after the label and `.help(_:)` as a tooltip.
 *
 * `help` rather than `title`, because `title` on the host is the global HTML attribute
 * and would raise a second tooltip over the whole row.
 *
 * @csspart button - The trailing link.
 */
@customElement('fd-link-row')
export class FdLinkRow extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    softButtonStyles,
    css`
      .soft-button {
        gap: 5px;
      }

      /* Image(systemName:).font(.system(size: 9, weight: .semibold)) */
      .arrow {
        width: 9px;
        height: 9px;
        flex: none;
        stroke-width: 2.2;
      }
    `,
  ]

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) caption: string | null = null

  /** Text on the trailing link — `SettingsLinkRow.buttonTitle`. */
  @property({ reflect: true, attribute: 'button-label' }) buttonLabel = ''

  /** `SettingsLinkRow.destination`. */
  @property({ reflect: true }) href = ''

  /** `.help(_:)`. Also the link's accessible name, which the arrow alone would not give. */
  @property({ reflect: true }) help = ''

  /** Where the link opens. Defaults to a new tab, as opening a URL from Settings does. */
  @property({ reflect: true }) target = '_blank'

  override render() {
    return html`
      <fd-row symbol=${this.symbol ?? ''} label=${this.label} caption=${this.caption ?? ''}>
        <a
          class="soft-button"
          part="button"
          slot="trailing"
          href=${this.href}
          target=${this.target}
          rel="noreferrer"
          title=${this.help}
          aria-label=${this.help || this.buttonLabel}
        >
          ${this.buttonLabel}
          <span class="arrow">${arrowUpRight}</span>
        </a>
      </fd-row>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-link-row': FdLinkRow
  }
}
