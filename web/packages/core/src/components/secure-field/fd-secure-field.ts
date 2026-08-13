import { customElement, property } from 'lit/decorators.js'
import {
  type FdFieldValidation,
  type FdTextFieldEmphasis,
  FdTextInputBase,
  noFieldValidation,
} from '../../internal/text-input.js'

/**
 * A password field matching `FlowingSecureField`.
 *
 * @fires fd-change - `{ value: string }` while the user edits.
 * @fires fd-submit - When the user presses Enter.
 * @csspart field - The field chrome.
 * @csspart icon - The optional leading icon.
 * @csspart input - The native password input.
 */
@customElement('fd-secure-field')
export class FdSecureField extends FdTextInputBase {
  @property({ reflect: true }) label = ''

  @property({ reflect: true }) placeholder = ''

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) emphasis: FdTextFieldEmphasis = 'standard'

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true }) name = ''

  @property({ reflect: true }) value = ''

  @property({ attribute: 'supporting-text' }) supportingText: string | null = null

  @property({ attribute: false }) validation: FdFieldValidation = noFieldValidation

  protected readonly inputType = 'password'
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-secure-field': FdSecureField
  }
}
