import { type CSSResultGroup, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { dialogActionStyles } from '../../internal/dialog-action.js'
import '../icon/fd-icon.js'

export type FdDialogActionEmphasis = 'standard' | 'prominent'
export type FdDialogActionRole = 'destructive'

/**
 * An action styled for the footer of `fd-dialog`.
 *
 * @fires fd-activate - When the action is pressed.
 * @csspart button - The native button.
 */
@customElement('fd-dialog-action')
export class FdDialogAction extends FdElement {
  static override styles: CSSResultGroup = [baseStyles, dialogActionStyles]

  @property({ reflect: true, attribute: 'title-text' }) override title = ''

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) emphasis: FdDialogActionEmphasis = 'standard'

  @property({ reflect: true, attribute: 'button-role' })
  buttonRole: FdDialogActionRole | null = null

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
        ?data-prominent=${this.emphasis === 'prominent'}
        ?data-destructive=${this.buttonRole === 'destructive'}
        ?disabled=${this.disabled}
        @click=${this.#activate}
      >
        ${this.symbol ? html`<fd-icon name=${this.symbol}></fd-icon>` : null}
        <slot>${this.title}</slot>
      </button>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-dialog-action': FdDialogAction
  }
}
