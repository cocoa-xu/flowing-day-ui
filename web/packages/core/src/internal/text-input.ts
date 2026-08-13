import { type CSSResultGroup, css, html, type PropertyValues } from 'lit'
import { baseStyles, FdElement } from './base-element.js'
import {
  type FdFieldValidation,
  fieldValidationStyles,
  noFieldValidation,
  renderFieldSupportingText,
} from './field-validation.js'
import { textRole } from './typography.js'
import '../components/icon/fd-icon.js'

export type FdTextFieldEmphasis = 'standard' | 'accented'

export const textInputChromeStyles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .field {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 30px;
      padding-inline: 10px;
      border: 1px solid var(--_fd-palette-hairline);
      border-radius: 8px;
      background: var(--_fd-surface-field);
      transition: border-color var(--_fd-motion-hover) var(--_fd-motion-easing);
    }

    :host([emphasis='accented']) .field {
      border-color: color-mix(in srgb, var(--_fd-accent-fill) 16%, transparent);
      background: var(--_fd-accent-veil);
    }

    .field:focus-within {
      border-color: color-mix(in srgb, var(--_fd-accent-fill) 42%, transparent);
    }

    fd-icon {
      width: 14px;
      height: 11px;
      color: var(--_fd-palette-muted);
      font-size: 11px;
    }

    :host([emphasis='accented']) fd-icon {
      color: color-mix(in srgb, var(--_fd-accent-foreground) 72%, transparent);
    }

    input {
      ${textRole('value')}
      min-width: 0;
      width: 100%;
      padding: 0;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--_fd-palette-ink);
    }

    input::placeholder {
      color: var(--_fd-palette-faint);
      opacity: 1;
    }

    :host([disabled]) {
      opacity: 0.55;
    }
  `

export const textInputStyles: CSSResultGroup = [
  baseStyles,
  textInputChromeStyles,
  fieldValidationStyles,
]

export abstract class FdTextInputBase extends FdElement {
  static formAssociated = true

  static override styles = textInputStyles

  abstract label: string

  abstract placeholder: string

  abstract symbol: string | null

  abstract emphasis: FdTextFieldEmphasis

  abstract disabled: boolean

  abstract name: string

  abstract value: string

  abstract supportingText: string | null

  abstract validation: FdFieldValidation

  protected abstract readonly inputType: 'text' | 'password'

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
    this.value = (event.currentTarget as HTMLInputElement).value
    this.#syncFormValue()
    this.dispatchEvent(
      new CustomEvent('fd-change', {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    )
  }

  #onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter') return
    this.dispatchEvent(new CustomEvent('fd-submit', { bubbles: true, composed: true }))
  }

  #syncFormValue(): void {
    this.#internals.setFormValue(this.disabled ? null : this.value, this.value)
  }

  override render() {
    return html`
      <div class="field" part="field" data-validation=${this.validation.kind}>
        ${this.symbol ? html`<fd-icon name=${this.symbol} part="icon"></fd-icon>` : null}
        <input
          part="input"
          type=${this.inputType}
          .value=${this.value}
          placeholder=${this.placeholder || this.label}
          aria-label=${this.label}
          ?disabled=${this.disabled}
          @input=${this.#onInput}
          @keydown=${this.#onKeydown}
        />
      </div>
      ${renderFieldSupportingText(this.validation, this.supportingText)}
    `
  }
}

export { type FdFieldValidation, noFieldValidation }
