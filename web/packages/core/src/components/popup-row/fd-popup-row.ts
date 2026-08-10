import { type CSSResultGroup, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import type { FdPopupOption } from '../popup/fd-popup.js'
import '../popup/fd-popup.js'
import '../row/fd-row.js'

/**
 * Mirrors `PreferencesPopupRow`: an `fd-row` whose trailing control is an `fd-popup`.
 *
 * @fires fd-change - `{ value: string }`, re-dispatched from the popup.
 */
@customElement('fd-popup-row')
export class FdPopupRow extends FdElement {
  static override styles: CSSResultGroup = baseStyles

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) caption: string | null = null

  @property({ reflect: true }) value: string | null = null

  @property({ type: Number, attribute: 'min-width' }) minWidth = 0

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true }) name = ''

  @property({ attribute: false }) options: FdPopupOption[] = []

  #onPopupChange = (event: CustomEvent<{ value: string }>): void => {
    this.value = event.detail.value
  }

  override render() {
    return html`
      <fd-row symbol=${this.symbol ?? ''} label=${this.label} caption=${this.caption ?? ''}>
        <fd-popup
          slot="trailing"
          name=${this.name}
          min-width=${this.minWidth}
          .options=${this.options}
          .label=${this.label}
          .value=${this.value}
          ?disabled=${this.disabled}
          @fd-change=${this.#onPopupChange}
        >
          <slot></slot>
        </fd-popup>
      </fd-row>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-popup-row': FdPopupRow
  }
}
