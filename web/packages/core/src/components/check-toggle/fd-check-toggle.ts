import { type CSSResultGroup, css, html, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { checkCircleFill, circleOutline, selectionStyles } from '../../internal/selection.js'

/**
 * Mirrors `SettingsCheckToggle`: one checkmark-circle pill on its own, for use outside a
 * multi-select strip.
 *
 * @fires fd-change - `{ checked: boolean }` when toggled.
 * @csspart segment - The pill.
 */
@customElement('fd-check-toggle')
export class FdCheckToggle extends FdElement {
  static formAssociated = true

  static override styles: CSSResultGroup = [
    baseStyles,
    selectionStyles,
    css`
      :host {
        display: inline-flex;
      }

      .segment {
        flex: 0 0 auto;
      }
    `,
  ]

  /** Falls back to the element's text content. */
  @property({ reflect: true }) label: string | null = null

  @property({ type: Boolean, reflect: true }) checked = false

  @property({ type: Boolean, reflect: true }) disabled = false

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

  override connectedCallback(): void {
    super.connectedCallback()
    this.#defaultChecked = this.checked
  }

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.#internals.setFormValue(this.checked ? this.value : null)
  }

  formResetCallback(): void {
    this.checked = this.#defaultChecked
  }

  formStateRestoreCallback(state: string | null): void {
    this.checked = state !== null
  }

  #toggle(): void {
    if (this.disabled) return
    this.checked = !this.checked
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
      <button
        class="segment"
        part="segment"
        type="button"
        aria-pressed=${this.checked}
        ?data-selected=${this.checked}
        ?disabled=${this.disabled}
        @click=${() => this.#toggle()}
      >
        ${this.checked ? checkCircleFill : circleOutline}
        <span class="segment-label">${label}</span>
      </button>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-check-toggle': FdCheckToggle
  }
}
