import { type CSSResultGroup, css, html, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { type CollectedOption, collectOptions } from '../../internal/options.js'
import { checkCircleFill, circleOutline, selectionStyles } from '../../internal/selection.js'
import '../option/fd-option.js'
import '../row/fd-row.js'

/**
 * Mirrors `PreferencesMultiSelectRow`: one row holding several independent toggles, each
 * keeping its own on/off state and enablement, drawn as checkmark-circle pills.
 *
 * Each `fd-option` child owns its state through its `selected` attribute, which is the
 * web counterpart of the per-option `Binding<Bool>` the SwiftUI original takes.
 *
 * @fires fd-change - `{ value, selected, values }` when one option is toggled.
 * @csspart segment - One pill in the strip.
 */
@customElement('fd-multi-select-row')
export class FdMultiSelectRow extends FdElement {
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

  /** Mirrors `controlWidth`, which defaults to 300. */
  @property({ type: Number, attribute: 'control-width' }) controlWidth = 300

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true }) name = ''

  @state() private options: CollectedOption[] = []

  readonly #internals: ElementInternals

  #slot: HTMLSlotElement | null = null

  constructor() {
    super()
    this.#internals = this.attachInternals()
  }

  get form(): HTMLFormElement | null {
    return this.#internals.form
  }

  /** The values of every option currently switched on. */
  get values(): string[] {
    return this.options.filter((option) => option.selected).map((option) => option.value)
  }

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.style.setProperty('--_control-width', `${this.controlWidth}px`)

    const data = new FormData()
    if (this.name) for (const value of this.values) data.append(this.name, value)
    this.#internals.setFormValue(data)
  }

  #onSlotChange = (event: Event): void => {
    this.#slot = event.target as HTMLSlotElement
    this.options = collectOptions(this.#slot)
  }

  /** Mirrors `PreferencesMultiSelectOption.toggle()`, which guards on `isEnabled`. */
  #toggle(index: number): void {
    const option = this.options[index]
    if (!option || this.disabled || option.disabled) return

    option.element.selected = !option.element.selected
    if (this.#slot) this.options = collectOptions(this.#slot)

    this.dispatchEvent(
      new CustomEvent('fd-change', {
        detail: {
          value: option.value,
          selected: option.element.selected,
          values: this.values,
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  override render() {
    return html`
      <fd-row symbol=${this.symbol ?? ''} label=${this.label} caption=${this.caption ?? ''}>
        <div class="strip" slot="trailing" role="group" aria-label=${this.label}>
          ${this.options.map(
            (option, index) => html`
              <button
                class="segment"
                part="segment"
                type="button"
                aria-pressed=${option.selected}
                ?data-selected=${option.selected}
                ?disabled=${this.disabled || option.disabled}
                @click=${() => this.#toggle(index)}
              >
                ${option.selected ? checkCircleFill : circleOutline}
                <span class="segment-label">${option.label}</span>
              </button>
            `,
          )}
        </div>
      </fd-row>
      <slot hidden @slotchange=${this.#onSlotChange}></slot>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-multi-select-row': FdMultiSelectRow
  }
}
