import { type CSSResultGroup, css, html, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { type CollectedOption, collectOptions } from '../../internal/options.js'
import type {
  FdCheckboxContentAlignment,
  FdCheckboxIndicatorPlacement,
  FdCheckboxTruncation,
} from '../checkbox/fd-checkbox.js'
import type {
  FdMultiSelectAxis,
  FdMultiSelectItemWidthPolicy,
} from '../multi-select/fd-multi-select.js'
import '../multi-select/fd-multi-select.js'
import '../option/fd-option.js'
import '../row/fd-row.js'

/**
 * The Preferences row wrapper around `fd-multi-select`.
 *
 * @fires fd-change - `{ value, selected, values }` when one option is toggled.
 * @csspart group - The option container.
 * @csspart option - Each checkbox surface.
 */
@customElement('fd-multi-select-row')
export class FdMultiSelectRow extends FdElement {
  static formAssociated = true

  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        --_control-width: var(--fd-control-width, 300px);
      }

      fd-multi-select {
        width: var(--_control-width);
      }
    `,
  ]

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) caption: string | null = null

  @property({ type: Number, attribute: 'control-width' }) controlWidth = 300

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

  @property({ reflect: true }) truncation: FdCheckboxTruncation = 'end'

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

  get labels(): NodeList {
    return this.#internals.labels
  }

  get values(): string[] {
    return this.options.filter((option) => option.selected).map((option) => option.value)
  }

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    const width =
      Number.isFinite(this.controlWidth) && this.controlWidth > 0 ? this.controlWidth : 300
    this.style.setProperty('--_control-width', `${width}px`)
    this.#syncFormValue()
  }

  #syncFormValue(values = this.values): void {
    const data = new FormData()
    if (this.name && !this.disabled) {
      for (const value of values) data.append(this.name, value)
    }
    this.#internals.setFormValue(data)
  }

  #onSlotChange = (event: Event): void => {
    this.#slot = event.target as HTMLSlotElement
    this.options = collectOptions(this.#slot)
  }

  #onChange = (event: CustomEvent): void => {
    event.stopPropagation()
    if (this.#slot) this.options = collectOptions(this.#slot)
    this.#syncFormValue(event.detail.values ?? this.values)
    this.dispatchEvent(
      new CustomEvent('fd-change', {
        detail: event.detail,
        bubbles: true,
        composed: true,
      }),
    )
  }

  override render() {
    return html`
      <fd-row symbol=${this.symbol ?? ''} label=${this.label} caption=${this.caption ?? ''}>
        <fd-multi-select
          exportparts="group, option, indicator"
          slot="trailing"
          .label=${this.label}
          .axis=${this.axis}
          .itemWidthPolicy=${this.itemWidthPolicy}
          .contentAlignment=${this.contentAlignment}
          .indicatorPlacement=${this.indicatorPlacement}
          .spacing=${this.spacing}
          .maximumItemWidth=${this.maximumItemWidth}
          .truncation=${this.truncation}
          .disabled=${this.disabled}
          @fd-change=${this.#onChange}
        >
          <slot @slotchange=${this.#onSlotChange}></slot>
        </fd-multi-select>
      </fd-row>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-multi-select-row': FdMultiSelectRow
  }
}
