import { type CSSResultGroup, css, html } from 'lit'
import { customElement } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'

/**
 * Mirrors `SettingsPaneStack`: leading-aligned vertical stack using the standard
 * section spacing. `fd-section` stretches itself, matching its `maxWidth: .infinity`.
 *
 * @slot - Sections making up one settings page.
 */
@customElement('fd-pane-stack')
export class FdPaneStack extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--_fd-metric-section-spacing);
      }
    `,
  ]

  override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-pane-stack': FdPaneStack
  }
}
