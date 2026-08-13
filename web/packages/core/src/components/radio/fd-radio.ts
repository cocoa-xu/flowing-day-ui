import { css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { textRole } from '../../internal/typography.js'
import '../icon/fd-icon.js'

@customElement('fd-radio')
export class FdRadio extends FdElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: inline-block;
      }

      button {
        ${textRole('selection-label')}
        display: flex;
        align-items: center;
        gap: 7px;
        width: 100%;
        padding: 6px 8px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--_fd-palette-muted);
        text-align: start;
        cursor: default;
        transition:
          color var(--_fd-motion-selection) var(--_fd-motion-easing),
          background var(--_fd-motion-hover) var(--_fd-motion-easing);
      }

      button:hover:not(:disabled) {
        background: var(--_fd-accent-veil);
      }

      button[aria-checked='true'] {
        color: var(--_fd-palette-ink);
      }

      .indicator {
        box-sizing: border-box;
        display: grid;
        flex: 0 0 15px;
        width: 15px;
        height: 15px;
        place-items: center;
        border: 1px solid color-mix(in srgb, var(--_fd-palette-muted) 48%, transparent);
        border-radius: 50%;
        background: var(--_fd-palette-control);
      }

      button[aria-checked='true'] .indicator {
        border-color: var(--_fd-accent-fill);
      }

      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--_fd-accent-fill);
        opacity: 0;
        transform: scale(0.72);
        transition:
          opacity var(--_fd-motion-selection) var(--_fd-motion-easing),
          transform var(--_fd-motion-selection) var(--_fd-motion-easing);
      }

      button[aria-checked='true'] .dot {
        opacity: 1;
        transform: scale(1);
      }

      fd-icon {
        width: 12px;
        height: 12px;
        font-size: 11px;
      }

      .label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      :host([disabled]) {
        opacity: 0.42;
      }

      @media (prefers-reduced-motion: reduce) {
        button,
        .dot {
          transition: none;
        }
      }
    `,
  ]

  @property({ type: Boolean, reflect: true }) selected = false

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) value = ''

  override render() {
    return html`
      <button
        type="button"
        role="radio"
        aria-checked=${String(this.selected)}
        aria-label=${this.label}
        ?disabled=${this.disabled}
        @click=${this.#activate}
      >
        <span class="indicator" part="indicator"><span class="dot"></span></span>
        ${this.symbol ? html`<fd-icon name=${this.symbol} part="icon"></fd-icon>` : null}
        <span class="label" part="label"><slot>${this.label}</slot></span>
      </button>
    `
  }

  #activate = (): void => {
    if (this.disabled) return
    this.dispatchEvent(
      new CustomEvent('fd-activate', {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    )
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-radio': FdRadio
  }
}
