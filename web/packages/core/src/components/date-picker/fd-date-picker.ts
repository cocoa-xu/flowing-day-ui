import { type CSSResultGroup, css, html, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { textInputChromeStyles } from '../../internal/text-input.js'

export type FdDatePickerComponents = 'date' | 'time' | 'dateAndTime'

@customElement('fd-date-picker')
export class FdDatePicker extends FdElement {
  static formAssociated = true

  static override styles: CSSResultGroup = [
    baseStyles,
    textInputChromeStyles,
    css`
      input {
        color-scheme: light dark;
      }

      input::-webkit-calendar-picker-indicator {
        opacity: 0.62;
      }
    `,
  ]

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) value = ''

  @property({ reflect: true }) minimum = ''

  @property({ reflect: true }) maximum = ''

  @property({ reflect: true }) components: FdDatePickerComponents = 'dateAndTime'

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true }) name = ''

  readonly #internals: ElementInternals
  #defaultValue = ''

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
    this.#syncFormValue()
    this.#internals.ariaDisabled = String(this.disabled)
  }

  formResetCallback(): void {
    this.value = this.#defaultValue
  }

  formStateRestoreCallback(state: string | null): void {
    this.value = state ?? ''
  }

  #onInput = (event: InputEvent): void => {
    this.value = (event.currentTarget as HTMLInputElement).value
    this.dispatchEvent(
      new CustomEvent('fd-change', {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    )
  }

  #syncFormValue(): void {
    this.#internals.setFormValue(this.disabled ? null : this.value, this.value)
  }

  override render() {
    return html`
      <div class="field" part="field">
        <input
          part="input"
          type=${this.#inputType}
          .value=${this.value}
          min=${this.minimum}
          max=${this.maximum}
          step=${this.components === 'date' ? '1' : '60'}
          aria-label=${this.label}
          ?disabled=${this.disabled}
          @input=${this.#onInput}
        />
      </div>
    `
  }

  get #inputType(): 'date' | 'time' | 'datetime-local' {
    switch (this.components) {
      case 'date':
        return 'date'
      case 'time':
        return 'time'
    }
    return 'datetime-local'
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-date-picker': FdDatePicker
  }
}
