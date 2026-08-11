import { type CSSResultGroup, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { softButtonStyles } from '../../internal/soft-button.js'

/**
 * A reusable button using `FlowingSoftButtonStyle`.
 *
 * @slot - Custom button content. Falls back to `label`.
 * @fires fd-activate - When the button is pressed.
 * @csspart button - The native button.
 */
@customElement('fd-button')
export class FdButton extends FdElement {
  static override styles: CSSResultGroup = [baseStyles, softButtonStyles]

  @property({ reflect: true }) label = ''

  @property({ type: Boolean, reflect: true }) prominent = false

  @property({ type: Boolean, reflect: true }) disabled = false

  #activate = (): void => {
    if (this.disabled) return
    this.dispatchEvent(
      new CustomEvent('fd-activate', { detail: {}, bubbles: true, composed: true }),
    )
  }

  #onSlotChange = (): void => this.requestUpdate()

  get #hasCustomContent(): boolean {
    return [...this.childNodes].some(
      (node) => node.nodeType === Node.ELEMENT_NODE || (node.textContent?.trim().length ?? 0) > 0,
    )
  }

  override render() {
    return html`
      <button
        class="soft-button"
        part="button"
        type="button"
        ?data-prominent=${this.prominent}
        ?disabled=${this.disabled}
        @click=${this.#activate}
      >
        <slot @slotchange=${this.#onSlotChange}></slot>
        ${this.#hasCustomContent ? nothing : this.label}
      </button>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-button': FdButton
  }
}
