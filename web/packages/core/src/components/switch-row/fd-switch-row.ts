import { type CSSResultGroup, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import '../row/fd-row.js'
import '../switch/fd-switch.js'

/**
 * Mirrors `SettingsSwitchRow`: an `fd-row` whose trailing control is an `fd-switch`.
 * Only the switch toggles, matching the SwiftUI original which adds no row-wide gesture.
 *
 * @fires fd-change - `{ checked: boolean }`, re-dispatched from the inner switch.
 */
@customElement('fd-switch-row')
export class FdSwitchRow extends FdElement {
  static override styles: CSSResultGroup = baseStyles

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) caption: string | null = null

  @property({ type: Boolean, reflect: true }) checked = false

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true }) name = ''

  #onSwitchChange = (event: CustomEvent<{ checked: boolean }>): void => {
    this.checked = event.detail.checked
  }

  override render() {
    return html`
      <fd-row
        symbol=${this.symbol ?? ''}
        label=${this.label}
        caption=${this.caption ?? ''}
      >
        <fd-switch
          slot="trailing"
          name=${this.name}
          ?checked=${this.checked}
          ?disabled=${this.disabled}
          aria-label=${this.label}
          @fd-change=${this.#onSwitchChange}
        ></fd-switch>
      </fd-row>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-switch-row': FdSwitchRow
  }
}
