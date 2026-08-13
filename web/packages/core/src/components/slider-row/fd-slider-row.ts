import { type CSSResultGroup, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { textRole } from '../../internal/typography.js'
import '../icon/fd-icon.js'
import '../slider/fd-slider.js'

/**
 * Mirrors `PreferencesSliderRow`: title and formatted value on one line, the slider under
 * it, and an optional caption below. A `VStack`, not a `PreferencesRow` — the header stack
 * spaces by 10 rather than 14, and the slider spans the full width beneath it.
 *
 * @fires fd-change - `{ valueAsNumber }`, re-dispatched from the slider.
 * @csspart value - The formatted value.
 * @csspart slider - The slider itself.
 */
@customElement('fd-slider-row')
export class FdSliderRow extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      .stack {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 7px;
        padding-inline: var(--_fd-metric-row-inset);
        padding-block: 11px;
      }

      .header {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .symbol {
        width: 20px;
        flex: none;
        display: flex;
        justify-content: center;
        font-size: 13px;
        font-weight: 500;
        color: var(--_fd-palette-muted);
      }

      .label {
        ${textRole('row-title')}
        color: var(--_fd-palette-ink);
      }

      /* Spacer(minLength: 10) */
      .spacer {
        flex: 1 1 auto;
        min-width: 10px;
      }

      .value {
        ${textRole('slider-value')}
        flex: none;
        color: var(--_fd-palette-muted);
      }

      .caption {
        ${textRole('row-caption')}
        color: var(--_fd-palette-faint);
      }
    `,
  ]

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) caption: string | null = null

  @property({ type: Number }) value = 0

  @property({ type: Number }) min = 0

  @property({ type: Number }) max = 1

  @property({ type: Number }) step: number | null = null

  @property({ type: Boolean, reflect: true }) disabled = false

  @property({ reflect: true }) name = ''

  /** `PreferencesSliderRow.format`. Defaults to the bare number. */
  @property({ attribute: false }) format: (value: number) => string = String

  #onSliderChange = (event: CustomEvent<{ valueAsNumber?: number }>): void => {
    this.value = event.detail.valueAsNumber ?? this.value
  }

  override render() {
    return html`
      <div class="stack">
        <div class="header">
          ${this.symbol ? html`<fd-icon class="symbol" name=${this.symbol}></fd-icon>` : nothing}
          <span class="label">${this.label}</span>
          <span class="spacer"></span>
          <span class="value" part="value">${this.format(this.value)}</span>
        </div>
        <fd-slider
          part="slider"
          exportparts="track, progress, knob"
          name=${this.name}
          .label=${this.label}
          .value=${this.value}
          .min=${this.min}
          .max=${this.max}
          .step=${this.step}
          .formatValue=${this.format}
          ?disabled=${this.disabled}
          @fd-change=${this.#onSliderChange}
        ></fd-slider>
        ${this.caption ? html`<span class="caption">${this.caption}</span>` : nothing}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-slider-row': FdSliderRow
  }
}
