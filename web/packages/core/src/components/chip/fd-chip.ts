import { type CSSResultGroup, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { textRole } from '../../internal/typography.js'

/**
 * Mirrors `SettingsChip`: a full-width accent-veiled button that washes on hover. The
 * SwiftUI original attaches no animation modifier, so the wash lands instantly.
 *
 * @fires fd-activate - When the chip is pressed. This is the SwiftUI `action` closure.
 * @csspart chip - The chip button.
 */
@customElement('fd-chip')
export class FdChip extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      .chip {
        ${textRole('selection-label')}
        display: block;
        width: 100%;
        /* frame(maxWidth: .infinity) with vertical padding only. */
        padding-block: 6px;
        padding-inline: 0;
        border: 0;
        border-radius: 8px;
        background: var(--_fd-accent-veil);
        color: var(--_fd-accent-foreground);
        text-align: center;
        cursor: pointer;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .chip:hover {
        background: var(--_fd-accent-wash);
      }

      .chip:focus-visible {
        outline: 2px solid var(--_fd-accent-fill);
        outline-offset: 2px;
      }

      :host([disabled]) .chip {
        cursor: default;
        opacity: 0.4;
      }
    `,
  ]

  /** Falls back to the element's text content. */
  @property({ reflect: true }) label: string | null = null

  /** Reported on `fd-activate`, so one listener can serve a set of chips. */
  @property({ reflect: true }) value = ''

  @property({ type: Boolean, reflect: true }) disabled = false

  #onClick = (): void => {
    if (this.disabled) return
    this.dispatchEvent(
      new CustomEvent('fd-activate', {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    )
  }

  override render() {
    return html`
      <button
        class="chip"
        part="chip"
        type="button"
        ?disabled=${this.disabled}
        @click=${this.#onClick}
      >
        ${this.label ?? html`<slot></slot>`}
      </button>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-chip': FdChip
  }
}
