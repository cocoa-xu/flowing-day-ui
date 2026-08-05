import { type CSSResultGroup, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { checkmark } from '../../internal/glyphs.js'
import '../icon/fd-icon.js'

/**
 * Mirrors `PreferencesIconSelectionButton`: a full-width row of leading glyph, title and a
 * trailing checkmark disc, tinted per instance rather than from the ambient accent.
 *
 * The tint is its own colour, not `--fd-accent` — the SwiftUI original takes it as an
 * argument so a list of these can each stand for a different thing.
 *
 * @slot leading - The leading glyph, when `symbol` will not do.
 * @fires fd-change - `{ checked: boolean }` carrying the new state.
 * @csspart button - The button.
 * @csspart indicator - The trailing checkmark disc.
 */
@customElement('fd-icon-selection-button')
export class FdIconSelectionButton extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      .button {
        display: flex;
        align-items: center;
        gap: 9px;
        width: 100%;
        height: 31px;
        padding-inline: 10px;
        border: 0;
        border-radius: 9px;
        background: transparent;
        color: var(--_fd-palette-faint);
        font: inherit;
        text-align: start;
        cursor: pointer;
      }

      .button[data-selected] {
        color: var(--_fd-palette-ink);
        background: color-mix(in srgb, var(--_tint) 6.5%, transparent);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--_tint) 15%, transparent);
      }

      .button:focus-visible {
        outline: 2px solid var(--_tint);
        outline-offset: 2px;
      }

      :host([disabled]) .button {
        cursor: default;
        opacity: 0.4;
      }

      .leading {
        display: flex;
        justify-content: center;
        flex: none;
        width: 14px;
        font-size: 9px;
        font-weight: 500;
        color: color-mix(in srgb, var(--_tint) 30%, transparent);
      }

      .button[data-selected] .leading {
        color: var(--_tint);
      }

      .title {
        font-size: 11px;
        font-weight: 500;
      }

      .spacer {
        flex: 1 1 auto;
      }

      .indicator {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: none;
        width: 15px;
        height: 15px;
        border-radius: 50%;
        box-shadow: inset 0 0 0 1px var(--_fd-palette-edge);
        color: #fff;
      }

      .button[data-selected] .indicator {
        background: var(--_tint);
        box-shadow: inset 0 0 0 1px var(--_tint);
      }

      .indicator svg {
        width: 7px;
        height: 7px;
        stroke-width: 2.6;
        opacity: 0;
      }

      .button[data-selected] .indicator svg {
        opacity: 1;
      }
    `,
  ]

  @property({ reflect: true }) label = ''

  /** Icon registry key for the leading glyph; ignored when the `leading` slot is filled. */
  @property({ reflect: true }) symbol: string | null = null

  /** `PreferencesIconSelectionButton.tint` — any CSS colour. */
  @property({ reflect: true }) tint = 'currentColor'

  @property({ type: Boolean, reflect: true }) selected = false

  @property({ type: Boolean, reflect: true }) disabled = false

  /** `.help(_:)`. Falls back to the same Show/Hide phrasing the SwiftUI original uses. */
  @property({ reflect: true }) help: string | null = null

  #toggle = (): void => {
    if (this.disabled) return
    this.selected = !this.selected
    this.dispatchEvent(
      new CustomEvent('fd-change', {
        detail: { checked: this.selected },
        bubbles: true,
        composed: true,
      }),
    )
  }

  override render() {
    const tooltip = this.help ?? `${this.selected ? 'Hide' : 'Show'} ${this.label}`

    return html`
      <button
        class="button"
        part="button"
        type="button"
        style="--_tint: ${this.tint}"
        aria-pressed=${this.selected}
        title=${tooltip}
        ?data-selected=${this.selected}
        ?disabled=${this.disabled}
        @click=${this.#toggle}
      >
        <span class="leading">
          <slot name="leading">
            ${this.symbol ? html`<fd-icon name=${this.symbol}></fd-icon>` : nothing}
          </slot>
        </span>
        <span class="title">${this.label}</span>
        <span class="spacer"></span>
        <span class="indicator" part="indicator">${checkmark}</span>
      </button>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-icon-selection-button': FdIconSelectionButton
  }
}
