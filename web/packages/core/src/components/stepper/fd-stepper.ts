import { css, html, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { textRole } from '../../internal/typography.js'

@customElement('fd-stepper')
export class FdStepper extends FdElement {
  static formAssociated = true

  static override styles = [
    baseStyles,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        gap: 10px;
      }

      .value {
        ${textRole('value')}
        overflow: hidden;
        color: var(--_fd-palette-ink);
        font-variant-numeric: tabular-nums;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .control {
        display: flex;
        height: 28px;
        overflow: hidden;
        border: 1px solid var(--_fd-palette-hairline);
        border-radius: var(--_fd-metric-control-radius);
        background: var(--_fd-surface-control);
      }

      :host(:focus-within) .control {
        border-color: color-mix(in srgb, var(--_fd-accent-foreground) 42%, transparent);
      }

      button {
        position: relative;
        width: 27px;
        height: 28px;
        padding: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--_fd-accent-foreground);
        cursor: default;
      }

      button:disabled {
        color: var(--_fd-palette-faint);
      }

      button::before,
      button.increment::after {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 9px;
        height: 1.5px;
        border-radius: 1px;
        background: currentColor;
        content: '';
        transform: translate(-50%, -50%);
      }

      button.increment::after {
        transform: translate(-50%, -50%) rotate(90deg);
      }

      .divider {
        align-self: center;
        width: 1px;
        height: 14px;
        background: var(--_fd-palette-hairline);
      }

      :host([disabled]) {
        opacity: 0.42;
      }
    `,
  ]

  @property({ reflect: true }) label = ''

  @property({ type: Number, reflect: true }) value = 0

  @property({ type: Number, reflect: true }) minimum = 0

  @property({ type: Number, reflect: true }) maximum = 100

  @property({ type: Number, reflect: true }) step = 1

  @property({ attribute: false }) formatValue: (value: number) => string = String

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true }) name = ''

  readonly #internals: ElementInternals
  #defaultValue = 0

  constructor() {
    super()
    this.#internals = this.attachInternals()
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#defaultValue = this.value
    this.addEventListener('keydown', this.#handleKeyDown)
  }

  override disconnectedCallback(): void {
    this.removeEventListener('keydown', this.#handleKeyDown)
    super.disconnectedCallback()
  }

  override willUpdate(): void {
    if (!Number.isFinite(this.minimum) || !Number.isFinite(this.maximum)) {
      throw new RangeError('Stepper bounds must be finite.')
    }
    if (this.minimum > this.maximum) {
      throw new RangeError('Stepper minimum must not exceed its maximum.')
    }
    if (!Number.isFinite(this.step) || this.step <= 0) {
      throw new RangeError('Stepper step must be finite and greater than zero.')
    }
    this.value = Math.min(this.maximum, Math.max(this.minimum, this.value))
  }

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    const formattedValue = this.formatValue(this.value)
    this.#internals.role = 'spinbutton'
    this.#internals.ariaLabel = this.label
    this.#internals.ariaValueMin = String(this.minimum)
    this.#internals.ariaValueMax = String(this.maximum)
    this.#internals.ariaValueNow = String(this.value)
    this.#internals.ariaValueText = formattedValue
    this.#internals.ariaDisabled = String(this.disabled)
    this.#internals.setFormValue(this.disabled ? null : String(this.value), String(this.value))
  }

  formResetCallback(): void {
    this.value = this.#defaultValue
  }

  formStateRestoreCallback(state: string | null): void {
    if (state === null) return
    const restoredValue = Number(state)
    if (Number.isFinite(restoredValue)) this.value = restoredValue
  }

  override render() {
    const formattedValue = this.formatValue(this.value)
    return html`
      <span class="value" aria-hidden="true" part="value">${formattedValue}</span>
      <span class="control" part="control">
        <button
          type="button"
          class="decrement"
          aria-label=${`Decrease ${this.label}`}
          title=${`Decrease ${this.label}`}
          ?disabled=${this.disabled || this.value <= this.minimum}
          @click=${this.#decrement}
        ></button>
        <span class="divider"></span>
        <button
          type="button"
          class="increment"
          aria-label=${`Increase ${this.label}`}
          title=${`Increase ${this.label}`}
          ?disabled=${this.disabled || this.value >= this.maximum}
          @click=${this.#increment}
        ></button>
      </span>
    `
  }

  #handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault()
      this.#increment()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault()
      this.#decrement()
    }
  }

  #increment = (): void => {
    if (this.disabled || this.value >= this.maximum) return
    this.#setValue(Math.min(this.maximum, this.value + this.step))
  }

  #decrement = (): void => {
    if (this.disabled || this.value <= this.minimum) return
    this.#setValue(Math.max(this.minimum, this.value - this.step))
  }

  #setValue(value: number): void {
    if (value === this.value) return
    this.value = value
    this.dispatchEvent(
      new CustomEvent('fd-change', {
        detail: { value },
        bubbles: true,
        composed: true,
      }),
    )
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-stepper': FdStepper
  }
}
