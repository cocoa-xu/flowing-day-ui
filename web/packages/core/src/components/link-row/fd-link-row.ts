import { type CSSResultGroup, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { softButtonStyles } from '../../internal/soft-button.js'
import '../row/fd-row.js'

/**
 * Mirrors `PreferencesLinkRow`: `PreferencesButtonRow` chrome on a `Link`, with `.help(_:)`
 * as a tooltip.
 *
 * `help` rather than `title`, because `title` on the host is the global HTML attribute
 * and would raise a second tooltip over the whole row.
 *
 * @csspart button - The trailing link.
 */
@customElement('fd-link-row')
export class FdLinkRow extends FdElement {
  static override styles: CSSResultGroup = [baseStyles, softButtonStyles]

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) caption: string | null = null

  /** Text on the trailing link — `PreferencesLinkRow.buttonTitle`. */
  @property({ reflect: true, attribute: 'button-label' }) buttonLabel = ''

  /** `PreferencesLinkRow.destination`. */
  @property({ reflect: true }) href = ''

  /** `.help(_:)`. Also the link's accessible name. */
  @property({ reflect: true }) help = ''

  /** Where the link opens. Defaults to a new tab, as opening a URL from Preferences does. */
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
