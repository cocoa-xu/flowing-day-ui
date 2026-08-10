import { type CSSResultGroup, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { textRole } from '../../internal/typography.js'
import '../icon/fd-icon.js'

export type FdEmptyStateLayout = 'inline' | 'stacked'

/**
 * The reusable counterpart to `FlowingEmptyState`.
 *
 * @slot - Custom message content. Falls back to `message`.
 * @csspart icon - The optional icon.
 * @csspart message - The message content.
 */
@customElement('fd-empty-state')
export class FdEmptyState extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        ${textRole('value')}
        display: flex;
        width: 100%;
        color: var(--_fd-palette-faint);
      }

      .state {
        display: flex;
        width: 100%;
      }

      :host([layout='inline']) .state {
        align-items: baseline;
        justify-content: flex-start;
        gap: 10px;
      }

      :host([layout='stacked']) .state {
        align-items: center;
        flex-direction: column;
        justify-content: center;
        gap: 10px;
        text-align: center;
      }

      .icon {
        flex: none;
      }

      :host([layout='inline']) .icon {
        width: 18px;
      }

      :host([layout='stacked']) .icon {
        width: 22px;
        height: 22px;
        font-size: 22px;
      }

      .message {
        min-width: 0;
      }
    `,
  ]

  @property({ reflect: true }) message = ''

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) layout: FdEmptyStateLayout = 'stacked'

  override render() {
    return html`
      <div class="state">
        ${
          this.symbol
            ? html`<fd-icon class="icon" part="icon" name=${this.symbol}></fd-icon>`
            : nothing
        }
        <span class="message" part="message"><slot>${this.message}</slot></span>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-empty-state': FdEmptyState
  }
}
