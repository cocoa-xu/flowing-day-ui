import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { FdElement } from '../../internal/base-element.js'
import '../button/fd-button.js'
import '../row/fd-row.js'

/**
 * Mirrors `PreferencesButtonRow`: an `fd-row` whose trailing control is a soft button.
 *
 * @fires fd-activate - When the button is pressed. This is the SwiftUI `action` closure.
 * @csspart button - The trailing button.
 */
@customElement('fd-button-row')
export class FdButtonRow extends FdElement {
  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) caption: string | null = null

  /** Text on the trailing button — `PreferencesButtonRow.buttonTitle`. */
  @property({ reflect: true, attribute: 'button-label' }) buttonLabel = ''

  /** Mirrors `PreferencesSoftButtonStyle(isProminent:)`. */
  @property({ type: Boolean, reflect: true }) prominent = false

  @property({ type: Boolean, reflect: true }) disabled = false

  #onClick = (event: Event): void => {
    event.stopPropagation()
    if (this.disabled) return
    this.dispatchEvent(
      new CustomEvent('fd-activate', { detail: {}, bubbles: true, composed: true }),
    )
  }

  override render() {
    return html`
      <fd-row symbol=${this.symbol ?? ''} label=${this.label} caption=${this.caption ?? ''}>
        <fd-button
          exportparts="button"
          slot="trailing"
          .label=${this.buttonLabel}
          .prominent=${this.prominent}
          .disabled=${this.disabled}
          @fd-activate=${this.#onClick}
        >
        </fd-button>
      </fd-row>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-button-row': FdButtonRow
  }
}
