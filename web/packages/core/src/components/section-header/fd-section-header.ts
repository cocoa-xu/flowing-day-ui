import { css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { textRole } from '../../internal/typography.js'

@customElement('fd-section-header')
export class FdSectionHeader extends FdElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        ${textRole('section-header')}
        display: block;
        padding-inline-start: 4px;
        padding-bottom: 7px;
        color: var(--_fd-palette-faint);
        letter-spacing: 0.7px;
        text-transform: uppercase;
      }
    `,
  ]

  @property({ reflect: true }) label = ''

  override render() {
    return html`<slot>${this.label}</slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-section-header': FdSectionHeader
  }
}
