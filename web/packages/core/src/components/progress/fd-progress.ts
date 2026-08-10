import { type CSSResultGroup, css, html, nothing, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { textRole } from '../../internal/typography.js'

/**
 * Determinate and ongoing progress matching `FlowingProgress`.
 *
 * @csspart label - The progress label.
 * @csspart track - The determinate track.
 * @csspart fill - The determinate fill.
 * @csspart indicator - The ongoing activity indicator.
 * @slot - Rich label content used when `label` is absent.
 */
@customElement('fd-progress')
export class FdProgress extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        ${textRole('value')}
        display: block;
        color: var(--_fd-palette-muted);
      }

      .determinate {
        display: grid;
        gap: 6px;
      }

      .ongoing {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .label[hidden] {
        display: none;
      }

      .track {
        height: 4px;
        overflow: hidden;
        border-radius: 999px;
        background: var(--_fd-palette-hairline);
      }

      .fill {
        height: 100%;
        border-radius: inherit;
        background: var(--_fd-accent-fill);
        transform-origin: left center;
        transition: scale var(--_fd-motion-selection) var(--_fd-motion-easing);
      }

      :host(:dir(rtl)) .fill {
        transform-origin: right center;
      }

      .indicator {
        width: 14px;
        height: 14px;
        flex: none;
        animation: fd-progress-spin 900ms linear infinite;
      }

      .indicator circle {
        fill: none;
        stroke: var(--_fd-accent-fill);
        stroke-width: 2;
        stroke-linecap: round;
        stroke-dasharray: 22 13;
      }

      @keyframes fd-progress-spin {
        from {
          rotate: -90deg;
        }
        to {
          rotate: 270deg;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .indicator {
          animation: none;
          rotate: -90deg;
        }
      }
    `,
  ]

  @property({ reflect: true }) label: string | null = null

  @property({ type: Number }) value: number | null = null

  @property({ type: Number }) total = 1

  @state() private slottedLabel = ''

  get #fraction(): number | null {
    if (this.value === null) return null
    if (!Number.isFinite(this.value) || !Number.isFinite(this.total) || this.total <= 0) return 0
    return Math.min(Math.max(this.value / this.total, 0), 1)
  }

  #onLabelSlotChange = (event: Event): void => {
    const slot = event.currentTarget as HTMLSlotElement
    this.slottedLabel = slot
      .assignedNodes({ flatten: true })
      .map((node) => node.textContent ?? '')
      .join(' ')
      .trim()
  }

  #labelTemplate() {
    const hasLabel = (this.label !== null && this.label.length > 0) || this.slottedLabel.length > 0
    return html`
      <span class="label" part="label" ?hidden=${!hasLabel}>
        <slot @slotchange=${this.#onLabelSlotChange}>${this.label ?? nothing}</slot>
      </span>
    `
  }

  override connectedCallback(): void {
    super.connectedCallback()
    if (!this.hasAttribute('role')) this.setAttribute('role', 'progressbar')
  }

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    const fraction = this.#fraction
    const accessibleLabel = this.label ?? this.slottedLabel
    if (accessibleLabel) this.setAttribute('aria-label', accessibleLabel)
    else this.removeAttribute('aria-label')
    this.setAttribute('aria-valuemin', '0')
    if (fraction === null) {
      this.removeAttribute('aria-valuenow')
      this.removeAttribute('aria-valuemax')
    } else {
      this.setAttribute('aria-valuenow', String(fraction))
      this.setAttribute('aria-valuemax', '1')
    }
  }

  override render() {
    const fraction = this.#fraction
    if (fraction === null) {
      return html`
        <div class="ongoing">
          <svg class="indicator" part="indicator" viewBox="0 0 14 14" aria-hidden="true">
            <circle cx="7" cy="7" r="5.5"></circle>
          </svg>
          ${this.#labelTemplate()}
        </div>
      `
    }

    return html`
      <div class="determinate">
        ${this.#labelTemplate()}
        <div class="track" part="track">
          <div class="fill" part="fill" style="scale: ${fraction} 1"></div>
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-progress': FdProgress
  }
}
