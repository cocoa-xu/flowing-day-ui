import { type CSSResultGroup, css, html, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'

/**
 * Mirrors `SettingsFlowGrid`: items laid out left to right, wrapping when the next one
 * no longer fits, spaced equally on both axes and pushed to the leading edge.
 *
 * `SettingsWrappingLayout`, the custom `Layout` behind it, is `flex-wrap` here — it
 * places each item at its ideal size on the current row's top edge, which is what a
 * wrapping flex line does. Nothing of the 59-line implementation survives the crossing.
 *
 * @slot - The items to lay out.
 * @csspart grid - The wrapping container.
 */
@customElement('fd-flow-grid')
export class FdFlowGrid extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        --_spacing: var(--fd-flow-grid-spacing, 7px);
      }

      .grid {
        display: flex;
        flex-wrap: wrap;
        /* Placed at the row's top edge at their ideal size, never stretched to it. */
        align-items: flex-start;
        justify-content: flex-start;
        gap: var(--_spacing);
        padding-inline: var(--_fd-metric-row-inset);
        padding-block: 13px;
      }
    `,
  ]

  /** `SettingsFlowGrid.spacing`, applied to both axes. */
  @property({ type: Number }) spacing = 7

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    this.style.setProperty('--_spacing', `${this.spacing}px`)
  }

  override render() {
    return html`<div class="grid" part="grid"><slot></slot></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-flow-grid': FdFlowGrid
  }
}
