import { css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'

@customElement('fd-disclosure-content')
export class FdDisclosureContent extends FdElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: grid;
        grid-template-rows: 0fr;
        opacity: 0;
        translate: 0 var(--_fd-motion-disclosure-offset);
        transition:
          grid-template-rows var(--_fd-motion-disclosure) var(--_fd-motion-easing),
          opacity var(--_fd-motion-disclosure) var(--_fd-motion-easing),
          translate var(--_fd-motion-disclosure) var(--_fd-motion-easing);
      }

      :host([expanded]) {
        grid-template-rows: 1fr;
        opacity: 1;
        translate: 0 0;
      }

      .content {
        min-height: 0;
        overflow: hidden;
      }

      @media (prefers-reduced-motion: reduce) {
        :host {
          transition-duration: var(--_fd-motion-disclosure);
          transition-timing-function: linear;
          translate: 0 var(--_fd-motion-disclosure-offset);
        }

        :host([expanded]) {
          translate: 0 0;
        }
      }
    `,
  ]

  @property({ type: Boolean, reflect: true, attribute: 'expanded' }) isExpanded = false

  override render() {
    return html`<div class="content" part="content"><slot></slot></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-disclosure-content': FdDisclosureContent
  }
}
