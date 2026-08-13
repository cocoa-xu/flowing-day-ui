import { type CSSResultGroup, css, html, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import type {
  FdCheckboxContentAlignment,
  FdCheckboxIndicatorPlacement,
  FdCheckboxTruncationMode,
  FdCheckboxWidthPolicy,
} from '../checkbox/fd-checkbox.js'
import '../checkbox/fd-checkbox.js'

/**
 * The Preferences wrapper around `fd-checkbox`.
 *
 * @fires fd-change - `{ checked: boolean }` when toggled.
 * @csspart segment - The checkbox surface.
 * @csspart indicator - The selection indicator.
 */
@customElement('fd-check-toggle')
export class FdCheckToggle extends FdElement {
  static formAssociated = true

  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: flex;
        width: 100%;
      }

      fd-checkbox {
        width: 100%;
      }

      :host([width-policy='fitContent']) {
        display: inline-flex;
        width: auto;
        max-width: var(--_maximum-width, 100%);
      }
    `,
  ]

  /** Falls back to the element's text content. */
  @property({ reflect: true }) label: string | null = null

  @property({ type: Boolean, reflect: true }) checked = false

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true, attribute: 'content-alignment' })
  contentAlignment: FdCheckboxContentAlignment = 'center'

  @property({ reflect: true, attribute: 'indicator-placement' })
  indicatorPlacement: FdCheckboxIndicatorPlacement = 'leading'

  @property({ reflect: true, attribute: 'width-policy' }) widthPolicy: FdCheckboxWidthPolicy =
    'fill'

  @property({ type: Number, attribute: 'maximum-width' }) maximumWidth: number | null = null

  @property({ reflect: true, attribute: 'truncation-mode' })
  truncationMode: FdCheckboxTruncationMode = 'tail'

  @property({ reflect: true }) name = ''

  @property({ reflect: true }) value = 'on'

  readonly #internals: ElementInternals

  #defaultChecked = false

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
    this.#defaultChecked = this.checked
  }

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    const maximum = this.maximumWidth
    if (maximum !== null && Number.isFinite(maximum) && maximum > 0) {
      this.style.setProperty('--_maximum-width', `${maximum}px`)
    } else {
      this.style.removeProperty('--_maximum-width')
    }
    this.#internals.setFormValue(this.checked && !this.disabled ? this.value : null)
  }

  formResetCallback(): void {
    this.checked = this.#defaultChecked
  }

  formStateRestoreCallback(state: string | null): void {
    this.checked = state !== null
  }

  #onChange = (event: CustomEvent): void => {
    event.stopPropagation()
    this.checked = event.detail.checked === true
    this.dispatchEvent(
      new CustomEvent('fd-change', {
        detail: { checked: this.checked },
        bubbles: true,
        composed: true,
      }),
    )
  }

  override render() {
    const label = this.label ?? this.textContent?.trim() ?? ''

    return html`
      <fd-checkbox
        exportparts="button: segment, indicator"
        .label=${label}
        .checked=${this.checked}
        .disabled=${this.disabled}
        .contentAlignment=${this.contentAlignment}
        .indicatorPlacement=${this.indicatorPlacement}
        .widthPolicy=${this.widthPolicy}
        .maximumWidth=${this.maximumWidth}
        .truncationMode=${this.truncationMode}
        @fd-change=${this.#onChange}
      ></fd-checkbox>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-check-toggle': FdCheckToggle
  }
}
