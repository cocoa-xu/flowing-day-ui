import { customElement, property } from 'lit/decorators.js'
import { type FdTextFieldEmphasis, FdTextInputBase } from '../../internal/text-input.js'

/**
 * A single-line text field matching `FlowingTextField`.
 *
 * @fires fd-change - `{ value: string }` while the user edits.
 * @fires fd-submit - When the user presses Enter.
 * @csspart field - The field chrome.
 * @csspart icon - The optional leading icon.
 * @csspart input - The native text input.
 */
@customElement('fd-text-field')
export class FdTextField extends FdTextInputBase {
  @property({ reflect: true }) label = ''

  @property({ reflect: true }) placeholder = ''

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) emphasis: FdTextFieldEmphasis = 'standard'

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true }) name = ''

  @property({ reflect: true }) value = ''

  protected readonly inputType = 'text'
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-text-field': FdTextField
  }
}
