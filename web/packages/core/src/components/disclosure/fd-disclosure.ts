import { type CSSResultGroup, css, html, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { styleMap } from 'lit/directives/style-map.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { chevronDown } from '../../internal/glyphs.js'
import type { FdEdgeInsets } from '../../internal/overlay-position.js'
import { textRole } from '../../internal/typography.js'

/**
 * The reusable counterpart to `FlowingDisclosure`.
 *
 * @slot label - Custom header content. Falls back to `label`.
 * @slot - Content revealed below the header.
 * @fires fd-change - `{ checked: boolean }` carrying the expanded state.
 * @csspart header - The disclosure button.
 * @csspart content - The revealed content container.
 */
@customElement('fd-disclosure')
export class FdDisclosure extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        min-width: 0;
      }

      .header {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        min-height: var(--_minimum-header-height, 0px);
        border: 0;
        border-radius: 8px;
        outline: 0;
        background: transparent;
        color: var(--_fd-palette-ink);
        font: inherit;
        text-align: start;
        cursor: pointer;
      }

      .label {
        ${textRole('selection-label')}
        min-width: 0;
      }

      .spacer {
        flex: 1 1 auto;
        min-width: 10px;
      }

      .chevron {
        flex: none;
        width: 10px;
        height: 10px;
        color: var(--_fd-accent-foreground);
        transition: rotate var(--_fd-motion-disclosure) var(--_fd-motion-easing);
      }

      :host([expanded]) .chevron {
        rotate: 180deg;
      }

      .header:focus-visible {
        background: color-mix(in srgb, var(--_fd-accent-veil) 58%, transparent);
      }

      :host([disabled]) .header {
        cursor: default;
        opacity: 0.4;
      }

      .reveal {
        display: grid;
        grid-template-rows: 0fr;
        opacity: 0;
        translate: 0 var(--_fd-motion-disclosure-offset);
        transition:
          grid-template-rows var(--_fd-motion-disclosure) var(--_fd-motion-easing),
          opacity var(--_fd-motion-disclosure) var(--_fd-motion-easing),
          translate var(--_fd-motion-disclosure) var(--_fd-motion-easing);
      }

      :host([expanded]) .reveal {
        grid-template-rows: 1fr;
        opacity: 1;
        translate: 0 0;
      }

      .content {
        min-height: 0;
        overflow: hidden;
      }

      @media (prefers-reduced-motion: reduce) {
        .chevron,
        .reveal {
          transition-duration: var(--_fd-motion-disclosure);
          transition-timing-function: linear;
        }

        .reveal {
          translate: 0 var(--_fd-motion-disclosure-offset);
        }

        :host([expanded]) .reveal {
          translate: 0 0;
        }
      }
    `,
  ]

  @property({ reflect: true }) label = ''

  @property({ type: Boolean, reflect: true }) expanded = false

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ type: Number, attribute: 'minimum-header-height' }) minimumHeaderHeight:
    | number
    | null = null

  @property({ attribute: false }) contentInsets: FdEdgeInsets = {
    top: 8,
    leading: 10,
    bottom: 8,
    trailing: 10,
  }

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    const height = this.minimumHeaderHeight
    this.style.setProperty(
      '--_minimum-header-height',
      height !== null && Number.isFinite(height) && height >= 0 ? `${height}px` : '0px',
    )
  }

  #toggle = (): void => {
    if (this.disabled) return
    this.expanded = !this.expanded
    this.dispatchEvent(
      new CustomEvent('fd-change', {
        detail: { checked: this.expanded },
        bubbles: true,
        composed: true,
      }),
    )
  }

  override render() {
    const inset = (value: number): number => (Number.isFinite(value) ? Math.max(0, value) : 0)
    return html`
      <button
        class="header"
        part="header"
        type="button"
        aria-expanded=${this.expanded}
        style=${styleMap({
          'padding-block-start': `${inset(this.contentInsets.top)}px`,
          'padding-inline-start': `${inset(this.contentInsets.leading)}px`,
          'padding-block-end': `${inset(this.contentInsets.bottom)}px`,
          'padding-inline-end': `${inset(this.contentInsets.trailing)}px`,
        })}
        ?disabled=${this.disabled}
        @click=${this.#toggle}
      >
        <span class="label"><slot name="label">${this.label}</slot></span>
        <span class="spacer"></span>
        <span class="chevron">${chevronDown}</span>
      </button>
      <div class="reveal">
        <div class="content" part="content"><slot></slot></div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-disclosure': FdDisclosure
  }
}
