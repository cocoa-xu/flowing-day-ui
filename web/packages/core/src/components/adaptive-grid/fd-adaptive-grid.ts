import { css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'

@customElement('fd-adaptive-grid')
export class FdAdaptiveGrid extends FdElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(var(--_minimum-width), 100%), 1fr));
      }
    `,
  ]

  @property({ type: Number, attribute: 'minimum-width' }) minimumWidth = 96

  @property({ type: Number }) spacing = 7

  override render() {
    const minimumWidth =
      Number.isFinite(this.minimumWidth) && this.minimumWidth > 0 ? this.minimumWidth : 96
    const spacing = Number.isFinite(this.spacing) && this.spacing >= 0 ? this.spacing : 7
    return html`
      <div
        class="grid"
        part="grid"
        style="--_minimum-width: ${minimumWidth}px; gap: ${spacing}px"
      >
        <slot></slot>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-adaptive-grid': FdAdaptiveGrid
  }
}
