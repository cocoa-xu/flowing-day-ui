import { type CSSResultGroup, css, html, nothing, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { styleMap } from 'lit/directives/style-map.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { checkmark } from '../../internal/glyphs.js'
import {
  DEFAULT_TAIL_LENGTH,
  middleTruncated,
  middleTruncateStyles,
} from '../../internal/middle-truncate.js'
import { checkCircleFill, circleOutline } from '../../internal/selection.js'
import { textRole } from '../../internal/typography.js'
import '../icon/fd-icon.js'

export type FdCheckboxContentAlignment = 'leading' | 'center' | 'trailing'
export type FdCheckboxIndicatorPlacement = 'leading' | 'trailing'
export type FdCheckboxWidthPolicy = 'fill' | 'fit-content'
export type FdCheckboxTruncation = 'start' | 'middle' | 'end'

/**
 * The reusable counterpart to `FlowingCheckbox`.
 *
 * @fires fd-change - `{ checked: boolean }` after a user interaction.
 * @csspart button - The complete checkbox surface.
 * @csspart icon - The optional leading icon.
 * @csspart indicator - The selection indicator.
 */
@customElement('fd-checkbox')
export class FdCheckbox extends FdElement {
  static formAssociated = true

  static override styles: CSSResultGroup = [
    baseStyles,
    middleTruncateStyles,
    css`
      :host {
        display: flex;
        min-width: 0;
      }

      :host([width-policy='fit-content']) {
        display: inline-flex;
        max-width: var(--_maximum-width, 100%);
      }

      .button {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 6px;
        width: 100%;
        min-width: 0;
        padding: 7px 9px;
        border: 0;
        border-radius: var(--_fd-metric-control-radius);
        background: var(--_fd-surface-control);
        box-shadow: inset 0 0 0 1px var(--_fd-palette-hairline);
        color: var(--_fd-palette-muted);
        font: inherit;
        text-align: start;
        cursor: pointer;
        transition:
          background-color var(--_fd-motion-default) ease-in-out,
          color var(--_fd-motion-default) ease-in-out,
          box-shadow var(--_fd-motion-default) ease-in-out;
      }

      :host([content-alignment='center']) .button {
        justify-content: center;
      }

      :host([content-alignment='trailing']) .button {
        justify-content: flex-end;
      }

      .button[data-selected] {
        background: var(--_accent-wash);
        box-shadow: inset 0 0 0 1px
          color-mix(in srgb, var(--_accent-foreground) 22%, transparent);
        color: var(--_accent-foreground);
      }

      .button:focus-visible {
        outline: 2px solid var(--_accent-fill);
        outline-offset: 2px;
      }

      :host([disabled]) .button {
        cursor: default;
        opacity: 0.4;
      }

      .label {
        ${textRole('selection-label')}
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      :host([content-alignment='center']) .label {
        text-align: center;
      }

      :host([content-alignment='trailing']) .label {
        text-align: end;
      }

      :host([truncation='start']) .label {
        direction: rtl;
        text-align: start;
      }

      :host([truncation='middle']) .label {
        display: flex;
        text-align: start;
        text-overflow: clip;
      }

      :host([indicator-placement='trailing'][width-policy='fill']) .label {
        flex: 1 1 auto;
      }

      .mark {
        flex: none;
        width: 11px;
        height: 11px;
      }

      .icon {
        flex: none;
        width: 14px;
        color: color-mix(in srgb, var(--_accent-fill) 30%, transparent);
        font-size: 9px;
      }

      .button[data-selected] .icon {
        color: var(--_accent-fill);
      }

      .icon-indicator {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: none;
        width: 15px;
        height: 15px;
        border-radius: 50%;
        box-shadow: inset 0 0 0 1px var(--_fd-palette-edge);
        color: #fff;
      }

      .button[data-selected] .icon-indicator {
        background: var(--_accent-fill);
        box-shadow: inset 0 0 0 1px var(--_accent-fill);
      }

      .icon-indicator svg {
        width: 7px;
        height: 7px;
        opacity: 0;
      }

      .button[data-selected] .icon-indicator svg {
        opacity: 1;
      }

      :host([symbol]) .button {
        gap: 9px;
        height: 31px;
        padding: 0 10px;
        color: var(--_fd-palette-faint);
      }

      :host([symbol]) .button[data-selected] {
        background: color-mix(in srgb, var(--_accent-fill) 6.5%, transparent);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--_accent-fill) 15%, transparent);
        color: var(--_fd-palette-ink);
      }
    `,
  ]

  /** Falls back to the element's text content. */
  @property({ reflect: true }) label: string | null = null

  /** Icon registry key. Providing one selects the icon checkbox treatment. */
  @property({ reflect: true }) symbol: string | null = null

  /** Optional per-instance base accent as a CSS colour. */
  @property({ reflect: true }) accent: string | null = null

  @property({ type: Boolean, reflect: true }) checked = false

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true, attribute: 'content-alignment' })
  contentAlignment: FdCheckboxContentAlignment = 'leading'

  @property({ reflect: true, attribute: 'indicator-placement' })
  indicatorPlacement: FdCheckboxIndicatorPlacement = 'leading'

  @property({ reflect: true, attribute: 'width-policy' }) widthPolicy: FdCheckboxWidthPolicy =
    'fill'

  @property({ type: Number, attribute: 'maximum-width' }) maximumWidth: number | null = null

  @property({ reflect: true }) truncation: FdCheckboxTruncation = 'end'

  @property({ type: Number, attribute: 'tail-length' }) tailLength = DEFAULT_TAIL_LENGTH

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
    this.#internals.setFormValue(this.checked && !this.disabled ? this.value : null)
  }

  formResetCallback(): void {
    this.checked = this.#defaultChecked
  }

  formStateRestoreCallback(state: string | null): void {
    this.checked = state !== null
  }

  #toggle = (): void => {
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

  #renderIndicator() {
    if (this.symbol) {
      return html`<span class="icon-indicator" part="indicator">${checkmark}</span>`
    }
    return html`<span class="mark" part="indicator"
      >${this.checked ? checkCircleFill : circleOutline}</span
    >`
  }

  #renderLabel(label: string) {
    if (this.truncation !== 'middle') return html`<slot>${label}</slot>`
    const tailLength =
      Number.isFinite(this.tailLength) && this.tailLength >= 0
        ? Math.floor(this.tailLength)
        : DEFAULT_TAIL_LENGTH
    return middleTruncated(label, tailLength)
  }

  override render() {
    const label = this.label ?? this.textContent?.trim() ?? ''
    const base = this.accent ?? 'var(--fd-accent, var(--_fd-accent-fill))'
    const styles = {
      '--_maximum-width':
        this.maximumWidth !== null && Number.isFinite(this.maximumWidth) && this.maximumWidth > 0
          ? `${this.maximumWidth}px`
          : null,
      '--_accent-fill': this.accent
        ? `oklch(from ${base} calc(l + var(--_fd-accent-lift)) c h)`
        : 'var(--_fd-accent-fill)',
      '--_accent-foreground': this.accent
        ? 'oklch(from var(--_accent-fill) calc(l + var(--_fd-accent-contrast)) c h)'
        : 'var(--_fd-accent-foreground)',
      '--_accent-wash': this.accent
        ? 'color-mix(in srgb, var(--_accent-fill) 13%, transparent)'
        : 'var(--_fd-accent-wash)',
    }

    return html`
      <button
        class="button"
        part="button"
        type="button"
        role="checkbox"
        style=${styleMap(styles)}
        aria-checked=${this.checked}
        aria-label=${label}
        ?data-selected=${this.checked}
        ?disabled=${this.disabled}
        @click=${this.#toggle}
      >
        ${this.indicatorPlacement === 'leading' ? this.#renderIndicator() : nothing}
        ${this.symbol
          ? html`<fd-icon class="icon" part="icon" name=${this.symbol}></fd-icon>`
          : nothing}
        <span class="label">${this.#renderLabel(label)}</span>
        ${this.indicatorPlacement === 'trailing' ? this.#renderIndicator() : nothing}
      </button>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-checkbox': FdCheckbox
  }
}
