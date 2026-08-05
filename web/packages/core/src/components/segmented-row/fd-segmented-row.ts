import { html, type TemplateResult } from 'lit'
import { customElement } from 'lit/decorators.js'
import type { CollectedOption } from '../../internal/options.js'
import { FdSegmentedRowBase } from '../../internal/segmented-row-base.js'
import '../option/fd-option.js'
import '../row/fd-row.js'

/**
 * Mirrors `SettingsSegmentedRow`: a fixed-width strip of single-select pills whose
 * labels are compact, so they take the 6pt horizontal padding rather than 9pt.
 *
 * `minimumScaleFactor(0.72)` has no CSS equivalent; an over-long label truncates here
 * instead of shrinking to fit.
 *
 * @fires fd-change - `{ value: string }` when the selection changes.
 * @csspart segment - One pill in the strip.
 */
@customElement('fd-segmented-row')
export class FdSegmentedRow extends FdSegmentedRowBase {
  protected override get segmentModifier(): 'compact' {
    return 'compact'
  }

  protected override renderSegmentContent(option: CollectedOption): TemplateResult {
    return html`<span class="segment-label">${option.label}</span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-segmented-row': FdSegmentedRow
  }
}
