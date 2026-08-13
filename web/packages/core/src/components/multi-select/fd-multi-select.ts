import { type CSSResultGroup, css, html, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { type CollectedOption, collectOptions } from '../../internal/options.js'
import type {
  FdCheckboxContentAlignment,
  FdCheckboxIndicatorPlacement,
  FdCheckboxTruncationMode,
} from '../checkbox/fd-checkbox.js'
import '../checkbox/fd-checkbox.js'
import type { FdOption } from '../option/fd-option.js'
import '../option/fd-option.js'

export type FdMultiSelectAxis = 'horizontal' | 'vertical'
export type FdMultiSelectItemWidthPolicy = 'equal' | 'fitContent'

/**
 * The reusable counterpart to `FlowingMultiSelect`.
 *
 * @fires fd-change - `{ value, selected, values }` when one option changes.
 * @csspart group - The option container.
 * @csspart option - Each checkbox, forwarded from `fd-checkbox`.
 */
@customElement('fd-multi-select')
export class FdMultiSelect extends FdElement {
  static formAssociated = true

  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        min-width: 0;
      }

      .group {
        display: flex;
        gap: var(--_spacing);
        min-width: 0;
      }

      :host([axis='vertical']) .group {
        flex-direction: column;
      }

      :host([item-width-policy='equal']) fd-checkbox {
        flex: 1 1 0;
      }

      :host([axis='vertical'][item-width-policy='equal']) fd-checkbox {
        width: 100%;
      }

      :host([item-width-policy='fitContent']) fd-checkbox {
        flex: none;
      }

      :host([axis='vertical'][content-alignment='center']) .group {
        align-items: center;
      }

      :host([axis='vertical'][content-alignment='trailing']) .group {
        align-items: flex-end;
      }
    `,
  ]

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) axis: FdMultiSelectAxis = 'horizontal'

  @property({ reflect: true, attribute: 'item-width-policy' })
  itemWidthPolicy: FdMultiSelectItemWidthPolicy = 'equal'

  @property({ reflect: true, attribute: 'content-alignment' })
  contentAlignment: FdCheckboxContentAlignment = 'center'

  @property({ reflect: true, attribute: 'indicator-placement' })
  indicatorPlacement: FdCheckboxIndicatorPlacement = 'leading'

  @property({ type: Number }) spacing = 6

  @property({ type: Number, attribute: 'maximum-item-width' }) maximumItemWidth: number | null =
    null

  @property({ reflect: true, attribute: 'truncation-mode' })
  truncationMode: FdCheckboxTruncationMode = 'tail'

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true }) name = ''

  @state() private options: CollectedOption[] = []

  readonly #internals: ElementInternals

  #slot: HTMLSlotElement | null = null

  #defaultSelections: Map<FdOption, boolean> | null = null

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

  get values(): string[] {
    return this.options.filter((option) => option.selected).map((option) => option.value)
  }

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.#syncFormValue()
  }

  #syncFormValue(): void {
    const data = new FormData()
    if (this.name && !this.disabled) {
      for (const value of this.values) data.append(this.name, value)
    }
    this.#internals.setFormValue(data)
  }

  formResetCallback(): void {
    if (!this.#defaultSelections) return
    for (const [option, selected] of this.#defaultSelections) option.selected = selected
    if (this.#slot) this.options = collectOptions(this.#slot)
    this.#syncFormValue()
  }

  formStateRestoreCallback(state: File | FormData | string | null): void {
    const values =
      state instanceof FormData
        ? new Set(
            state.getAll(this.name).filter((value): value is string => typeof value === 'string'),
          )
        : new Set(typeof state === 'string' ? [state] : [])
    for (const option of this.options) option.element.selected = values.has(option.value)
    if (this.#slot) this.options = collectOptions(this.#slot)
  }

  #onSlotChange = (event: Event): void => {
    this.#slot = event.target as HTMLSlotElement
    this.options = collectOptions(this.#slot)
    const currentElements = new Set(this.options.map((option) => option.element))
    this.#defaultSelections ??= new Map()
    for (const option of this.#defaultSelections.keys()) {
      if (!currentElements.has(option)) this.#defaultSelections.delete(option)
    }
    for (const option of this.options) {
      if (!this.#defaultSelections.has(option.element)) {
        this.#defaultSelections.set(option.element, option.selected)
      }
    }
  }

  #toggle(event: CustomEvent, index: number): void {
    event.stopPropagation()
    const option = this.options[index]
    if (!option || this.disabled || option.disabled) return

    option.element.selected = event.detail.checked === true
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
    const spacing = Number.isFinite(this.spacing) && this.spacing >= 0 ? this.spacing : 6
    return html`
      <div
        class="group"
        part="group"
        role="group"
        aria-label=${this.label}
        style="--_spacing: ${spacing}px"
      >
        ${this.options.map(
          (option, index) => html`
            <fd-checkbox
              exportparts="button: option, indicator"
              .label=${option.label}
              .symbol=${option.symbol}
              .accent=${option.accent}
              .checked=${option.selected}
              .disabled=${this.disabled || option.disabled}
              .contentAlignment=${this.contentAlignment}
              .indicatorPlacement=${this.indicatorPlacement}
              .widthPolicy=${this.itemWidthPolicy === 'equal' ? 'fill' : 'fitContent'}
              .maximumWidth=${this.maximumItemWidth}
              .truncationMode=${this.truncationMode}
              @fd-change=${(event: CustomEvent) => this.#toggle(event, index)}
            ></fd-checkbox>
          `,
        )}
      </div>
      <slot hidden @slotchange=${this.#onSlotChange}></slot>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-multi-select': FdMultiSelect
  }
}
