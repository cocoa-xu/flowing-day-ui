import { customElement, property } from 'lit/decorators.js'
import { FdSegmentedControlBase } from '../../internal/segmented-control-base.js'
import '../option/fd-option.js'

/**
 * The reusable counterpart to `FlowingConnectedSegmentedControl`.
 *
 * @fires fd-change - `{ value: string }` when the selection changes.
 * @csspart control - The connected segment group.
 * @csspart segment - One segment.
 */
@customElement('fd-connected-segmented-control')
export class FdConnectedSegmentedControl extends FdSegmentedControlBase {
  @property({ reflect: true }) override label = ''

  @property({ reflect: true }) override value: string | null = null

  @property({ type: Boolean, reflect: true }) override disabled = false

  @property({ reflect: true }) override name = ''

  protected override get connected(): true {
    return true
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-connected-segmented-control': FdConnectedSegmentedControl
  }
}
