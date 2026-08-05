import { type CSSResultGroup, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import '../dependent-rows/fd-dependent-rows.js'
import '../switch-row/fd-switch-row.js'

/**
 * Mirrors `PreferencesSwitchGroup`: a master switch row with rows that appear only while it
 * is on.
 *
 * @slot - The dependent rows.
 * @fires fd-change - `{ checked: boolean }` from the master switch.
 */
@customElement('fd-switch-group')
export class FdSwitchGroup extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
      }
    `,
  ]

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) caption: string | null = null

  @property({ type: Boolean, reflect: true }) checked = false

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true }) name = ''

  @property({ type: Boolean, attribute: 'no-separator', reflect: true }) noSeparator = false

  @property({ type: Boolean, attribute: 'separator-flush', reflect: true }) separatorFlush = false

  #onSwitchChange = (event: CustomEvent<{ checked: boolean }>): void => {
    this.checked = event.detail.checked
  }

  override render() {
    return html`
      <fd-switch-row
        symbol=${this.symbol ?? ''}
        label=${this.label}
        caption=${this.caption ?? ''}
        name=${this.name}
        ?checked=${this.checked}
        ?disabled=${this.disabled}
        @fd-change=${this.#onSwitchChange}
      ></fd-switch-row>
      <fd-dependent-rows
        ?visible=${this.checked}
        ?no-separator=${this.noSeparator}
        ?separator-flush=${this.separatorFlush}
      >
        <slot></slot>
      </fd-dependent-rows>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-switch-group': FdSwitchGroup
  }
}
