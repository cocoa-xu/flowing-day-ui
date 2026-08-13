import { type CSSResultGroup, css, html, type PropertyValues } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import { styleMap } from 'lit/directives/style-map.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { type FdEdge, type FdEdgeInsets, positionOverlay } from '../../internal/overlay-position.js'

const POPOVER_GAP = 8
const POPOVER_MARGIN = 8

/**
 * An interactive top-layer popover with an application-provided trigger and content.
 *
 * @slot trigger - The interactive element that opens the popover.
 * @slot - Popover content.
 * @fires fd-open - After the popover opens.
 * @fires fd-close - After the popover closes.
 * @csspart surface - The top-layer surface.
 */
@customElement('fd-popover')
export class FdPopover extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: inline-block;
      }

      .surface {
        position: fixed;
        inset: auto;
        margin: 0;
        padding: 0;
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
    `,
  ]

  @property({ reflect: true, attribute: 'accessibility-label' }) accessibilityLabel = ''

  @property({ reflect: true, attribute: 'arrow-edge' }) arrowEdge: FdEdge = 'top'

  @property({ type: Number, attribute: 'minimum-width' }) minimumWidth = 220

  @property({ type: Number, attribute: 'maximum-width' }) maximumWidth = 320

  @property({ attribute: false }) contentInsets: FdEdgeInsets = {
    top: 13,
    leading: 13,
    bottom: 13,
    trailing: 13,
  }

  @property({ type: Boolean, reflect: true }) open = false

  @query('.surface') private surface!: HTMLElement

  #trigger: HTMLElement | null = null

  #triggerAttributes: {
    expanded: string | null
    hasPopup: string | null
    label: string | null
  } | null = null

  #openListeners: AbortController | null = null

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (changed.has('open')) this.#synchronizePresentation()
    if (changed.has('accessibilityLabel')) this.#updateTrigger()
    if (
      this.open &&
      (changed.has('arrowEdge') ||
        changed.has('minimumWidth') ||
        changed.has('maximumWidth') ||
        changed.has('contentInsets'))
    ) {
      this.#position()
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#stopOpenListeners()
    if (this.surface?.matches(':popover-open')) this.surface.hidePopover()
    this.#restoreTrigger()
  }

  show(): void {
    this.open = true
  }

  hide(): void {
    this.open = false
  }

  toggle(): void {
    this.open = !this.open
  }

  #onTriggerSlotChange = (event: Event): void => {
    this.#restoreTrigger()
    this.#trigger =
      (event.target as HTMLSlotElement)
        .assignedElements({ flatten: true })
        .find((element): element is HTMLElement => element instanceof HTMLElement) ?? null
    if (this.#trigger) {
      this.#triggerAttributes = {
        expanded: this.#trigger.getAttribute('aria-expanded'),
        hasPopup: this.#trigger.getAttribute('aria-haspopup'),
        label: this.#trigger.getAttribute('aria-label'),
      }
    }
    this.#updateTrigger()
  }

  #restoreTrigger(): void {
    if (!this.#trigger || !this.#triggerAttributes) return
    this.#restoreAttribute('aria-expanded', this.#triggerAttributes.expanded)
    this.#restoreAttribute('aria-haspopup', this.#triggerAttributes.hasPopup)
    this.#restoreAttribute('aria-label', this.#triggerAttributes.label)
    this.#triggerAttributes = null
  }

  #restoreAttribute(name: string, value: string | null): void {
    if (!this.#trigger) return
    if (value === null) {
      this.#trigger.removeAttribute(name)
    } else {
      this.#trigger.setAttribute(name, value)
    }
  }

  #updateTrigger(): void {
    if (!this.#trigger) return
    this.#trigger.setAttribute('aria-haspopup', 'dialog')
    this.#trigger.setAttribute('aria-expanded', String(this.open))
    if (this.#triggerAttributes?.label === null) {
      if (this.accessibilityLabel) {
        this.#trigger.setAttribute('aria-label', this.accessibilityLabel)
      } else {
        this.#trigger.removeAttribute('aria-label')
      }
    }
  }

  #onTriggerClick = (): void => {
    if (this.open) {
      this.hide()
      return
    }
    window.setTimeout(() => {
      if (this.isConnected) this.show()
    })
  }

  #synchronizePresentation(): void {
    if (!this.surface) return
    const isOpen = this.surface.matches(':popover-open')
    if (this.open === isOpen) {
      this.#updateTrigger()
      return
    }

    if (this.open) {
      this.surface.style.visibility = 'hidden'
      const showPopover = this.surface.showPopover as unknown as (options?: {
        source?: HTMLElement
      }) => void
      showPopover.call(this.surface, this.#trigger ? { source: this.#trigger } : undefined)
      this.#position()
      this.surface.style.visibility = 'visible'
      this.#startOpenListeners()
    } else {
      this.surface.hidePopover()
    }
    this.#updateTrigger()
  }

  #position(): void {
    if (!this.#trigger || !this.surface?.matches(':popover-open')) return
    const position = positionOverlay(
      this.#trigger.getBoundingClientRect(),
      this.surface.getBoundingClientRect(),
      {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
      },
      this.arrowEdge,
      POPOVER_GAP,
      POPOVER_MARGIN,
      getComputedStyle(this).direction === 'rtl',
    )
    this.surface.style.left = `${position.left}px`
    this.surface.style.top = `${position.top}px`
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

  #onToggle = (event: ToggleEvent): void => {
    const nextOpen = event.newState === 'open'
    if (this.open !== nextOpen) this.open = nextOpen
    this.#updateTrigger()
    if (nextOpen) {
      this.#startOpenListeners()
      this.dispatchEvent(new CustomEvent('fd-open', { bubbles: true, composed: true }))
    } else {
      this.#stopOpenListeners()
      this.dispatchEvent(
        new CustomEvent('fd-close', {
          bubbles: true,
          composed: true,
        }),
      )
    }
  }

  override render() {
    const minimumWidth = Math.max(0, Number.isFinite(this.minimumWidth) ? this.minimumWidth : 0)
    const maximumWidth = Math.max(
      minimumWidth,
      Number.isFinite(this.maximumWidth) ? this.maximumWidth : minimumWidth,
    )
    const inset = (value: number): number => (Number.isFinite(value) ? Math.max(0, value) : 0)

    return html`
      <slot name="trigger" @click=${this.#onTriggerClick} @slotchange=${this.#onTriggerSlotChange}></slot>
      <div
        class="surface"
        part="surface"
        popover="auto"
        role="dialog"
        aria-label=${this.accessibilityLabel}
        style=${styleMap({
          'min-width': `${minimumWidth}px`,
          'max-width': `${maximumWidth}px`,
          'max-height': `calc(100dvh - ${POPOVER_MARGIN * 2}px)`,
          'padding-block-start': `${inset(this.contentInsets.top)}px`,
          'padding-inline-start': `${inset(this.contentInsets.leading)}px`,
          'padding-block-end': `${inset(this.contentInsets.bottom)}px`,
          'padding-inline-end': `${inset(this.contentInsets.trailing)}px`,
        })}
        @toggle=${this.#onToggle}
      >
        <slot></slot>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-popover': FdPopover
  }
}
