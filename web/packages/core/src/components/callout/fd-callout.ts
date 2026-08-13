import { css, html, nothing, svg } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
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

function defaultStatusGlyph(tone: FdStatusTone) {
  if (tone === 'success') {
    return svg`<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="m4.6 8.2 2.1 2.1 4.6-4.7" fill="none" stroke="var(--_fd-surface-canvas)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  }
  if (tone === 'warning') {
    return svg`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6 15 14H1L8 1.6Z" fill="currentColor"/><path d="M8 5v4.2" stroke="var(--_fd-surface-canvas)" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11.6" r=".8" fill="var(--_fd-surface-canvas)"/></svg>`
  }
  if (tone === 'critical') {
    return svg`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 1.5 6 0 3.5 3.5v6L11 14.5H5L1.5 11V5L5 1.5Z" fill="currentColor"/><path d="m5.6 5.6 4.8 4.8m0-4.8-4.8 4.8" stroke="var(--_fd-surface-canvas)" stroke-width="1.5" stroke-linecap="round"/></svg>`
  }
  if (tone === 'accent') {
    return svg`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.7 9.2 6.8 14.3 8l-5.1 1.2L8 14.3 6.8 9.2 1.7 8l5.1-1.2L8 1.7Z" fill="currentColor"/></svg>`
  }
  return svg`<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.7" fill=${tone === 'informational' ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="4.8" r=".8" fill=${tone === 'informational' ? 'var(--_fd-surface-canvas)' : 'currentColor'}/><path d="M8 7.2v4" stroke=${tone === 'informational' ? 'var(--_fd-surface-canvas)' : 'currentColor'} stroke-width="1.4" stroke-linecap="round"/></svg>`
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-callout': FdCallout
  }
}
