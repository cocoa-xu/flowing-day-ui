import { html, type TemplateResult } from 'lit'
import { customElement } from 'lit/decorators.js'
import type { CollectedOption } from '../../internal/options.js'
import { FdSegmentedRowBase } from '../../internal/segmented-row-base.js'
import '../icon/fd-icon.js'
import '../option/fd-option.js'
import '../row/fd-row.js'

/**
 * Mirrors `SettingsSymbolSegmentedRow`: a strip whose segments draw an icon where one is
 * given and the label otherwise, with the label as the tooltip and accessible name.
 *
 * @fires fd-change - `{ value: string }` when the selection changes.
 * @csspart segment - One pill in the strip.
 */
@customElement('fd-symbol-segmented-row')
export class FdSymbolSegmentedRow extends FdSegmentedRowBase {
  protected override get segmentModifier(): 'symbol' {
    return 'symbol'
  }

  protected override segmentTitle(option: CollectedOption): string {
    return option.label
  }

  protected override renderSegmentContent(option: CollectedOption): TemplateResult {
    return option.symbol
      ? html`<fd-icon
          class="segment-icon"
          name=${option.symbol}
          label=${option.label}
        ></fd-icon>`
      : html`<span class="segment-label">${option.label}</span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-symbol-segmented-row': FdSymbolSegmentedRow
  }
}
