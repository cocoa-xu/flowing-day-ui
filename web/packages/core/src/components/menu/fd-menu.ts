import { css, html, type PropertyValues } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import { styleMap } from 'lit/directives/style-map.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { chevronDown } from '../../internal/glyphs.js'
import { positionOverlay } from '../../internal/overlay-position.js'
import { textRole } from '../../internal/typography.js'
import '../icon/fd-icon.js'

const MENU_GAP = 5
const MENU_MARGIN = 8

@customElement('fd-menu')
export class FdMenu extends FdElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: inline-block;
      }

      :host([fills-available-width]) {
        display: block;
      }

      .trigger {
        ${textRole('button-label')}
        display: flex;
        width: 100%;
        height: 29px;
        align-items: center;
        gap: 7px;
        padding: 0 10px;
        border: 1px solid color-mix(in srgb, var(--_fd-accent-foreground) 16%, transparent);
        border-radius: var(--_fd-metric-control-radius);
        outline: 0;
        background: var(--_fd-accent-veil);
        color: var(--_fd-accent-foreground);
        cursor: default;
      }

      .trigger:hover:not(:disabled) {
        background: var(--_fd-accent-wash);
      }

      .leading-icon {
        width: 11px;
        height: 11px;
        flex: none;
        font-size: 11px;
      }

      .title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .spacer {
        min-width: 4px;
        flex: 1 1 auto;
      }

      .chevron {
        width: 8px;
        height: 8px;
        flex: none;
      }

      .chevron svg {
        width: 100%;
        height: 100%;
      }

      .surface {
        position: fixed;
        inset: auto;
        margin: 0;
        padding: 5px;
        border: 1px solid var(--_fd-palette-edge);
        border-radius: calc(var(--_fd-metric-control-radius) + 4px);
        outline: 0;
        background: var(--_fd-surface-canvas);
        box-shadow: var(--_fd-menu-shadow);
        color: var(--_fd-palette-ink);
        overflow: auto;
        overscroll-behavior: contain;
      }

      .surface:not(:popover-open) {
        display: none;
      }

      ::slotted(button),
      ::slotted([role='menuitem']) {
        ${textRole('selection-label')}
        display: flex;
        width: 100%;
        min-height: 28px;
        align-items: center;
        padding: 5px 9px;
        border: 0;
        border-radius: calc(var(--_fd-metric-control-radius) - 2px);
        outline: 0;
        background: transparent;
        color: var(--_fd-palette-ink);
        cursor: default;
        text-align: start;
      }

      ::slotted(button:hover:not(:disabled)),
      ::slotted([role='menuitem']:hover:not([aria-disabled='true'])),
      ::slotted(button:focus-visible),
      ::slotted([role='menuitem']:focus-visible) {
        background: var(--_fd-accent-veil);
        color: var(--_fd-accent-foreground);
      }

      :host([disabled]) {
        opacity: 0.42;
      }
    `,
  ]

  @property({ attribute: 'title-text' }) override title = ''

  @property({ reflect: true }) symbol: string | null = null

  @property({ type: Number, attribute: 'minimum-width' }) minimumWidth = 0

  @property({ type: Boolean, attribute: 'fills-available-width', reflect: true })
  fillsAvailableWidth = false

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ type: Boolean, reflect: true }) open = false

  @query('.trigger') private trigger!: HTMLButtonElement

  @query('.surface') private surface!: HTMLElement

  #openListeners: AbortController | null = null

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (changed.has('open')) this.#synchronizePresentation()
    if (this.open && changed.has('minimumWidth')) this.#position()
  }

  override disconnectedCallback(): void {
    this.#stopOpenListeners()
    if (this.surface?.matches(':popover-open')) this.surface.hidePopover()
    super.disconnectedCallback()
  }

  show(): void {
    if (!this.disabled) this.open = true
  }

  hide(): void {
    this.open = false
  }

  toggle(): void {
    this.open ? this.hide() : this.show()
  }

  override render() {
    const minimumWidth = Math.max(0, Number.isFinite(this.minimumWidth) ? this.minimumWidth : 0)
    return html`
      <button
        class="trigger"
        part="trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded=${String(this.open)}
        aria-label=${this.title}
        title=${this.title}
        style=${styleMap({ 'min-width': `${minimumWidth}px` })}
        ?disabled=${this.disabled}
        @click=${this.toggle}
        @keydown=${this.#handleTriggerKeyDown}
      >
        ${
          this.symbol
            ? html`<fd-icon class="leading-icon" name=${this.symbol} part="icon"></fd-icon>`
            : null
        }
        <span class="title">${this.title}</span>
        <span class="spacer"></span>
        <span class="chevron">${chevronDown}</span>
      </button>
      <div
        class="surface"
        part="surface"
        popover="auto"
        role="menu"
        aria-label=${this.title}
        @click=${this.#handleMenuClick}
        @keydown=${this.#handleMenuKeyDown}
        @toggle=${this.#handleNativeToggle}
      >
        <slot @slotchange=${this.#prepareItems}></slot>
      </div>
    `
  }

  #synchronizePresentation(): void {
    if (!this.surface) return
    const isOpen = this.surface.matches(':popover-open')
    if (this.open === isOpen) return
    if (this.open) {
      this.surface.style.visibility = 'hidden'
      this.surface.showPopover()
      this.#position()
      this.surface.style.visibility = 'visible'
      this.#startOpenListeners()
      queueMicrotask(() => this.#menuItems()[0]?.focus())
    } else {
      this.surface.hidePopover()
    }
  }

  #position(): void {
    if (!this.surface?.matches(':popover-open')) return
    const position = positionOverlay(
      this.trigger.getBoundingClientRect(),
      this.surface.getBoundingClientRect(),
      {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
      },
      'bottom',
      MENU_GAP,
      MENU_MARGIN,
      getComputedStyle(this).direction === 'rtl',
    )
    this.surface.style.left = `${position.left}px`
    this.surface.style.top = `${position.top}px`
    this.surface.style.minWidth = `${Math.max(this.minimumWidth, this.trigger.offsetWidth)}px`
    this.surface.style.maxHeight = `calc(100dvh - ${MENU_MARGIN * 2}px)`
  }

  #prepareItems = (): void => {
    for (const item of this.#menuItems()) {
      if (!item.hasAttribute('role')) item.setAttribute('role', 'menuitem')
      item.tabIndex = -1
    }
  }

  #menuItems(): HTMLElement[] {
    const slot = this.shadowRoot?.querySelector('slot')
    return (
      slot
        ?.assignedElements({ flatten: true })
        .filter(
          (element): element is HTMLElement =>
            element instanceof HTMLElement &&
            !element.hasAttribute('disabled') &&
            element.getAttribute('aria-disabled') !== 'true',
        ) ?? []
    )
  }

  #handleTriggerKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    this.show()
  }

  #handleMenuClick = (event: Event): void => {
    const item = event
      .composedPath()
      .find(
        (candidate): candidate is HTMLElement =>
          candidate instanceof HTMLElement && candidate.getAttribute('role') === 'menuitem',
      )
    if (item && !item.hasAttribute('disabled') && item.getAttribute('aria-disabled') !== 'true') {
      this.hide()
      this.trigger.focus()
    }
  }

  #handleMenuKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      this.hide()
      this.trigger.focus()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const items = this.#menuItems()
    if (items.length === 0) return
    event.preventDefault()
    const current = items.indexOf(document.activeElement as HTMLElement)
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (Math.max(0, current) + (event.key === 'ArrowDown' ? 1 : -1) + items.length) %
            items.length
    items[next]?.focus()
  }

  #handleNativeToggle = (event: ToggleEvent): void => {
    const nextOpen = event.newState === 'open'
    if (this.open !== nextOpen) this.open = nextOpen
    if (nextOpen) {
      this.#startOpenListeners()
      this.dispatchEvent(new CustomEvent('fd-open', { bubbles: true, composed: true }))
    } else {
      this.#stopOpenListeners()
      this.dispatchEvent(new CustomEvent('fd-close', { bubbles: true, composed: true }))
    }
  }

  #startOpenListeners(): void {
    this.#stopOpenListeners()
    this.#openListeners = new AbortController()
    const { signal } = this.#openListeners
    window.addEventListener('resize', this.#positionOnResize, { signal, passive: true })
    window.addEventListener('scroll', this.#hideOnScroll, { signal, capture: true, passive: true })
  }

  #stopOpenListeners(): void {
    this.#openListeners?.abort()
    this.#openListeners = null
  }

  #positionOnResize = (): void => this.#position()

  #hideOnScroll = (): void => this.hide()
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-menu': FdMenu
  }
}
