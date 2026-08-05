import { type CSSResultGroup, css, html, nothing, type PropertyValues } from 'lit'
import { customElement, property, query, state } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { checkmark, chevronDown, chevronUp } from '../../internal/glyphs.js'
import { textRole } from '../../internal/typography.js'
import type { FdOption } from '../option/fd-option.js'
import '../option/fd-option.js'

export interface FdPopupOption {
  value: string
  label: string
}

/** `SettingsPopupMenuView.rowHeight`. */
const ROW_HEIGHT = 36
/** `SettingsPopupMenuView.verticalInset`. */
const VERTICAL_INSET = 8
/** `SettingsPopupButton.controlHeight`. */
const CONTROL_HEIGHT = 30
/** Screen inset and anchor offset from `SettingsPopupButton.position(_:anchorFrame:visibleFrame:)`. */
const MARGIN = 8
const GAP = 6

/**
 * Mirrors `SettingsPopupControl`, the 691 lines of AppKit that back `SettingsPopupRow`.
 *
 * The `NSPanel` and its global event monitors become a Popover API element: the top layer
 * escapes the scroll container exactly as a child window did, and light dismiss plus
 * Escape come from the platform. Placement ports the Swift arithmetic directly — trailing
 * aligned to the anchor, below when it fits and above when it does not, clamped to the
 * viewport by the same 8pt margin and 6pt gap.
 *
 * @fires fd-change - `{ value: string }` when an option is chosen.
 * @csspart button - The closed control.
 * @csspart menu - The popover surface.
 * @csspart option - An option row.
 */
@customElement('fd-popup')
export class FdPopup extends FdElement {
  static formAssociated = true

  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: inline-block;
        /* Contains the measuring spans so they cannot reach an outer scroll area. */
        position: relative;
      }

      .button {
        display: flex;
        align-items: center;
        width: var(--_button-width, auto);
        height: ${CONTROL_HEIGHT}px;
        padding: 0;
        margin: 0;
        border: 0;
        border-radius: var(--_fd-metric-control-radius);
        /*
         * Drawn as an inset shadow rather than a border so the content box still spans
         * the full control, which is what Swift measures its text rect against.
         */
        box-shadow: inset 0 0 0 1px var(--_fd-palette-hairline);
        background: var(--_fd-accent-veil);
        font: inherit;
        cursor: pointer;
        transition: background-color var(--_fd-motion-hover) var(--_fd-motion-easing);
      }

      .button:hover,
      :host([open]) .button {
        background: var(--_fd-accent-wash);
      }

      :host([open]) .button {
        box-shadow: inset 0 0 0 1px
          color-mix(in srgb, var(--_fd-accent-foreground) 22%, transparent);
      }

      .button:focus-visible {
        outline: 2px solid var(--_fd-accent-fill);
        outline-offset: 2px;
      }

      :host([disabled]) .button {
        cursor: default;
        opacity: 0.4;
      }

      /* Swift draws the value into x 10 … width - 39, right aligned. */
      .value {
        ${textRole('value')}
        flex: 1 1 auto;
        min-width: 0;
        margin-inline: 10px 8px;
        color: var(--_fd-accent-foreground);
        text-align: right;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* 9pt glyph whose trailing edge sits 12pt from the control edge. */
      .chevron {
        flex: none;
        width: 9px;
        height: 9px;
        margin-inline-end: 12px;
        color: var(--_fd-palette-faint);
      }

      .menu {
        display: flex;
        flex-direction: column;
        position: fixed;
        inset: auto;
        margin: 0;
        padding: ${VERTICAL_INSET}px 0;
        border: 1px solid color-mix(in srgb, var(--_fd-accent-foreground) 22%, transparent);
        border-radius: 13px;
        /* Swift fills the card, then fills again with accent.fill at 4.5%. */
        background:
          linear-gradient(
            0deg,
            color-mix(in srgb, var(--_fd-accent-fill) 4.5%, transparent) 0 100%
          ),
          var(--_fd-surface-control);
        box-shadow: var(--_fd-menu-shadow);
        overflow-y: auto;
        overscroll-behavior: contain;
      }

      /* The UA hides a closed popover; an author display rule would defeat that. */
      .menu:not(:popover-open) {
        display: none;
      }

      .option {
        display: flex;
        align-items: center;
        flex: none;
        height: ${ROW_HEIGHT - 4}px;
        margin: 2px 8px;
        padding: 0;
        border: 0;
        border-radius: var(--_fd-metric-control-radius);
        background: transparent;
        font: inherit;
        text-align: start;
        cursor: pointer;
      }

      .option[data-highlighted] {
        background: var(--_fd-accent-veil);
      }

      .option[aria-selected='true'] {
        background: var(--_fd-accent-wash);
      }

      /* 22pt badge inset 8pt, with a 10pt checkmark centred inside it. */
      .badge {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: none;
        width: 22px;
        height: 22px;
        margin-inline-start: 8px;
        border-radius: 50%;
        background: var(--_fd-accent-veil);
        color: var(--_fd-accent-foreground);
      }

      .badge svg {
        width: 10px;
        height: 10px;
      }

      /* Swift draws every option title at x 40, badge or not. */
      .option-label {
        ${textRole('selection-label')}
        flex: 1 1 auto;
        min-width: 0;
        margin-inline: 40px 10px;
        color: var(--_fd-palette-ink);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .badge + .option-label {
        margin-inline-start: 10px;
      }

      .option[aria-selected='true'] .option-label {
        color: var(--_fd-accent-foreground);
      }

      .measure {
        position: absolute;
        top: 0;
        left: 0;
        visibility: hidden;
        white-space: pre;
        pointer-events: none;
      }

      .measure-value {
        ${textRole('value')}
      }

      .measure-option {
        ${textRole('selection-label')}
      }
    `,
  ]

  /** Menu contents. Falls back to `fd-option` children when left empty. */
  @property({ attribute: false }) options: FdPopupOption[] = []

  @property({ reflect: true }) value: string | null = null

  /** `SettingsPopupRow.minimumControlWidth`. */
  @property({ type: Number, attribute: 'min-width' }) minWidth = 0

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true }) name = ''

  @property({ type: Boolean, reflect: true }) open = false

  @state() private highlighted: number | null = null

  @state() private slotted: FdPopupOption[] = []

  @query('.menu') private menu!: HTMLElement

  @query('.measure-value') private measureValue!: HTMLElement

  @query('.measure-option') private measureOption!: HTMLElement

  readonly #internals: ElementInternals

  #defaultValue: string | null = null

  #menuWidth = 0

  #resizeObserver: ResizeObserver | null = null

  #measured = false

  constructor() {
    super()
    this.#internals = this.attachInternals()
    this.addEventListener('keydown', this.#onKeydown)
  }

  get form(): HTMLFormElement | null {
    return this.#internals.form
  }

  /** Resolved menu contents, whichever way they were supplied. */
  get resolvedOptions(): FdPopupOption[] {
    return this.options.length > 0 ? this.options : this.slotted
  }

  get selectedIndex(): number {
    return this.resolvedOptions.findIndex((option) => option.value === this.value)
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#defaultValue = this.value
    window.addEventListener('resize', this.dismiss)
    window.addEventListener('scroll', this.dismiss, { capture: true, passive: true })

    // A popup on an inactive fd-page renders inside display: none, where text measures
    // zero. This catches the moment it is laid out for the first time, then stands down.
    // Measuring resizes the host, so the write is deferred out of the observation cycle
    // — writing inline would leave the observer reporting an undelivered loop.
    this.#resizeObserver = new ResizeObserver(() => {
      if (this.#measured) return
      requestAnimationFrame(() => {
        if (!this.#measured) this.#applyWidths()
      })
    })
    this.#resizeObserver.observe(this)
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    window.removeEventListener('resize', this.dismiss)
    window.removeEventListener('scroll', this.dismiss, { capture: true })
    this.#resizeObserver?.disconnect()
    this.#resizeObserver = null
  }

  override firstUpdated(changed: PropertyValues<this>): void {
    super.firstUpdated(changed)
    // Widths come from rendered text, so a late-loading face has to retrigger them.
    document.fonts?.ready.then(() => this.#applyWidths())
  }

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.#internals.setFormValue(this.value)
    this.#applyWidths()
    // `configure` dismisses an open menu whenever the option list changes underneath it.
    if (changed.has('options')) {
      this.#measured = false
      this.dismiss()
    }
  }

  formResetCallback(): void {
    this.value = this.#defaultValue
  }

  formStateRestoreCallback(state: string | null): void {
    this.value = state
  }

  /** Closes the menu, as scrolling and resizing do in the SwiftUI original. */
  dismiss = (): void => {
    if (this.open) this.menu?.hidePopover()
  }

  #onSlotChange = (event: Event): void => {
    // Flattened, because `fd-popup-row` forwards its own slot into this one.
    this.#measured = false
    this.slotted = (event.target as HTMLSlotElement)
      .assignedElements({ flatten: true })
      .filter((element): element is FdOption => element.localName === 'fd-option')
      .map((element) => ({ value: element.value, label: element.optionLabel }))
    this.dismiss()
  }

  /**
   * `intrinsicContentSize` measures every label, not just the selected one, so the
   * control does not resize as the selection changes.
   */
  #applyWidths(): void {
    if (!this.measureValue) return
    const labels = this.resolvedOptions.map((option) => option.label)
    // Options arrive on slotchange, a frame after the first render.
    if (labels.length === 0) return

    const widest = (element: HTMLElement) => {
      let max = 0
      for (const label of labels) {
        element.textContent = label
        max = Math.max(max, element.getBoundingClientRect().width)
      }
      element.textContent = ''
      return Math.ceil(max)
    }

    const textWidth = widest(this.measureValue)
    // Zero for a non-empty label means nothing is laid out yet — an unrendered subtree.
    // Leaving the property unset lets the control size to its content until it is.
    if (textWidth === 0 && labels.some((label) => label.length > 0)) return

    // Writing an unchanged value would resize the host again and leave the observer
    // looping for another frame.
    const width = `${Math.max(this.minWidth, textWidth + 40)}px`
    if (this.style.getPropertyValue('--_button-width') !== width) {
      this.style.setProperty('--_button-width', width)
    }
    this.#menuWidth = widest(this.measureOption) + 68
    this.#measured = true
  }

  /**
   * State lands here rather than in `toggle`, which the platform queues as a task:
   * `beforetoggle` is synchronous, so the chevron and border flip in the same frame as
   * the click, and placement is settled before the popover paints.
   */
  #onBeforeToggle = (event: ToggleEvent): void => {
    this.open = event.newState === 'open'
    if (!this.open) {
      this.highlighted = null
      return
    }
    this.highlighted = this.selectedIndex >= 0 ? this.selectedIndex : 0
    this.#position()
  }

  /** Ports `SettingsPopupButton.position(_:anchorFrame:visibleFrame:)` into viewport space. */
  #position(): void {
    const anchor = this.getBoundingClientRect()
    const viewportWidth = document.documentElement.clientWidth
    const viewportHeight = document.documentElement.clientHeight

    const width = Math.min(Math.max(anchor.width, this.#menuWidth), viewportWidth - MARGIN * 2)
    const height = Math.min(
      this.resolvedOptions.length * ROW_HEIGHT + VERTICAL_INSET * 2,
      viewportHeight - MARGIN * 2,
    )

    const left = Math.min(Math.max(anchor.right - width, MARGIN), viewportWidth - width - MARGIN)
    const below = anchor.bottom + GAP
    const fitsBelow = below + height <= viewportHeight - MARGIN
    const top = Math.min(
      fitsBelow ? below : Math.max(anchor.top - GAP - height, MARGIN),
      viewportHeight - height - MARGIN,
    )

    Object.assign(this.menu.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    })
  }

  #move(offset: number): void {
    const count = this.resolvedOptions.length
    if (count === 0) return
    const current = this.highlighted ?? (this.selectedIndex >= 0 ? this.selectedIndex : 0)
    this.highlighted = (current + offset + count) % count
  }

  #select(index: number): void {
    const option = this.resolvedOptions[index]
    if (!option) return
    this.dismiss()
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
    if (this.disabled) return

    if (!this.open) {
      if (event.key !== 'ArrowDown') return
      event.preventDefault()
      this.menu.showPopover()
      return
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        this.#move(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        this.#move(-1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (this.highlighted !== null) this.#select(this.highlighted)
        break
      default:
        break
    }
  }

  override render() {
    const options = this.resolvedOptions
    const selected = this.selectedIndex
    const menuId = 'menu'

    return html`
      <button
        class="button"
        part="button"
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded=${this.open}
        aria-controls=${menuId}
        aria-activedescendant=${
          this.open && this.highlighted !== null ? `option-${this.highlighted}` : nothing
        }
        ?disabled=${this.disabled}
        popovertarget=${menuId}
      >
        <span class="value" part="value">${options[selected]?.label ?? '—'}</span>
        <span class="chevron">${this.open ? chevronUp : chevronDown}</span>
      </button>

      <div
        class="menu"
        part="menu"
        id=${menuId}
        popover="auto"
        role="listbox"
        @beforetoggle=${this.#onBeforeToggle}
      >
        ${repeat(
          options,
          (option) => option.value,
          (option, index) => html`
            <button
              class="option"
              part="option"
              type="button"
              id="option-${index}"
              role="option"
              aria-selected=${index === selected}
              ?data-highlighted=${index === this.highlighted}
              @click=${() => this.#select(index)}
              @pointerenter=${() => {
                this.highlighted = index
              }}
            >
              ${index === selected ? html`<span class="badge">${checkmark}</span>` : nothing}
              <span class="option-label">${option.label}</span>
            </button>
          `,
        )}
      </div>

      <span class="measure measure-value" aria-hidden="true"></span>
      <span class="measure measure-option" aria-hidden="true"></span>
      <slot hidden @slotchange=${this.#onSlotChange}></slot>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-popup': FdPopup
  }
}
