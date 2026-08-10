import { type CSSResultGroup, css, html, nothing, type PropertyValues } from 'lit'
import { customElement, property, query, state } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { checkmark } from '../../internal/glyphs.js'
import { optionMatches } from '../../internal/option-search.js'
import { type CollectedOption, collectOptions } from '../../internal/options.js'
import { FdStringsRegistry } from '../../internal/strings.js'
import { textRole } from '../../internal/typography.js'
import type { FdTextField } from '../text-field/fd-text-field.js'
import '../option/fd-option.js'
import '../text-field/fd-text-field.js'

const OPTION_SLOT = 34

/**
 * The reusable counterpart to `FlowingSearchPicker`.
 *
 * @fires fd-change - `{ value: string }` when an option is selected.
 * @fires fd-query-change - `{ query: string }` while the search query changes.
 * @csspart search - The search field, forwarded from `fd-text-field`.
 * @csspart option - One option button.
 */
@customElement('fd-search-picker')
export class FdSearchPicker extends FdElement {
  static formAssociated = true

  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
      }

      .empty {
        ${textRole('value')}
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 36px;
        color: var(--_fd-palette-faint);
      }

      .list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        overflow-y: auto;
        overscroll-behavior: contain;
      }

      .option {
        display: flex;
        align-items: center;
        gap: 9px;
        flex: none;
        height: 30px;
        padding-inline: 10px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        font: inherit;
        text-align: start;
        cursor: pointer;
      }

      .option[aria-selected='true'] {
        background: var(--_fd-accent-wash);
      }

      .option:focus-visible {
        outline: 2px solid var(--_fd-accent-fill);
        outline-offset: -2px;
      }

      .option:disabled {
        cursor: default;
        opacity: 0.4;
      }

      .option-label {
        ${textRole('selection-label')}
        flex: 1 1 auto;
        min-width: 0;
        color: var(--_fd-palette-ink);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .option[aria-selected='true'] .option-label {
        color: var(--_fd-accent-foreground);
      }

      .check {
        flex: none;
        width: 10px;
        height: 10px;
        color: var(--_fd-accent-foreground);
        stroke-width: 2.4;
      }
    `,
  ]

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) value: string | null = null

  @property() query = ''

  @property({ type: Number, attribute: 'max-visible-options' }) maxVisibleOptions = 6

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true }) name = ''

  @state() private options: CollectedOption[] = []

  @query('fd-text-field') private searchField!: FdTextField

  readonly #internals: ElementInternals

  #defaultValue: string | null = null

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

  get filteredOptions(): CollectedOption[] {
    return this.options.filter((option) => optionMatches(option.label, this.query))
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#defaultValue = this.value
  }

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.#internals.setFormValue(this.disabled ? null : this.value)
    if (changed.has('value')) this.#revealSelection()
  }

  formResetCallback(): void {
    this.value = this.#defaultValue
    this.query = ''
  }

  formStateRestoreCallback(state: string | null): void {
    this.value = state
  }

  focusSearch(): void {
    this.searchField?.shadowRoot?.querySelector<HTMLInputElement>('input')?.focus()
  }

  #onSlotChange = (event: Event): void => {
    this.options = collectOptions(event.target as HTMLSlotElement)
    void this.updateComplete.then(() => this.#revealSelection())
  }

  #onQueryChange = (event: CustomEvent): void => {
    event.stopPropagation()
    this.#setQuery(event.detail.value ?? '')
  }

  #setQuery(query: string): void {
    this.query = query
    this.dispatchEvent(
      new CustomEvent('fd-query-change', {
        detail: { query: this.query },
        bubbles: true,
        composed: true,
      }),
    )
  }

  #revealSelection(): void {
    const list = this.renderRoot.querySelector('.list')
    const selected = list?.querySelector('.option[aria-selected="true"]')
    if (!list || !selected) return

    const listBox = list.getBoundingClientRect()
    const selectedBox = selected.getBoundingClientRect()
    list.scrollTop += selectedBox.top - listBox.top - (listBox.height - selectedBox.height) / 2
  }

  #onSearchKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const available = this.#optionButtons()
    if (available.length === 0) return
    event.preventDefault()
    available[event.key === 'ArrowDown' ? 0 : available.length - 1]?.focus()
  }

  #onOptionKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const available = this.#optionButtons()
    if (available.length === 0) return
    event.preventDefault()
    const direction = event.key === 'ArrowDown' ? 1 : -1
    const current = available.indexOf(event.currentTarget as HTMLButtonElement)
    available[(current + direction + available.length) % available.length]?.focus()
  }

  #optionButtons(): HTMLButtonElement[] {
    return [
      ...(this.renderRoot.querySelectorAll<HTMLButtonElement>('.option:not(:disabled)') ?? []),
    ]
  }

  #select(option: CollectedOption): void {
    if (this.disabled || option.disabled) return
    this.value = option.value
    this.#setQuery('')
    this.dispatchEvent(
      new CustomEvent('fd-change', {
        detail: { value: option.value },
        bubbles: true,
        composed: true,
      }),
    )
  }

  #renderOption(option: CollectedOption) {
    const selected = option.value === this.value
    return html`
      <button
        class="option"
        part="option"
        type="button"
        role="option"
        aria-selected=${selected}
        ?disabled=${this.disabled || option.disabled}
        @click=${() => this.#select(option)}
        @keydown=${this.#onOptionKeydown}
      >
        <span class="option-label">${option.label}</span>
        ${selected ? html`<span class="check">${checkmark}</span>` : nothing}
      </button>
    `
  }

  override render() {
    const strings = FdStringsRegistry.get()
    const filtered = this.filteredOptions
    const visible = Math.max(Math.floor(this.maxVisibleOptions), 1)
    const listHeight = Math.min(filtered.length, visible) * OPTION_SLOT

    return html`
      <fd-text-field
        exportparts="field: search, icon: search-icon, input: search-input"
        .label=${this.label}
        .placeholder=${strings.search}
        symbol="magnifyingglass"
        emphasis="accented"
        .value=${this.query}
        .disabled=${this.disabled}
        @fd-change=${this.#onQueryChange}
        @keydown=${this.#onSearchKeydown}
      ></fd-text-field>
      ${
        filtered.length === 0
          ? html`<div class="empty">${strings.noResults}</div>`
          : html`
            <div
              class="list"
              role="listbox"
              aria-label=${this.label}
              style="height: ${listHeight}px"
            >
              ${filtered.map((option) => this.#renderOption(option))}
            </div>
          `
      }
      <slot hidden @slotchange=${this.#onSlotChange}></slot>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-search-picker': FdSearchPicker
  }
}
