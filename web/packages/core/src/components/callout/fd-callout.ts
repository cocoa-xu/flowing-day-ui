import { css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { defaultStatusGlyph } from '../../internal/status-glyph.js'
import { textRole } from '../../internal/typography.js'
import type { FdStatusTone } from '../badge/fd-badge.js'
import '../icon/fd-icon.js'

export type FdCalloutPresentation = 'inline' | 'card'

@customElement('fd-callout')
export class FdCallout extends FdElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        --_tone: light-dark(#007aff, #0a84ff);
        display: block;
      }

      :host([tone='neutral']) {
        --_tone: var(--_fd-palette-muted);
      }

      :host([tone='accent']) {
        --_tone: var(--_fd-accent-foreground);
      }

      :host([tone='success']) {
        --_tone: light-dark(#248a3d, #30d158);
      }

      :host([tone='warning']) {
        --_tone: light-dark(#c93400, #ff9f0a);
      }

      :host([tone='critical']) {
        --_tone: light-dark(#d70015, #ff453a);
      }

      .callout {
        display: flex;
        align-items: flex-start;
        gap: 9px;
      }

      :host([presentation='card']) .callout,
      :host(:not([presentation])) .callout {
        padding: 11px;
        border: 1px solid color-mix(in srgb, var(--_tone) 16%, transparent);
        border-radius: var(--_fd-metric-control-radius);
        background: color-mix(in srgb, var(--_tone) 7%, transparent);
      }

      .symbol {
        display: grid;
        width: 16px;
        height: 16px;
        flex: 0 0 16px;
        color: var(--_tone);
        place-items: center;
      }

      .symbol svg,
      .symbol fd-icon {
        width: 12px;
        height: 12px;
        font-size: 12px;
      }

      .content {
        min-width: 0;
        flex: 1 1 auto;
      }

      .title {
        ${textRole('row-title')}
        margin-bottom: 3px;
        color: var(--_fd-palette-ink);
      }

      .message {
        ${textRole('body')}
        color: var(--_fd-palette-muted);
      }
    `,
  ]

  @property({ attribute: 'title-text' }) override title = ''

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) tone: FdStatusTone = 'informational'

  @property({ reflect: true }) presentation: FdCalloutPresentation = 'card'

  override render() {
    return html`
      <div class="callout" part="callout">
        <span class="symbol" part="icon">
          ${
            this.symbol
              ? html`<fd-icon name=${this.symbol}></fd-icon>`
              : defaultStatusGlyph(this.tone)
          }
        </span>
        <div class="content">
          ${this.title ? html`<div class="title" part="title">${this.title}</div>` : nothing}
          <div class="message" part="message"><slot></slot></div>
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-callout': FdCallout
  }
}
