import { type CSSResultGroup, css, html, type PropertyValues } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { type FdEdge, positionOverlay } from '../../internal/overlay-position.js'
import '../tooltip-content/fd-tooltip-content.js'

const DEFAULT_TOOLTIP_DELAY = 0.65
const TOOLTIP_GAP = 7
const TOOLTIP_MARGIN = 8
let tooltipInstance = 0

/**
 * A brief, noninteractive top-layer description for a control.
 *
 * Use `fd-popover` when the floating content contains actions or editable controls.
 *
 * @slot trigger - The control described by the tooltip.
 * @slot - Custom tooltip content. Falls back to `text`.
 * @csspart surface - The tooltip surface.
 */
@customElement('fd-tooltip')
export class FdTooltip extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: inline-block;
      }

      .surface {
        position: fixed;
        inset: auto;
        max-width: 260px;
        margin: 0;
        padding: 0;
        border: 1px solid var(--_fd-palette-edge);
        border-radius: calc(var(--_fd-metric-control-radius) + 2px);
        background: var(--_fd-surface-control);
        box-shadow: var(--_fd-menu-shadow);
        color: var(--_fd-palette-muted);
        pointer-events: none;
      }

      .surface:not(:popover-open) {
        display: none;
      }

    `,
  ]

  static readonly defaultDelay = DEFAULT_TOOLTIP_DELAY

  @property({ reflect: true, attribute: 'accessibility-text' }) accessibilityText = ''

  @property({ reflect: true }) message = ''

  @property({ reflect: true }) override title = ''

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true, attribute: 'arrow-edge' }) arrowEdge: FdEdge = 'top'

  @property({ type: Number }) delay = DEFAULT_TOOLTIP_DELAY

  @property({ type: Boolean, reflect: true }) open = false

  @query('.surface') private surface!: HTMLElement

  #trigger: HTMLElement | null = null

  #triggerDescribedBy: string | null = null

  #timer: number | null = null

  #openListeners: AbortController | null = null

  readonly #surfaceID = `fd-tooltip-${++tooltipInstance}`

  constructor() {
    super()
    this.addEventListener('pointerenter', this.#onEnter)
    this.addEventListener('pointerleave', this.#onLeave)
    this.addEventListener('focusin', this.#onEnter)
    this.addEventListener('focusout', this.#onFocusOut)
    this.addEventListener('keydown', this.#onKeydown)
  }

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (changed.has('open')) this.#synchronizePresentation()
    if (this.open && changed.has('arrowEdge')) this.#position()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#cancelTimer()
    this.#stopOpenListeners()
    if (this.surface?.matches(':popover-open')) this.surface.hidePopover()
    this.#restoreTriggerDescription()
  }

  #onTriggerSlotChange = (event: Event): void => {
    this.#restoreTriggerDescription()
    this.#trigger =
      (event.target as HTMLSlotElement)
        .assignedElements({ flatten: true })
        .find((element): element is HTMLElement => element instanceof HTMLElement) ?? null
    this.#triggerDescribedBy = this.#trigger?.getAttribute('aria-describedby') ?? null
    this.#updateTriggerDescription()
  }

  #restoreTriggerDescription(): void {
    if (!this.#trigger) return
    if (this.#triggerDescribedBy === null) {
      this.#trigger.removeAttribute('aria-describedby')
    } else {
      this.#trigger.setAttribute('aria-describedby', this.#triggerDescribedBy)
    }
    this.#triggerDescribedBy = null
  }

  #updateTriggerDescription(): void {
    if (!this.#trigger) return
    const references = new Set(this.#triggerDescribedBy?.split(/\s+/).filter(Boolean) ?? [])
    references.add(this.#surfaceID)
    this.#trigger.setAttribute('aria-describedby', [...references].join(' '))
  }

  #onEnter = (): void => {
    this.#cancelTimer()
    const delay = Number.isFinite(this.delay) ? Math.max(0, this.delay) : DEFAULT_TOOLTIP_DELAY
    this.#timer = window.setTimeout(() => {
      this.#timer = null
      this.open = true
    }, delay * 1_000)
  }

  #onLeave = (): void => {
    this.#cancelTimer()
    this.open = false
  }

  #onFocusOut = (event: FocusEvent): void => {
    if (event.relatedTarget instanceof Node && this.contains(event.relatedTarget)) return
    this.#onLeave()
  }

  #onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    this.#cancelTimer()
    this.open = false
  }

  #cancelTimer(): void {
    if (this.#timer === null) return
    window.clearTimeout(this.#timer)
    this.#timer = null
  }

  #synchronizePresentation(): void {
    if (!this.surface) return
    const isOpen = this.surface.matches(':popover-open')
    if (isOpen === this.open) return

    if (this.open) {
      this.surface.style.visibility = 'hidden'
      this.surface.showPopover()
      this.#position()
      this.surface.style.visibility = 'visible'
      this.#startOpenListeners()
    } else {
      this.surface.hidePopover()
      this.#stopOpenListeners()
    }
  }

  #startOpenListeners(): void {
    this.#stopOpenListeners()
    this.#openListeners = new AbortController()
    const { signal } = this.#openListeners
    document.addEventListener('keydown', this.#onKeydown, { signal, capture: true })
    window.addEventListener('resize', this.#positionOnResize, { signal, passive: true })
    window.addEventListener('scroll', this.#onLeave, { signal, capture: true, passive: true })
  }

  #stopOpenListeners(): void {
    this.#openListeners?.abort()
    this.#openListeners = null
  }

  #positionOnResize = (): void => this.#position()

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
      TOOLTIP_GAP,
      TOOLTIP_MARGIN,
      getComputedStyle(this).direction === 'rtl',
    )
    this.surface.style.left = `${position.left}px`
    this.surface.style.top = `${position.top}px`
  }

  #onToggle = (event: ToggleEvent): void => {
    const nextOpen = event.newState === 'open'
    if (this.open !== nextOpen) this.open = nextOpen
    if (!nextOpen) this.#stopOpenListeners()
  }

  override render() {
    return html`
      <slot name="trigger" @slotchange=${this.#onTriggerSlotChange}></slot>
      <div
        class="surface"
        part="surface"
        id=${this.#surfaceID}
        popover="manual"
        role="tooltip"
        aria-label=${this.accessibilityText || this.message}
        @toggle=${this.#onToggle}
      >
        <fd-tooltip-content
          .title=${this.title}
          .symbol=${this.symbol}
          .message=${this.message}
        >
          <slot></slot>
        </fd-tooltip-content>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-tooltip': FdTooltip
  }
}
