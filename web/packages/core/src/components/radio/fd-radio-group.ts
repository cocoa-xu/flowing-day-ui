import { css, html, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import './fd-radio.js'

export interface FdRadioOption {
  readonly value: string
  readonly label: string
  readonly symbol?: string
  readonly isEnabled?: boolean
}

export type FdRadioGroupAxis = 'horizontal' | 'vertical'

@customElement('fd-radio-group')
export class FdRadioGroup extends FdElement {
  static formAssociated = true

  static override styles = [
    baseStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
      }

      :host([axis='horizontal']) {
        flex-direction: row;
      }

      fd-radio {
        max-width: 100%;
      }

      :host(:focus-visible) fd-radio[selected]::part(indicator) {
        border-width: 1.5px;
      }
    `,
  ]

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) value = ''

  @property({ attribute: false }) options: readonly FdRadioOption[] = []

  @property({ reflect: true }) axis: FdRadioGroupAxis = 'vertical'

  @property({ type: Number, reflect: true }) spacing = 4

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true }) name = ''

  readonly #internals: ElementInternals
  #defaultValue = ''

  constructor() {
    super()
    this.#internals = this.attachInternals()
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#defaultValue = this.value
    this.addEventListener('fd-activate', this.#select)
    this.addEventListener('keydown', this.#navigate)
  }

  override disconnectedCallback(): void {
    this.removeEventListener('fd-activate', this.#select)
    this.removeEventListener('keydown', this.#navigate)
    super.disconnectedCallback()
  }

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.#syncFormValue()
    this.#internals.role = 'radiogroup'
    this.#internals.ariaLabel = this.label
    this.#internals.ariaDisabled = String(this.disabled)
    this.tabIndex = this.disabled ? -1 : 0
    this.style.gap = `${Math.max(0, this.spacing)}px`
  }

  formResetCallback(): void {
    this.value = this.#defaultValue
  }

  formStateRestoreCallback(state: string | null): void {
    this.value = state ?? ''
  }

  override render() {
    return html`${this.options.map(
      (option) => html`
        <fd-radio
          value=${option.value}
          label=${option.label}
          .symbol=${option.symbol ?? null}
          ?selected=${option.value === this.value}
          ?disabled=${this.disabled || option.isEnabled === false}
          tabindex=${option.value === this.value ? '0' : '-1'}
        ></fd-radio>
      `,
    )}`
  }

  #select = (event: Event): void => {
    if (this.disabled || !(event instanceof CustomEvent)) return
    const value = String((event.detail as { value?: unknown }).value ?? '')
    const option = this.options.find((candidate) => candidate.value === value)
    if (!option || option.isEnabled === false || value === this.value) return
    event.stopPropagation()
    this.value = value
    this.dispatchEvent(
      new CustomEvent('fd-change', {
        detail: { value },
        bubbles: true,
        composed: true,
      }),
    )
  }

  #navigate = (event: KeyboardEvent): void => {
    const horizontalOffset = getComputedStyle(this).direction === 'rtl' ? -1 : 1
    const offset =
      event.key === 'ArrowUp'
        ? -1
        : event.key === 'ArrowDown'
          ? 1
          : this.axis === 'horizontal' && event.key === 'ArrowLeft'
            ? -horizontalOffset
            : this.axis === 'horizontal' && event.key === 'ArrowRight'
              ? horizontalOffset
              : 0
    if (offset === 0) return
    const enabled = this.options.filter(({ isEnabled }) => isEnabled !== false)
    if (enabled.length === 0) return
    const index = Math.max(
      0,
      enabled.findIndex(({ value }) => value === this.value),
    )
    const destination = enabled[(index + offset + enabled.length) % enabled.length]
    if (!destination) return
    event.preventDefault()
    this.value = destination.value
    this.dispatchEvent(
      new CustomEvent('fd-change', {
        detail: { value: destination.value },
        bubbles: true,
        composed: true,
      }),
    )
  }

  #syncFormValue(): void {
    this.#internals.setFormValue(this.disabled ? null : this.value, this.value)
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-radio-group': FdRadioGroup
  }
}
