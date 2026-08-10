import { type CSSResultGroup, css, html, type PropertyValues } from 'lit'
import { property, state } from 'lit/decorators.js'
import { baseStyles, FdElement } from './base-element.js'
import { type CollectedOption, collectOptions } from './options.js'
import { selectionStyles } from './selection.js'
import '../components/icon/fd-icon.js'

export abstract class FdSegmentedControlBase extends FdElement {
  static formAssociated = true

  static override styles: CSSResultGroup = [
    baseStyles,
    selectionStyles,
    css`
      :host {
        display: block;
        min-width: 0;
      }

      .strip {
        width: 100%;
      }
    `,
  ]

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) value: string | null = null

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true }) name = ''

  @state() protected options: CollectedOption[] = []

  readonly #internals: ElementInternals

  #defaultValue: string | null = null

  protected get connected(): boolean {
    return false
  }

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

  get selectedIndex(): number {
    return this.options.findIndex((option) => option.value === this.value)
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
    this.value = state
  }

  #onSlotChange = (event: Event): void => {
    this.options = collectOptions(event.target as HTMLSlotElement)
  }

  #select(index: number): void {
    const option = this.options[index]
    if (!option || this.disabled || option.disabled || option.value === this.value) return
    this.value = option.value
    this.dispatchEvent(
      new CustomEvent('fd-change', {
        detail: { value: option.value },
        bubbles: true,
        composed: true,
      }),
    )
  }

  #onKeydown = (event: KeyboardEvent): void => {
    if (this.options.length === 0 || this.disabled) return

    const isRTL = getComputedStyle(this).direction === 'rtl'
    const offset =
      event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowUp'
          ? -1
          : event.key === 'ArrowRight'
            ? isRTL
              ? -1
              : 1
            : event.key === 'ArrowLeft'
              ? isRTL
                ? 1
                : -1
              : 0
    if (offset === 0) return

    event.preventDefault()
    const selectedIndex = this.selectedIndex
    const current = selectedIndex >= 0 ? selectedIndex : offset > 0 ? -1 : 0
    const next = this.#nextEnabledIndex(current, offset)
    if (next < 0) return
    this.#select(next)
    this.renderRoot.querySelectorAll<HTMLButtonElement>('.segment')[next]?.focus()
  }

  #nextEnabledIndex(current: number, offset: number): number {
    let candidate = current
    for (let visited = 0; visited < this.options.length; visited += 1) {
      candidate = (candidate + offset + this.options.length) % this.options.length
      if (!this.options[candidate]?.disabled) return candidate
    }
    return -1
  }

  override render() {
    const selectedIndex = this.selectedIndex
    const tabStopIndex =
      selectedIndex >= 0 && !this.options[selectedIndex]?.disabled
        ? selectedIndex
        : this.options.findIndex((option) => !option.disabled)

    return html`
      <div
        class="strip"
        part="control"
        role="radiogroup"
        aria-label=${this.label}
        ?data-connected=${this.connected}
        @keydown=${this.#onKeydown}
      >
        ${this.options.map((option, index) => {
          const selected = index === selectedIndex
          return html`
            <button
              class="segment"
              part="segment"
              type="button"
              role="radio"
              aria-checked=${selected}
              aria-label=${option.label}
              ?data-selected=${selected}
              ?disabled=${this.disabled || option.disabled}
              ?data-hide-divider=${this.connected && (selected || index + 1 === selectedIndex)}
              title=${option.label}
              tabindex=${index === tabStopIndex ? 0 : -1}
              @click=${() => this.#select(index)}
            >
              ${
                option.symbol
                  ? html`<fd-icon class="segment-icon" name=${option.symbol}></fd-icon>`
                  : html`<span class="segment-label">${option.label}</span>`
              }
            </button>
          `
        })}
      </div>
      <slot hidden @slotchange=${this.#onSlotChange}></slot>
    `
  }
}
