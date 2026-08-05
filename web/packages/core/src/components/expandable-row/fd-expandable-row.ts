import { type CSSResultGroup, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { chevronDown } from '../../internal/glyphs.js'
import { rowLayoutStyles } from '../../internal/row-layout.js'
import { FdStringsRegistry } from '../../internal/strings.js'
import '../icon/fd-icon.js'

/**
 * Mirrors `SettingsExpandableRow`: a row that is entirely a button, with a trailing
 * chevron turning 180° over 0.18s ease-out. It reports its state and owns nothing else —
 * pair it with `fd-dependent-rows` to reveal the rows it discloses.
 *
 * `contentShape(Rectangle())` becomes a button filling the row, so the padding is part
 * of the hit target rather than dead space around the label.
 *
 * @fires fd-change - `{ checked: boolean }` carrying the new expanded state.
 * @csspart row - The row button.
 * @csspart chevron - The disclosure chevron.
 */
@customElement('fd-expandable-row')
export class FdExpandableRow extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    rowLayoutStyles,
    css`
      .row {
        width: 100%;
        border: 0;
        background: transparent;
        font: inherit;
        text-align: start;
        cursor: pointer;
      }

      .row:focus-visible {
        outline: 2px solid var(--_fd-accent-fill);
        outline-offset: -2px;
      }

      :host([disabled]) .row {
        cursor: default;
        opacity: 0.4;
      }

      /* Image(systemName: "chevron.down").font(.system(size: 10, weight: .semibold)) */
      .chevron {
        flex: none;
        width: 10px;
        height: 10px;
        color: var(--_fd-accent-foreground);
        transition: rotate var(--_fd-motion-expand) var(--_fd-motion-easing);
      }

      :host([expanded]) .chevron {
        rotate: 180deg;
      }
    `,
  ]

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) caption: string | null = null

  @property({ type: Boolean, reflect: true }) expanded = false

  @property({ type: Boolean, reflect: true }) disabled = false

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
    const strings = FdStringsRegistry.get()

    return html`
      <button
        class="row"
        part="row"
        type="button"
        aria-expanded=${this.expanded}
        aria-label="${this.label}, ${this.expanded ? strings.expanded : strings.collapsed}"
        ?data-caption=${!!this.caption}
        ?disabled=${this.disabled}
        @click=${this.#toggle}
      >
        ${this.symbol ? html`<fd-icon class="symbol" name=${this.symbol}></fd-icon>` : nothing}
        <span class="text">
          <span class="label" part="label">${this.label}</span>
          ${this.caption ? html`<span class="caption" part="caption">${this.caption}</span>` : nothing}
        </span>
        <span class="spacer"></span>
        <span class="chevron" part="chevron">${chevronDown}</span>
      </button>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-expandable-row': FdExpandableRow
  }
}
