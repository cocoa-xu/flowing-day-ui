import { type CSSResultGroup, css, html, nothing, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { checkmark, chevron, magnifyingGlass } from '../../internal/glyphs.js'
import { middleTruncated, middleTruncateStyles } from '../../internal/middle-truncate.js'
import { optionMatches } from '../../internal/option-search.js'
import { type CollectedOption, collectOptions } from '../../internal/options.js'
import { rowLayoutStyles } from '../../internal/row-layout.js'
import { FdStringsRegistry } from '../../internal/strings.js'
import { textRole } from '../../internal/typography.js'
import '../icon/fd-icon.js'
import '../option/fd-option.js'
import '../separator/fd-separator.js'

/** `SettingsSearchPickerRow.optionListHeight` counts 34 per visible option. */
const OPTION_SLOT = 34

/**
 * Mirrors `SettingsSearchPickerRow`: a row that expands into a search field over a
 * scrollable, checkable option list — the picker for a list too long for a popup menu.
 *
 * Options are `fd-option` children, the same as every other selection control takes.
 * The reveal animates `grid-template-rows`, which is the one technique that animates to
 * an unknown content height in every current browser.
 *
 * @fires fd-change - `{ value: string }` when an option is chosen.
 * @csspart row - The header button.
 * @csspart search - The search field.
 * @csspart option - One option in the list.
 */
@customElement('fd-search-picker-row')
export class FdSearchPickerRow extends FdElement {
  static formAssociated = true

  static override styles: CSSResultGroup = [
    baseStyles,
    rowLayoutStyles,
    middleTruncateStyles,
    css`
      .row {
        width: 100%;
        border: 0;
        background: transparent;
        font: inherit;
        text-align: start;
        cursor: pointer;
      }

      .row:focus-visible {
        outline: 2px solid var(--_fd-accent-fill);
        outline-offset: -2px;
      }

      .selected {
        ${textRole('value')}
        flex: 0 1 auto;
        color: var(--_fd-accent-foreground);
      }

      /* Image(systemName: "chevron.down").font(.system(size: 9, weight: .semibold)) */
      .chevron {
        flex: none;
        width: 9px;
        height: 9px;
        color: var(--_fd-palette-faint);
        transition: rotate var(--_fd-motion-expand) var(--_fd-motion-easing);
      }

      :host([expanded]) .chevron {
        rotate: 180deg;
      }

      .reveal {
        display: grid;
        grid-template-rows: 0fr;
        transition: grid-template-rows var(--_fd-motion-expand) var(--_fd-motion-easing);
      }

      :host([expanded]) .reveal {
        grid-template-rows: 1fr;
      }

      /* The .clipped() that keeps the picker from spilling out mid-collapse. */
      .clip {
        min-height: 0;
        overflow: hidden;
      }

      /* .transition(.opacity) */
      .picker {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-inline: var(--_fd-metric-row-inset);
        padding-block: 12px;
        opacity: 0;
        transition: opacity var(--_fd-motion-expand) var(--_fd-motion-easing);
      }

      :host([expanded]) .picker {
        opacity: 1;
      }

      .search {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 30px;
        padding-inline: 10px;
        border-radius: 8px;
        background: var(--_fd-accent-veil);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--_fd-accent-fill) 16%, transparent);
      }

      .search-icon {
        flex: none;
        width: 11px;
        height: 11px;
        color: color-mix(in srgb, var(--_fd-accent-foreground) 72%, transparent);
      }

      .query {
        ${textRole('value')}
        flex: 1 1 auto;
        min-width: 0;
        border: 0;
        padding: 0;
        background: transparent;
        color: var(--_fd-palette-ink);
      }

      .query:focus {
        outline: none;
      }

      .query::placeholder {
        color: var(--_fd-palette-faint);
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

      /* Spacer(minLength: 8) before the checkmark. */
      .option-spacer {
        flex: none;
        width: 8px;
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

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) caption: string | null = null

  @property({ reflect: true }) value: string | null = null

  @property({ type: Boolean, reflect: true }) expanded = false

  /** `SettingsSearchPickerRow.maximumVisibleOptions`, floored at 1 as the SwiftUI init is. */
  @property({ type: Number, attribute: 'max-visible-options' }) maxVisibleOptions = 6

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true }) name = ''

  @state() private query = ''

  @state() private options: CollectedOption[] = []

  readonly #internals: ElementInternals

  #defaultValue: string | null = null

  constructor() {
    super()
    this.#internals = this.attachInternals()
  }

  get form(): HTMLFormElement | null {
    return this.#internals.form
  }

  /** The options left after the query, as `filteredOptions` computes them. */
  get filteredOptions(): CollectedOption[] {
    return this.options.filter((option) => optionMatches(option.label, this.query))
  }

  /** `selectedLabel`, which falls back to an em dash. */
  get selectedLabel(): string {
    return this.options.find((option) => option.value === this.value)?.label ?? '—'
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#defaultValue = this.value
  }

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.#internals.setFormValue(this.value)
    // onAppear { proxy.scrollTo(selection, anchor: .center) }
    if (changed.get('expanded') === false && this.expanded) this.#revealSelection()
  }

  formResetCallback(): void {
    this.value = this.#defaultValue
  }

  formStateRestoreCallback(state: string | null): void {
    this.value = state
  }

  #revealSelection(): void {
    this.renderRoot
      .querySelector('.option[aria-selected="true"]')
      ?.scrollIntoView({ block: 'center' })
  }

  #onSlotChange = (event: Event): void => {
    this.options = collectOptions(event.target as HTMLSlotElement)
  }

  /** The header clears the query on the way closed, as the SwiftUI button does. */
  #toggle = (): void => {
    if (this.disabled) return
    this.expanded = !this.expanded
    if (!this.expanded) this.query = ''
  }

  #onQuery = (event: Event): void => {
    this.query = (event.target as HTMLInputElement).value
  }

  #select(option: CollectedOption): void {
    this.value = option.value
    this.query = ''
    this.expanded = false
    this.dispatchEvent(
      new CustomEvent('fd-change', {
        detail: { value: option.value },
        bubbles: true,
        composed: true,
      }),
    )
  }

  #renderOption(option: CollectedOption) {
    const strings = FdStringsRegistry.get()
    const isSelected = option.value === this.value

    return html`
      <button
        class="option"
        part="option"
        type="button"
        role="option"
        aria-selected=${isSelected}
        aria-label="${option.label}, ${isSelected ? strings.selected : strings.notSelected}"
        ?disabled=${option.disabled}
        @click=${() => this.#select(option)}
      >
        <span class="option-label">${option.label}</span>
        <span class="option-spacer"></span>
        ${isSelected ? html`<span class="check">${checkmark}</span>` : nothing}
      </button>
    `
  }

  override render() {
    const strings = FdStringsRegistry.get()
    const filtered = this.filteredOptions
    const visible = Math.max(this.maxVisibleOptions, 1)
    const listHeight = Math.min(filtered.length, visible) * OPTION_SLOT

    return html`
      <button
        class="row"
        part="row"
        type="button"
        aria-expanded=${this.expanded}
        aria-label="${this.label}, ${this.selectedLabel}"
        ?data-caption=${!!this.caption}
        ?disabled=${this.disabled}
        @click=${this.#toggle}
      >
        ${this.symbol ? html`<fd-icon class="symbol" name=${this.symbol}></fd-icon>` : nothing}
        <span class="text">
          <span class="label">${this.label}</span>
          ${this.caption ? html`<span class="caption">${this.caption}</span>` : nothing}
        </span>
        <span class="spacer"></span>
        <span class="selected truncate">${middleTruncated(this.selectedLabel)}</span>
        <span class="chevron">${chevron(false)}</span>
      </button>

      <div class="reveal">
        <div class="clip">
          <fd-separator></fd-separator>
          <div class="picker">
            <div class="search" part="search">
              <span class="search-icon">${magnifyingGlass}</span>
              <input
                class="query"
                type="text"
                autocomplete="off"
                placeholder=${strings.search}
                aria-label=${strings.search}
                .value=${this.query}
                @input=${this.#onQuery}
              />
            </div>
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
          </div>
        </div>
      </div>

      <slot hidden @slotchange=${this.#onSlotChange}></slot>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-search-picker-row': FdSearchPickerRow
  }
}
