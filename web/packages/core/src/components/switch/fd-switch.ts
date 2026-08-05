import { type CSSResultGroup, css, html, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'

/**
 * Mirrors `SettingsSwitch` — `Toggle(.switch).controlSize(.small)`.
 *
 * The SwiftUI original renders native AppKit chrome, which publishes no metrics, so the
 * track and knob geometry here is an approximation exposed as tokens for tuning.
 * The knob treatment reuses the exact values the Swift slider draws with.
 *
 * Form-associated: works inside `<form>` and participates in reset and state restore.
 *
 * @fires fd-change - `{ checked: boolean }` after a user interaction.
 * @csspart track - The switch track.
 * @csspart knob - The sliding knob.
 */
@customElement('fd-switch')
export class FdSwitch extends FdElement {
  static formAssociated = true

  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        --_track-width: var(--fd-switch-width, 32px);
        --_track-height: var(--fd-switch-height, 18px);
        --_knob-size: var(--fd-switch-knob-size, 14px);
        --_knob-inset: var(--fd-switch-knob-inset, 2px);

        display: inline-flex;
        flex: none;
        width: var(--_track-width);
        height: var(--_track-height);
        border-radius: calc(var(--_track-height) / 2);
        background: var(--_fd-track-off);
        cursor: pointer;
        transition: background-color var(--_fd-motion-selection) var(--_fd-motion-easing);
      }

      :host([checked]) {
        background: var(--_fd-accent-fill);
      }

      :host([disabled]) {
        cursor: default;
        opacity: 0.4;
      }

      :host(:focus-visible) {
        outline: 2px solid var(--_fd-accent-fill);
        outline-offset: 2px;
      }

      .knob {
        width: var(--_knob-size);
        height: var(--_knob-size);
        margin: var(--_knob-inset);
        border-radius: 50%;
        background: var(--_fd-knob-fill);
        box-shadow:
          0 0 0 0.5px var(--_fd-knob-border),
          var(--_fd-knob-shadow);
        transition: translate var(--_fd-motion-selection) var(--_fd-motion-easing);
      }

      :host([checked]) .knob {
        translate: calc(
          var(--_track-width) - 2 * var(--_knob-inset) - var(--_knob-size)
        );
      }
    `,
  ]

  @property({ type: Boolean, reflect: true }) checked = false

  @property({ type: Boolean, reflect: true }) disabled = false

  /** Form control name. */
  @property({ reflect: true }) name = ''

  /** Submitted value while checked. */
  @property({ reflect: true }) value = 'on'

  readonly #internals: ElementInternals

  #defaultChecked = false

  constructor() {
    super()
    this.#internals = this.attachInternals()
    this.addEventListener('click', this.#onClick)
    this.addEventListener('keydown', this.#onKeydown)
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
    // Reflected as attributes rather than through ElementInternals: the default ARIA
    // semantics internals provide are invisible to selectors, devtools and most test
    // runners, and interoperability is the point of shipping custom elements at all.
    if (!this.hasAttribute('role')) this.setAttribute('role', 'switch')
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0
  }

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.setAttribute('aria-checked', String(this.checked))
    this.setAttribute('aria-disabled', String(this.disabled))
    this.#internals.setFormValue(this.checked ? this.value : null)
    if (changed.has('disabled')) this.tabIndex = this.disabled ? -1 : 0
  }

  formResetCallback(): void {
    this.checked = this.#defaultChecked
  }

  formStateRestoreCallback(state: string | null): void {
    this.checked = state !== null
  }

  #onClick = (): void => {
    this.#toggle()
  }

  #onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    this.#toggle()
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
    return html`<div class="knob" part="knob"></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-switch': FdSwitch
  }

  interface HTMLElementEventMap {
    'fd-change': CustomEvent<{ checked: boolean }>
  }
}
