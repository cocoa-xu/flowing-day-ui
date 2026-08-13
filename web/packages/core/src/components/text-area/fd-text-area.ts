import { type CSSResultGroup, css, html, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { FdElement } from '../../internal/base-element.js'
import {
  type FdFieldValidation,
  noFieldValidation,
  renderFieldSupportingText,
} from '../../internal/field-validation.js'
import { type FdTextFieldEmphasis, textInputStyles } from '../../internal/text-input.js'
import { textRole } from '../../internal/typography.js'
import '../icon/fd-icon.js'

/**
 * A multiline text field matching `FlowingTextArea`.
 *
 * @fires fd-change - `{ value: string }` while the user edits.
 * @csspart field - The field chrome.
 * @csspart icon - The optional leading icon.
 * @csspart input - The native textarea.
 */
@customElement('fd-text-area')
export class FdTextArea extends FdElement {
  static formAssociated = true

  static readonly standardMinimumHeight = 84

  static override styles: CSSResultGroup = [
    textInputStyles,
    css`
      .field {
        align-items: flex-start;
        height: auto;
        padding-block: 6px;
      }

      fd-icon {
        margin-top: 6px;
      }

      textarea {
        ${textRole('value')}
        display: block;
        min-width: 0;
        width: 100%;
        min-height: calc(var(--_minimum-height) - 12px);
        padding: 7px 5px;
        border: 0;
        outline: 0;
        resize: vertical;
        background: transparent;
        color: var(--_fd-palette-ink);
      }

      textarea::placeholder {
        color: var(--_fd-palette-faint);
        opacity: 1;
      }
    `,
  ]

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) placeholder = ''

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) emphasis: FdTextFieldEmphasis = 'standard'

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true }) name = ''

  @property({ reflect: true }) value = ''

  @property({ attribute: 'supporting-text' }) supportingText: string | null = null

  @property({ attribute: false }) validation: FdFieldValidation = noFieldValidation

  @property({ type: Number, attribute: 'minimum-height' })
  minimumHeight = FdTextArea.standardMinimumHeight

  readonly #internals: ElementInternals

  #defaultValue = ''

  constructor() {
    super()
    this.#internals = this.attachInternals()
  }

  get form(): HTMLFormElement | null {
    return this.#internals.form
  }

  get labels(): NodeList {
    return this.#internals.labels
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#defaultValue = this.value
  }

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.#syncFormValue()
    this.#internals.ariaDisabled = String(this.disabled)
  }

  formResetCallback(): void {
    this.value = this.#defaultValue
    this.#syncFormValue()
  }

  formStateRestoreCallback(state: string | null): void {
    this.value = state ?? ''
    this.#syncFormValue()
  }

  #onInput = (event: InputEvent): void => {
    this.value = (event.currentTarget as HTMLTextAreaElement).value
    this.#syncFormValue()
    this.dispatchEvent(
      new CustomEvent('fd-change', {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    )
  }

  get #resolvedMinimumHeight(): number {
    return Number.isFinite(this.minimumHeight) && this.minimumHeight > 0
      ? this.minimumHeight
      : FdTextArea.standardMinimumHeight
  }

  #syncFormValue(): void {
    this.#internals.setFormValue(this.disabled ? null : this.value, this.value)
  }

  override render() {
    return html`
      <div
        class="field"
        part="field"
        data-validation=${this.validation.kind}
        style="--_minimum-height: ${this.#resolvedMinimumHeight}px; min-height: ${
          this.#resolvedMinimumHeight
        }px"
      >
        ${this.symbol ? html`<fd-icon name=${this.symbol} part="icon"></fd-icon>` : null}
        <textarea
          part="input"
          .value=${this.value}
          placeholder=${this.placeholder || this.label}
          aria-label=${this.label}
          ?disabled=${this.disabled}
          @input=${this.#onInput}
        ></textarea>
      </div>
      ${renderFieldSupportingText(this.validation, this.supportingText)}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-text-area': FdTextArea
  }
}
