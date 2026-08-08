import { type CSSResultGroup, css, html, type PropertyValues, type TemplateResult } from 'lit'
import { property, state } from 'lit/decorators.js'
import { baseStyles, FdElement } from './base-element.js'
import { type CollectedOption, collectOptions } from './options.js'
import { selectionStyles } from './selection.js'

/**
 * Shared by the segmented row variants, which differ in content and whether the segments
 * share one connected surface. Every variant is a single-select strip inside an `fd-row`.
 *
 * Exposed as a radio group rather than as the plain buttons the SwiftUI original uses:
 * on the web that carries the roving tab stop and arrow-key navigation people expect
 * from a segmented control, which `accessibilityValue` alone would not.
 */
export abstract class FdSegmentedRowBase extends FdElement {
  static formAssociated = true

  static override styles: CSSResultGroup = [
    baseStyles,
    selectionStyles,
    css`
      :host {
        --_control-width: var(--fd-control-width, 300px);
      }
    `,
  ]

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) caption: string | null = null

  @property({ reflect: true }) value: string | null = null

  /** Mirrors `controlWidth`, which defaults to 300. */
  @property({ type: Number, attribute: 'control-width' }) controlWidth = 300

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true }) name = ''

  @state() protected options: CollectedOption[] = []

  readonly #internals: ElementInternals

  #defaultValue: string | null = null

  constructor() {
    super()
    this.#internals = this.attachInternals()
  }

  get form(): HTMLFormElement | null {
    return this.#internals.form
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
    this.#internals.setFormValue(this.value)
    this.style.setProperty('--_control-width', `${this.controlWidth}px`)
  }

  formResetCallback(): void {
    this.value = this.#defaultValue
  }

  formStateRestoreCallback(state: string | null): void {
    this.value = state
  }

  /** Draws the inside of one segment; the pill chrome itself is shared. */
  protected abstract renderSegmentContent(
    option: CollectedOption,
    selected: boolean,
  ): TemplateResult

  /** Extra attributes a subclass wants on the segment, such as a tooltip. */
  protected segmentTitle(_option: CollectedOption): string | undefined {
    return undefined
  }

  /** Selects the padding variant: label strips are compact, glyph strips are not. */
  protected get segmentModifier(): 'compact' | 'symbol' | null {
    return null
  }

  protected get connected(): boolean {
    return false
  }

  #onSlotChange = (event: Event): void => {
    this.options = collectOptions(event.target as HTMLSlotElement)
  }

  #select(index: number): void {
    const option = this.options[index]
    if (!option || this.disabled || option.value === this.value) return
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
    const count = this.options.length
    if (count === 0 || this.disabled) return

    const offset =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
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
      <fd-row symbol=${this.symbol ?? ''} label=${this.label} caption=${this.caption ?? ''}>
        <div
          class="strip"
          slot="trailing"
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
                ?data-selected=${selected}
                ?data-compact=${this.segmentModifier === 'compact'}
                ?data-symbol=${this.segmentModifier === 'symbol'}
                ?disabled=${this.disabled || option.disabled}
                ?data-hide-divider=${this.connected && (selected || index + 1 === selectedIndex)}
                title=${this.segmentTitle(option) ?? ''}
                tabindex=${index === tabStopIndex ? 0 : -1}
                @click=${() => this.#select(index)}
              >
                ${this.renderSegmentContent(option, selected)}
              </button>
            `
          })}
        </div>
      </fd-row>
      <slot hidden @slotchange=${this.#onSlotChange}></slot>
    `
  }
}
