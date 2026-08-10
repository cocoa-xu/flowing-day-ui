import { html, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { FdElement } from '../../internal/base-element.js'
import type { FdColorPicker } from '../color-picker/fd-color-picker.js'
import '../color-picker/fd-color-picker.js'
import '../row/fd-row.js'

/**
 * Mirrors `PreferencesColorPickerRow`: a row whose trailing control opens the platform
 * colour picker. `ColorPicker` is `<input type="color">` here — both hand the choice to
 * the OS rather than drawing a picker, which is the point of using it.
 *
 * `supports-opacity` maps to the `alpha` attribute. Browsers without it ignore the
 * attribute and offer an opaque colour, which is the `supportsOpacity: false` behaviour.
 *
 * @fires fd-change - `{ value: string }` as a hex colour.
 * @csspart swatch - The colour well.
 */
@customElement('fd-color-picker-row')
export class FdColorPickerRow extends FdElement {
  static formAssociated = true

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) caption: string | null = null

  /** The selected colour, as a hex string. */
  @property({ reflect: true }) value = '#000000'

  /** `PreferencesColorPickerRow.supportsOpacity`. */
  @property({ type: Boolean, reflect: true, attribute: 'supports-opacity' }) supportsOpacity = false

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true }) name = ''

  readonly #internals: ElementInternals

  #defaultValue = '#000000'

  constructor() {
    super()
    this.#internals = this.attachInternals()
  }

  get form(): HTMLFormElement | null {
    return this.#internals.form
  }

  get labels(): NodeList {
    return this.#internals.labels
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#defaultValue = this.value
  }

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.#internals.setFormValue(this.disabled ? null : this.value)
  }

  formResetCallback(): void {
    this.value = this.#defaultValue
  }

  formStateRestoreCallback(state: string | null): void {
    if (state !== null) this.value = state
  }

  #onChange = (event: CustomEvent): void => {
    event.stopPropagation()
    this.value = (event.currentTarget as FdColorPicker).value
    this.dispatchEvent(
      new CustomEvent('fd-change', {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    )
  }

  override render() {
    return html`
      <fd-row symbol=${this.symbol ?? ''} label=${this.label} caption=${this.caption ?? ''}>
        <fd-color-picker
          exportparts="swatch"
          slot="trailing"
          .label=${this.label}
          .value=${this.value}
          .supportsOpacity=${this.supportsOpacity}
          .disabled=${this.disabled}
          .hideLabel=${true}
          @fd-change=${this.#onChange}
        ></fd-color-picker>
      </fd-row>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-color-picker-row': FdColorPickerRow
  }
}
