import { type CSSResultGroup, css, html, type PropertyValues } from 'lit'
import { property, state } from 'lit/decorators.js'
import { baseStyles, FdElement } from './base-element.js'
import { type CollectedOption, collectOptions } from './options.js'
import { selectionStyles } from './selection.js'
import '../components/icon/fd-icon.js'

export interface FdSegmentOption {
  readonly value: string
  readonly label: string
  readonly symbol?: string
}

interface ResolvedSegmentOption {
  readonly value: string
  readonly label: string
  readonly symbol: string | null
  readonly disabled: boolean
}

export type FdSegmentLabelStyle = 'automatic' | 'textOnly' | 'iconOnly' | 'iconAndText'

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

  @property({ attribute: false }) options: readonly FdSegmentOption[] = []

  @property({ reflect: true, attribute: 'label-style' })
  labelStyle: FdSegmentLabelStyle = 'automatic'

  @state() private slottedOptions: CollectedOption[] = []

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
    return this.#resolvedOptions.findIndex((option) => option.value === this.value)
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
    this.slottedOptions = collectOptions(event.target as HTMLSlotElement)
  }

  #select(index: number): void {
    const option = this.#resolvedOptions[index]
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
    const options = this.#resolvedOptions
    if (options.length === 0 || this.disabled) return

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
    const options = this.#resolvedOptions
    let candidate = current
    for (let visited = 0; visited < options.length; visited += 1) {
      candidate = (candidate + offset + options.length) % options.length
      if (!options[candidate]?.disabled) return candidate
    }
    return -1
  }

  #optionContent(option: ResolvedSegmentOption) {
    const icon = option.symbol
      ? html`<fd-icon class="segment-icon" name=${option.symbol}></fd-icon>`
      : undefined
    const label = html`<span class="segment-label">${option.label}</span>`

    switch (this.labelStyle) {
      case 'textOnly':
        return label
      case 'iconOnly':
        return icon ?? label
      case 'iconAndText':
        return html`${icon}${label}`
      case 'automatic':
        return icon ?? label
    }
  }

  override render() {
    const options = this.#resolvedOptions
    const selectedIndex = this.selectedIndex
    const tabStopIndex =
      selectedIndex >= 0 && !options[selectedIndex]?.disabled
        ? selectedIndex
        : options.findIndex((option) => !option.disabled)

    return html`
      <div
        class="strip"
        part="control"
        role="radiogroup"
        aria-label=${this.label}
        ?data-connected=${this.connected}
        @keydown=${this.#onKeydown}
      >
        ${options.map((option, index) => {
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
              ${this.#optionContent(option)}
            </button>
          `
        })}
      </div>
      <slot hidden @slotchange=${this.#onSlotChange}></slot>
    `
  }

  get #resolvedOptions(): ResolvedSegmentOption[] {
    return this.options.length > 0
      ? this.options.map((option) => ({
          value: option.value,
          label: option.label,
          symbol: option.symbol ?? null,
          disabled: false,
        }))
      : this.slottedOptions
  }
}
