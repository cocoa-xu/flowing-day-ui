import { type CSSResultGroup, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { tagStyles } from '../../internal/tag.js'

/**
 * Mirrors `SettingsTag`: a static accent-veiled pill in the monospaced tag role. It takes
 * no action and no state — pair it with `fd-flow-grid` to lay a set of them out.
 *
 * @csspart tag - The pill.
 */
@customElement('fd-tag')
export class FdTag extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    tagStyles,
    css`
      :host {
        display: inline-flex;
      }
    `,
  ]

  /** Falls back to the element's text content. */
  @property({ reflect: true }) label: string | null = null

  override render() {
    return html`<span class="tag" part="tag">${this.label ?? html`<slot></slot>`}</span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-tag': FdTag
  }
}
