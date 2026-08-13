import { type CSSResultGroup, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import '../icon/fd-icon.js'

export type FdIconButtonEmphasis = 'quiet' | 'standard' | 'prominent'

/**
 * A compact icon action matching `FlowingIconButton`.
 *
 * @fires fd-activate - Whenever the button is pressed.
 * @csspart button - The native button.
 * @csspart icon - The button icon.
 */
@customElement('fd-icon-button')
export class FdIconButton extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: inline-flex;
        width: 30px;
        height: 30px;
      }

      button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        padding: 0;
        border: 1px solid transparent;
        border-radius: 8px;
        outline: 0;
        background: transparent;
        color: var(--_fd-palette-muted);
        cursor: pointer;
        transition:
          color var(--_fd-motion-hover) var(--_fd-motion-easing),
          background-color var(--_fd-motion-hover) var(--_fd-motion-easing),
          border-color var(--_fd-motion-hover) var(--_fd-motion-easing);
      }

      fd-icon {
        width: 12px;
        height: 12px;
        font-size: 12px;
      }

      :host([emphasis='standard']) button {
        border-color: var(--_fd-palette-hairline);
        background: var(--_fd-surface-field);
      }

      :host([emphasis='prominent']) button {
        background: var(--_fd-accent-fill);
        color: white;
      }

      :host(:not([emphasis='prominent'])) button:hover,
      :host([selected='true']:not([emphasis='prominent'])) button {
        background: var(--_fd-accent-veil);
        color: var(--_fd-accent-foreground);
      }

      :host([emphasis='quiet'][selected='true']) button {
        border-color: color-mix(in srgb, var(--_fd-accent-fill) 18%, transparent);
      }

      :host([emphasis='standard'][selected='true']) button {
        border-color: color-mix(in srgb, var(--_fd-accent-fill) 24%, transparent);
      }

      :host([emphasis='prominent']) button:hover {
        background: color-mix(in srgb, var(--_fd-accent-fill) 86%, transparent);
      }

      button:focus-visible {
        box-shadow: inset 0 0 0 2px var(--_fd-accent-foreground);
      }

      button:active {
        opacity: 0.62;
      }

      :host([disabled]) button {
        cursor: default;
        opacity: 0.42;
      }
    `,
  ]

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) symbol = ''

  @property({ reflect: true }) emphasis: FdIconButtonEmphasis = 'quiet'

  @property({
    reflect: true,
    converter: {
      fromAttribute: (value) => (value === null ? null : value !== 'false'),
      toAttribute: (value: boolean | null) => (value === null ? null : String(value)),
    },
  })
  selected: boolean | null = null

  @property({ attribute: false }) showsSystemHelp = true

  @property({ type: Boolean, reflect: true }) disabled = false

  #onClick = (): void => {
    if (this.disabled) return
    this.dispatchEvent(new CustomEvent('fd-activate', { bubbles: true, composed: true }))
  }

  override render() {
    return html`
      <button
        part="button"
        type="button"
        title=${this.showsSystemHelp ? this.label : nothing}
        aria-label=${this.label}
        aria-pressed=${this.selected === null ? nothing : String(this.selected)}
        ?disabled=${this.disabled}
        @click=${this.#onClick}
      >
        <fd-icon name=${this.symbol} part="icon"></fd-icon>
      </button>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-icon-button': FdIconButton
  }
}
