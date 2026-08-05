import { type CSSResultGroup, css, html, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import '../row/fd-row.js'

/**
 * Mirrors `SettingsColorPickerRow`: a row whose trailing control opens the platform
 * colour picker. `ColorPicker` is `<input type="color">` here — both hand the choice to
 * the OS rather than drawing a picker, which is the point of using it.
 *
 * `supports-opacity` maps to the `alpha` attribute. Browsers without it ignore the
 * attribute and offer an opaque colour, which is the `supportsOpacity: false` behaviour.
 *
 * @fires fd-change - `{ value: string }` as a hex colour.
 * @csspart swatch - The colour well.
 */
@customElement('fd-color-picker-row')
export class FdColorPickerRow extends FdElement {
  static formAssociated = true

  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      /* controlSize(.small), which AppKit draws as a 38×22 well. */
      .swatch {
        width: 38px;
        height: 22px;
        padding: 2px;
        border: 0;
        border-radius: 6px;
        background: var(--_fd-surface-control);
        box-shadow: inset 0 0 0 1px var(--_fd-palette-hairline);
        cursor: pointer;
        /* The UA well has its own inner chrome; only the swatch itself should show. */
        appearance: none;
        -webkit-appearance: none;
      }

      .swatch::-webkit-color-swatch-wrapper {
        padding: 0;
      }

      .swatch::-webkit-color-swatch,
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

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) caption: string | null = null

  /** The selected colour, as a hex string. */
  @property({ reflect: true }) value = '#000000'

  /** `SettingsColorPickerRow.supportsOpacity`. */
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

  override connectedCallback(): void {
    super.connectedCallback()
    this.#defaultValue = this.value
  }

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.#internals.setFormValue(this.value)
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
      <fd-row symbol=${this.symbol ?? ''} label=${this.label} caption=${this.caption ?? ''}>
        <input
          class="swatch"
          part="swatch"
          slot="trailing"
          type="color"
          aria-label=${this.label}
          ?alpha=${this.supportsOpacity}
          ?disabled=${this.disabled}
          .value=${this.value}
          @input=${this.#onInput}
        />
      </fd-row>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-color-picker-row': FdColorPickerRow
  }
}
