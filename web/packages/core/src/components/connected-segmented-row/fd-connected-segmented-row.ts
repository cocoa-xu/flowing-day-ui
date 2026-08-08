import { html, type TemplateResult } from 'lit'
import { customElement } from 'lit/decorators.js'
import type { CollectedOption } from '../../internal/options.js'
import { FdSegmentedRowBase } from '../../internal/segmented-row-base.js'

/**
 * A connected counterpart to `fd-segmented-row`: equal-width text segments share one
 * control surface, border, and contextual dividers while retaining radio-group semantics.
 *
 * @csspart segment - One segment in the connected control.
 */
@customElement('fd-connected-segmented-row')
export class FdConnectedSegmentedRow extends FdSegmentedRowBase {
  protected override get connected(): true {
    return true
  }

  protected override get segmentModifier(): 'compact' {
    return 'compact'
  }

  protected override renderSegmentContent(option: CollectedOption): TemplateResult {
    return html`<span class="segment-label">${option.label}</span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-connected-segmented-row': FdConnectedSegmentedRow
  }
}
