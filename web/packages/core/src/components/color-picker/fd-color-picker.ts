import { type CSSResultGroup, css, html, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { textRole } from '../../internal/typography.js'

/**
 * The reusable counterpart to `FlowingColorPicker`.
 *
 * @fires fd-change - `{ value: string }` as a hex colour.
 * @slot label - Custom visible label content.
 * @csspart label - The visible label.
 * @csspart swatch - The native colour well.
 */
@customElement('fd-color-picker')
export class FdColorPicker extends FdElement {
  static formAssociated = true

  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: inline-flex;
      }

      .control {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .label {
        ${textRole('selection-label')}
        min-width: 0;
        color: var(--_fd-palette-ink);
      }

      .swatch {
        width: 38px;
        height: 22px;
        padding: 2px;
        border: 0;
        border-radius: 6px;
        background: var(--_fd-surface-control);
        box-shadow: inset 0 0 0 1px var(--_fd-palette-hairline);
        cursor: pointer;
        appearance: none;
        -webkit-appearance: none;
      }

      .swatch::-webkit-color-swatch-wrapper {
        padding: 0;
      }

      .swatch::-webkit-color-swatch {
        border: 0;
        border-radius: 4px;
      }

      .swatch::-moz-color-swatch {
        border: 0;
        border-radius: 4px;
      }

      .swatch:focus-visible {
        outline: 2px solid var(--_fd-accent-fill);
        outline-offset: 2px;
      }

      :host([disabled]) .swatch {
        cursor: default;
        opacity: 0.4;
      }
    `,
  ]

  @property({ reflect: true }) label = ''

  @property({ type: Boolean, reflect: true, attribute: 'hide-label' }) hideLabel = false

  @property({ reflect: true }) value = '#000000'

  @property({ type: Boolean, reflect: true, attribute: 'supports-opacity' }) supportsOpacity = false

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true }) name = ''

  readonly #internals: ElementInternals

  #defaultValue = '#000000'

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
    this.#internals.setFormValue(this.disabled ? null : this.value)
  }

  formResetCallback(): void {
    this.value = this.#defaultValue
  }

  formStateRestoreCallback(state: string | null): void {
    if (state !== null) this.value = state
  }

  #onInput = (event: Event): void => {
    this.value = (event.target as HTMLInputElement).value
    this.dispatchEvent(
      new CustomEvent('fd-change', {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    )
  }

  override render() {
    return html`
      <label class="control">
        ${
          this.hideLabel
            ? null
            : html`<span class="label" part="label"><slot name="label">${this.label}</slot></span>`
        }
        <input
          class="swatch"
          part="swatch"
          type="color"
          aria-label=${this.label}
          ?alpha=${this.supportsOpacity}
          ?disabled=${this.disabled}
          .value=${this.value}
          @input=${this.#onInput}
        />
      </label>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-color-picker': FdColorPicker
  }
}
