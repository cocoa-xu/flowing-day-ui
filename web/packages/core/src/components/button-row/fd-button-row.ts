import { type CSSResultGroup, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { softButtonStyles } from '../../internal/soft-button.js'
import '../row/fd-row.js'

/**
 * Mirrors `PreferencesButtonRow`: an `fd-row` whose trailing control is a soft button.
 *
 * @fires fd-activate - When the button is pressed. This is the SwiftUI `action` closure.
 * @csspart button - The trailing button.
 */
@customElement('fd-button-row')
export class FdButtonRow extends FdElement {
  static override styles: CSSResultGroup = [baseStyles, softButtonStyles]

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) caption: string | null = null

  /** Text on the trailing button — `PreferencesButtonRow.buttonTitle`. */
  @property({ reflect: true, attribute: 'button-label' }) buttonLabel = ''

  /** Mirrors `PreferencesSoftButtonStyle(isProminent:)`. */
  @property({ type: Boolean, reflect: true }) prominent = false

  @property({ type: Boolean, reflect: true }) disabled = false

  #onClick = (): void => {
    if (this.disabled) return
    this.dispatchEvent(
      new CustomEvent('fd-activate', { detail: {}, bubbles: true, composed: true }),
    )
  }

  override render() {
    return html`
      <fd-row symbol=${this.symbol ?? ''} label=${this.label} caption=${this.caption ?? ''}>
        <button
          class="soft-button"
          part="button"
          type="button"
          slot="trailing"
          ?data-prominent=${this.prominent}
          ?disabled=${this.disabled}
          @click=${this.#onClick}
        >
          ${this.buttonLabel}
        </button>
      </fd-row>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-button-row': FdButtonRow
  }
}
