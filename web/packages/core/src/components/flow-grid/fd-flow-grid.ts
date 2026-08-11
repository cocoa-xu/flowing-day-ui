import { type CSSResultGroup, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'

/**
 * Mirrors `PreferencesFlowGrid`: items laid out left to right, wrapping when the next one
 * no longer fits, spaced equally on both axes and pushed to the leading edge.
 *
 * `FlowingWrappingLayout`, the custom `Layout` behind it, places each item at its ideal
 * size on the current row's top edge, which is what a wrapping flex line does. None of
 * its 59 lines survive the crossing.
 *
 * @slot - The items to lay out.
 * @csspart grid - The wrapping container.
 */
@customElement('fd-flow-grid')
export class FdFlowGrid extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      .grid {
        display: flex;
        flex-wrap: wrap;
        /* Placed at the row's top edge at their ideal size, never stretched to it. */
        align-items: flex-start;
        padding-inline: var(--_fd-metric-row-inset);
        padding-block: 13px;
      }
    `,
  ]

  /** `PreferencesFlowGrid.spacing`, applied to both axes. */
  @property({ type: Number }) spacing = 7

  override render() {
    return html`
      <div class="grid" part="grid" style="gap: ${this.spacing}px"><slot></slot></div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-flow-grid': FdFlowGrid
  }
}
