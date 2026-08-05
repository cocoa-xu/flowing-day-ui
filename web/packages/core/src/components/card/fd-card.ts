import { type CSSResultGroup, css, html } from 'lit'
import { customElement } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'

/**
 * Mirrors `SettingsCard`: rounded, hairline-bordered container that clips a
 * vertical stack of rows.
 *
 * @slot - Rows to stack, typically `fd-row` variants separated by `fd-separator`.
 */
@customElement('fd-card')
export class FdCard extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        position: relative;
        display: flex;
        flex-direction: column;
        background: var(--_fd-surface-card);
        border-radius: var(--_fd-metric-card-radius);
        overflow: hidden;
      }

      /* strokeBorder draws inside the shape, so an inset overlay rather than a border. */
      :host::after {
        content: '';
        position: absolute;
        inset: 0;
        border: 1px solid var(--_fd-palette-edge);
        border-radius: inherit;
        pointer-events: none;
      }
    `,
  ]

  override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-card': FdCard
  }
}
