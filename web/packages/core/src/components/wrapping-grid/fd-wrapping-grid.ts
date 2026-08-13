import { css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'

@customElement('fd-wrapping-grid')
export class FdWrappingGrid extends FdElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      .grid {
        display: flex;
        align-items: flex-start;
        flex-wrap: wrap;
      }
    `,
  ]

  @property({ type: Number }) spacing = 7

  override render() {
    const spacing = Number.isFinite(this.spacing) && this.spacing >= 0 ? this.spacing : 7
    return html`<div class="grid" part="grid" style="gap: ${spacing}px"><slot></slot></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-wrapping-grid': FdWrappingGrid
  }
}
