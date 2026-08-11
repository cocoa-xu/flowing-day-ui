import { type CSSResultGroup, css, html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { type CollectedOption, collectOptions } from '../../internal/options.js'
import { textRole } from '../../internal/typography.js'
import '../icon/fd-icon.js'
import '../option/fd-option.js'

export type FdTabsVariant = 'underline' | 'soft-surface'
export type FdTabsSizing = 'equal' | 'fit-content'
export type FdTabsOverflow = 'compress' | 'scroll'
export type FdTabLabelContent = 'text' | 'icon' | 'icon-and-text'
export type FdTabsAlignment = 'leading' | 'center' | 'trailing'

let tabsInstance = 0

/**
 * A content navigation control matching `FlowingTabs`.
 *
 * `fd-option` children define tabs. Content uses a named slot matching each option value.
 * All panels stay mounted so selection is immediate and keyboard focus can activate tabs.
 *
 * @fires fd-change - `{ value: string }` when a tab is selected.
 * @csspart tablist - The tab strip.
 * @csspart tab - A tab button.
 * @csspart panel - A tab panel.
 */
@customElement('fd-tabs')
export class FdTabs extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        min-width: 0;
      }

      .scroller {
        display: flex;
        min-width: 0;
        scrollbar-width: none;
      }

      .scroller::-webkit-scrollbar {
        display: none;
      }

      .scroller[data-overflow='scroll'] {
        overflow-x: auto;
        overscroll-behavior-inline: contain;
      }

      .scroller[data-overflow='compress'] {
        overflow: hidden;
      }

      .scroller[data-strip-alignment='leading'] {
        justify-content: flex-start;
      }

      .scroller[data-strip-alignment='center'] {
        justify-content: center;
      }

      .scroller[data-strip-alignment='trailing'] {
        justify-content: flex-end;
      }

      .tablist {
        display: grid;
        grid-auto-flow: column;
        width: max-content;
        min-width: 0;
      }

      .scroller[data-sizing='equal'][data-overflow='compress'] .tablist {
        width: 100%;
        grid-auto-columns: minmax(0, 1fr);
      }

      .scroller[data-sizing='equal'][data-overflow='scroll'] .tablist {
        grid-auto-columns: 1fr;
      }

      .scroller[data-sizing='fit-content'] .tablist {
        grid-auto-columns: minmax(0, max-content);
      }

      .scroller[data-variant='underline'] {
        padding-inline: 7px;
      }

      .scroller[data-variant='soft-surface'] {
        padding: 8px 8px 9px;
      }

      .scroller[data-variant='soft-surface'] .tablist {
        gap: 4px;
        padding: 4px;
        border: 1px solid var(--_fd-palette-edge);
        border-radius: calc(var(--_fd-metric-control-radius) + 2px);
        background: var(--_fd-surface-canvas);
      }

      .tab {
        ${textRole('selection-label')}
        display: flex;
        min-width: 0;
        padding: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--_fd-palette-muted);
        cursor: pointer;
        transition:
          color var(--_fd-motion-hover) var(--_fd-motion-easing),
          background-color var(--_fd-motion-hover) var(--_fd-motion-easing),
          box-shadow var(--_fd-motion-selection) var(--_fd-motion-easing);
      }

      .tab[disabled] {
        cursor: default;
        opacity: 0.42;
      }

      .tab:not([disabled]):hover,
      .tab[aria-selected='true'] {
        color: var(--_fd-accent-foreground);
      }

      .label {
        display: flex;
        align-items: center;
        min-width: 0;
        gap: 7px;
        overflow: hidden;
        white-space: nowrap;
      }

      .label[data-item-alignment='leading'] {
        justify-content: flex-start;
      }

      .label[data-item-alignment='center'] {
        justify-content: center;
      }

      .label[data-item-alignment='trailing'] {
        justify-content: flex-end;
      }

      .label-text {
        overflow: hidden;
        text-overflow: ellipsis;
      }

      fd-icon {
        width: 11px;
        height: 11px;
        font-size: 11px;
      }

      .tab[data-variant='underline'] {
        flex-direction: column;
        gap: 8px;
        padding: 10px 10px 0;
      }

      .tab[data-variant='underline'] .label {
        width: 100%;
      }

      .indicator {
        width: 100%;
        height: 2px;
        border-radius: 999px;
        background: transparent;
        transition: background-color var(--_fd-motion-selection) var(--_fd-motion-easing);
      }

      .tab[data-variant='underline'][aria-selected='true'] .indicator {
        background: var(--_fd-accent-fill);
      }

      .tab[data-variant='underline']:focus-visible {
        border-radius: var(--_fd-metric-control-radius) var(--_fd-metric-control-radius) 0 0;
        background: var(--_fd-accent-veil);
      }

      .tab[data-variant='soft-surface'] {
        align-items: center;
        height: 30px;
        padding-inline: 10px;
        border-radius: var(--_fd-metric-control-radius);
      }

      .tab[data-variant='soft-surface'] .label {
        width: 100%;
      }

      .tab[data-variant='soft-surface']:not([disabled]):hover {
        background: color-mix(in srgb, var(--_fd-accent-veil) 56%, transparent);
      }

      .tab[data-variant='soft-surface'][aria-selected='true'] {
        background: var(--_fd-accent-veil);
        box-shadow: inset 0 0 0 1px
          color-mix(in srgb, var(--_fd-accent-fill) 13%, transparent);
      }

      .tab[data-variant='soft-surface']:focus-visible {
        box-shadow: inset 0 0 0 1px
          color-mix(in srgb, var(--_fd-accent-fill) 36%, transparent);
      }

      .panel[hidden] {
        display: none;
      }
    `,
  ]

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) value: string | null = null

  @property({ reflect: true }) variant: FdTabsVariant = 'underline'

  @property({ reflect: true }) sizing: FdTabsSizing = 'equal'

  @property({ reflect: true }) overflow: FdTabsOverflow = 'compress'

  @property({ attribute: 'label-content', reflect: true })
  labelContent: FdTabLabelContent = 'icon-and-text'

  @property({ attribute: 'strip-alignment', reflect: true })
  stripAlignment: FdTabsAlignment = 'leading'

  @property({ attribute: 'item-alignment', reflect: true })
  itemAlignment: FdTabsAlignment = 'center'

  @property({ type: Boolean, reflect: true }) disabled = false

  @state() private options: CollectedOption[] = []

  readonly #prefix = `fd-tabs-${++tabsInstance}`

  get selectedIndex(): number {
    return this.options.findIndex((option) => option.value === this.value)
  }

  #onSlotChange = (event: Event): void => {
    this.options = collectOptions(event.target as HTMLSlotElement)
  }

  #select(index: number, moveFocus: boolean): void {
    const option = this.options[index]
    if (!option || this.disabled || option.disabled) return

    if (option.value !== this.value) {
      this.value = option.value
      this.dispatchEvent(
        new CustomEvent('fd-change', {
          detail: { value: option.value },
          bubbles: true,
          composed: true,
        }),
      )
    }

    if (moveFocus) {
      void this.updateComplete.then(() => this.#tabButtons[index]?.focus())
    }
  }

  #onKeydown(event: KeyboardEvent): void {
    if (this.disabled || this.options.length === 0) return

    const isRTL = getComputedStyle(this).direction === 'rtl'
    const current = this.#focusedIndex >= 0 ? this.#focusedIndex : this.selectedIndex
    let destination = -1

    switch (event.key) {
      case 'ArrowLeft':
        destination = this.#nextEnabled(current, isRTL ? 1 : -1)
        break
      case 'ArrowRight':
        destination = this.#nextEnabled(current, isRTL ? -1 : 1)
        break
      case 'Home':
        destination = this.options.findIndex((option) => !option.disabled)
        break
      case 'End':
        destination = this.options.findLastIndex((option) => !option.disabled)
        break
      default:
        return
    }

    if (destination < 0) return
    event.preventDefault()
    this.#select(destination, true)
  }

  #nextEnabled(current: number, offset: number): number {
    let candidate = current >= 0 ? current : offset > 0 ? -1 : 0
    for (let visited = 0; visited < this.options.length; visited += 1) {
      candidate = (candidate + offset + this.options.length) % this.options.length
      if (!this.options[candidate]?.disabled) return candidate
    }
    return -1
  }

  get #focusedIndex(): number {
    const activeElement = this.shadowRoot?.activeElement
    return activeElement instanceof HTMLButtonElement ? this.#tabButtons.indexOf(activeElement) : -1
  }

  get #tabButtons(): HTMLButtonElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLButtonElement>('.tab')]
  }

  #tabLabel(option: CollectedOption) {
    const icon = option.symbol
      ? html`<fd-icon name=${option.symbol} aria-hidden="true"></fd-icon>`
      : nothing
    const text = html`<span class="label-text">${option.label}</span>`

    switch (this.labelContent) {
      case 'text':
        return text
      case 'icon':
        return option.symbol ? icon : text
      case 'icon-and-text':
        return html`${icon}${text}`
    }
  }

  override render() {
    const selectedIndex = this.selectedIndex
    const tabStopIndex =
      selectedIndex >= 0 && !this.options[selectedIndex]?.disabled
        ? selectedIndex
        : this.options.findIndex((option) => !option.disabled)

    return html`
      <div
        class="scroller"
        data-variant=${this.variant}
        data-sizing=${this.sizing}
        data-overflow=${this.overflow}
        data-strip-alignment=${this.stripAlignment}
      >
        <div
          class="tablist"
          part="tablist"
          role="tablist"
          aria-label=${this.label}
          @keydown=${this.#onKeydown}
        >
          ${repeat(
            this.options,
            (option) => option.value,
            (option, index) => {
              const selected = index === selectedIndex
              return html`
                <button
                  class="tab"
                  part="tab"
                  id="${this.#prefix}-tab-${index}"
                  type="button"
                  role="tab"
                  aria-selected=${selected}
                  aria-controls="${this.#prefix}-panel-${index}"
                  tabindex=${index === tabStopIndex ? 0 : -1}
                  title=${option.label}
                  ?disabled=${this.disabled || option.disabled}
                  data-variant=${this.variant}
                  @click=${() => this.#select(index, true)}
                >
                  <span class="label" data-item-alignment=${this.itemAlignment}>
                    ${this.#tabLabel(option)}
                  </span>
                  ${this.variant === 'underline' ? html`<span class="indicator"></span>` : nothing}
                </button>
              `
            },
          )}
        </div>
      </div>

      ${repeat(
        this.options,
        (option) => option.value,
        (option, index) => html`
          <div
            class="panel"
            part="panel"
            id="${this.#prefix}-panel-${index}"
            role="tabpanel"
            aria-labelledby="${this.#prefix}-tab-${index}"
            tabindex="0"
            ?hidden=${index !== selectedIndex}
          >
            <slot name=${option.value}></slot>
          </div>
        `,
      )}

      <slot hidden @slotchange=${this.#onSlotChange}></slot>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-tabs': FdTabs
  }
}
