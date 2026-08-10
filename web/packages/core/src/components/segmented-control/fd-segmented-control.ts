import { customElement, property } from 'lit/decorators.js'
import { FdSegmentedControlBase } from '../../internal/segmented-control-base.js'
import '../option/fd-option.js'

/**
 * The reusable counterpart to `FlowingSegmentedControl`.
 *
 * @fires fd-change - `{ value: string }` when the selection changes.
 * @csspart control - The segment group.
 * @csspart segment - One segment.
 */
@customElement('fd-segmented-control')
export class FdSegmentedControl extends FdSegmentedControlBase {
  @property({ reflect: true }) override label = ''

  @property({ reflect: true }) override value: string | null = null

  @property({ type: Boolean, reflect: true }) override disabled = false

  @property({ reflect: true }) override name = ''
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-segmented-control': FdSegmentedControl
  }
}
