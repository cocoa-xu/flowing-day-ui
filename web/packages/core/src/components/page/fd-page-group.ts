import { type CSSResultGroup, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { FdElement } from '../../internal/base-element.js'

/**
 * Mirrors `SettingsPageGroup`. Renders as `display: contents` so its pages take part in
 * the window's content layout directly.
 *
 * @slot - `fd-page` children.
 */
@customElement('fd-page-group')
export class FdPageGroup extends FdElement {
  static override styles: CSSResultGroup = css`
    :host {
      display: contents;
    }
  `

  /** Uppercase heading above the group in the sidebar. */
  @property({ reflect: true }) label: string | null = null

  @property({ type: Boolean, reflect: true }) indented = false

  override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-page-group': FdPageGroup
  }
}
