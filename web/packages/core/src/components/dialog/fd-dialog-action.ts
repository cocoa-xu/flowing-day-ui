import { type CSSResultGroup, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { dialogActionStyles } from '../../internal/dialog-action.js'
import '../icon/fd-icon.js'

/**
 * An action styled for the footer of `fd-dialog`.
 *
 * @fires fd-activate - When the action is pressed.
 * @csspart button - The native button.
 */
@customElement('fd-dialog-action')
export class FdDialogAction extends FdElement {
  static override styles: CSSResultGroup = [baseStyles, dialogActionStyles]

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) symbol: string | null = null

  @property({ type: Boolean, reflect: true }) prominent = false

  @property({ type: Boolean, reflect: true }) destructive = false

  @property({ type: Boolean, reflect: true }) disabled = false

  #activate = (): void => {
    if (this.disabled) return
    this.dispatchEvent(new CustomEvent('fd-activate', { bubbles: true, composed: true }))
  }

  override render() {
    return html`
      <button
        class="dialog-action"
        part="button"
        type="button"
        ?data-prominent=${this.prominent}
        ?data-destructive=${this.destructive}
        ?disabled=${this.disabled}
        @click=${this.#activate}
      >
        ${this.symbol ? html`<fd-icon name=${this.symbol}></fd-icon>` : null}
        <slot>${this.label}</slot>
      </button>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-dialog-action': FdDialogAction
  }
}
