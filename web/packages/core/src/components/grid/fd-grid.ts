import { type CSSResultGroup, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'

/**
 * Mirrors `PreferencesGrid`: a `LazyVGrid` over `GridItem(.adaptive(minimum:))`, which fits
 * as many equal columns of at least that width as the row allows.
 *
 * @slot - The items to lay out.
 * @csspart grid - The grid container.
 */
@customElement('fd-grid')
export class FdGrid extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      .grid {
        display: grid;
        /*
         * min() so a container narrower than the minimum still yields one column that
         * fits, as .adaptive does, rather than one column that overflows.
         */
        grid-template-columns: repeat(auto-fill, minmax(min(var(--_minimum-width), 100%), 1fr));
        padding-inline: var(--_fd-metric-row-inset);
        padding-block: 13px;
      }
    `,
  ]

  /** `GridItem(.adaptive(minimum:))`, which defaults to 96. */
  @property({ type: Number, attribute: 'minimum-width' }) minimumWidth = 96

  override render() {
    return html`
      <div
        class="grid"
        part="grid"
        style="--_minimum-width: ${this.minimumWidth}px; gap: 7px"
      >
        <slot></slot>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-grid': FdGrid
  }
}
