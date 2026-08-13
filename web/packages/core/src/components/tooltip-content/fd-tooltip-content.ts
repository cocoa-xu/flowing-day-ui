import { css, html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { hasMeaningfulSlotContent } from '../../internal/slot-content.js'
import { textRole } from '../../internal/typography.js'
import '../icon/fd-icon.js'

@customElement('fd-tooltip-content')
export class FdTooltipContent extends FdElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
        box-sizing: border-box;
        max-width: 260px;
        padding: 8px 10px;
      }

      .content {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }

      fd-icon {
        width: 15px;
        height: 15px;
        color: var(--_fd-palette-muted);
        font-size: 11px;
      }

      .copy {
        min-width: 0;
      }

      .title {
        ${textRole('row-title')}
        margin: 0;
        color: var(--_fd-palette-ink);
      }

      .message {
        ${textRole('row-caption')}
        margin: 0;
        color: var(--_fd-palette-muted);
      }

      .title + .message {
        margin-top: 2px;
      }
    `,
  ]

  @property({ reflect: true, attribute: 'title-text' }) override title = ''

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) message = ''

  @state() private detectedCustomContent = false

  #onSlotChange = (event: Event): void => {
    this.detectedCustomContent = hasMeaningfulSlotContent(
      (event.target as HTMLSlotElement).assignedNodes({ flatten: true }),
    )
  }

  override render() {
    return html`
      <div class="content">
        ${this.symbol ? html`<fd-icon name=${this.symbol}></fd-icon>` : nothing}
        <div class="copy">
          ${this.title ? html`<p class="title">${this.title}</p>` : nothing}
          <p class="message">
            <slot @slotchange=${this.#onSlotChange}></slot>
            ${this.detectedCustomContent ? nothing : this.message}
          </p>
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-tooltip-content': FdTooltipContent
  }
}
