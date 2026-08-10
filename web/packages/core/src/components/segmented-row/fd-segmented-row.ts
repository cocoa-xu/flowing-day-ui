import { html, type TemplateResult } from 'lit'
import { customElement } from 'lit/decorators.js'
import type { CollectedOption } from '../../internal/options.js'
import { FdSegmentedRowBase } from '../../internal/segmented-row-base.js'
import '../icon/fd-icon.js'
import '../option/fd-option.js'
import '../row/fd-row.js'

/**
 * Mirrors `PreferencesSegmentedRow`: a fixed-width strip of single-select pills using
 * the same label and symbol treatments as `FlowingSegmentedControl`.
 *
 * `minimumScaleFactor(0.72)` has no CSS equivalent; an over-long label truncates here
 * instead of shrinking to fit.
 *
 * @fires fd-change - `{ value: string }` when the selection changes.
 * @csspart segment - One pill in the strip.
 */
@customElement('fd-segmented-row')
export class FdSegmentedRow extends FdSegmentedRowBase {
  protected override renderSegmentContent(option: CollectedOption): TemplateResult {
    return option.symbol
      ? html`<fd-icon class="segment-icon" name=${option.symbol}></fd-icon>`
      : html`<span class="segment-label">${option.label}</span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-segmented-row': FdSegmentedRow
  }
}
