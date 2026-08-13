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

export interface FdMultiSelectOption {
  readonly id?: string
  readonly label: string
  readonly symbol?: string | null
  readonly accent?: string | null
  readonly isSelected?: boolean
  readonly isEnabled?: boolean
}

interface ResolvedMultiSelectOption {
  readonly value: string
  readonly label: string
  readonly symbol: string | null
  readonly accent: string | null
  readonly selected: boolean
  readonly disabled: boolean
  readonly element: FdOption | null
}

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

  @property({ attribute: false }) options: readonly FdMultiSelectOption[] = []

  @state() private slottedOptions: CollectedOption[] = []

  readonly #internals: ElementInternals

  #slot: HTMLSlotElement | null = null

  #defaultSelections: Map<FdOption, boolean> | null = null

  #defaultOptionSelections: readonly boolean[] | null = null

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
    return this.#resolvedOptions.filter((option) => option.selected).map((option) => option.value)
  }

  override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (
      changed.has('options') &&
      this.options.length > 0 &&
      this.#defaultOptionSelections === null
    ) {
      this.#defaultOptionSelections = this.options.map((option) => option.isSelected === true)
    }
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
    if (this.options.length > 0 && this.#defaultOptionSelections) {
      this.options = this.options.map((option, index) => ({
        ...option,
        isSelected: this.#defaultOptionSelections?.[index] ?? false,
      }))
      this.#syncFormValue()
      return
    }
    if (!this.#defaultSelections) return
    for (const [option, selected] of this.#defaultSelections) option.selected = selected
    if (this.#slot) this.slottedOptions = collectOptions(this.#slot)
    this.#syncFormValue()
  }

  formStateRestoreCallback(state: File | FormData | string | null): void {
    const values =
      state instanceof FormData
        ? new Set(
            state.getAll(this.name).filter((value): value is string => typeof value === 'string'),
          )
        : new Set(typeof state === 'string' ? [state] : [])
    if (this.options.length > 0) {
      this.options = this.options.map((option) => ({
        ...option,
        isSelected: values.has(option.id ?? option.label),
      }))
      return
    }
    for (const option of this.slottedOptions) option.element.selected = values.has(option.value)
    if (this.#slot) this.slottedOptions = collectOptions(this.#slot)
  }

  #onSlotChange = (event: Event): void => {
    this.#slot = event.target as HTMLSlotElement
    this.slottedOptions = collectOptions(this.#slot)
    const currentElements = new Set(this.slottedOptions.map((option) => option.element))
    this.#defaultSelections ??= new Map()
    for (const option of this.#defaultSelections.keys()) {
      if (!currentElements.has(option)) this.#defaultSelections.delete(option)
    }
    for (const option of this.slottedOptions) {
      if (!this.#defaultSelections.has(option.element)) {
        this.#defaultSelections.set(option.element, option.selected)
      }
    }
  }

  #toggle(event: CustomEvent, index: number): void {
    event.stopPropagation()
    const option = this.#resolvedOptions[index]
    if (!option || this.disabled || option.disabled) return

    const selected = event.detail.checked === true
    if (this.options.length > 0) {
      this.options = this.options.map((candidate, candidateIndex) =>
        candidateIndex === index ? { ...candidate, isSelected: selected } : candidate,
      )
    } else if (option.element) {
      option.element.selected = selected
      if (this.#slot) this.slottedOptions = collectOptions(this.#slot)
    }
    this.dispatchEvent(
      new CustomEvent('fd-change', {
        detail: {
          value: option.value,
          selected,
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
        ${this.#resolvedOptions.map(
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

  get #resolvedOptions(): ResolvedMultiSelectOption[] {
    return this.options.length > 0
      ? this.options.map((option) => ({
          value: option.id ?? option.label,
          label: option.label,
          symbol: option.symbol ?? null,
          accent: option.accent ?? null,
          selected: option.isSelected === true,
          disabled: option.isEnabled === false,
          element: null,
        }))
      : this.slottedOptions
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-multi-select': FdMultiSelect
  }
}
