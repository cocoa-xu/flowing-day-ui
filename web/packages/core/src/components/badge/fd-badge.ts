import { css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { textRole } from '../../internal/typography.js'
import '../icon/fd-icon.js'

export type FdStatusTone =
  | 'neutral'
  | 'accent'
  | 'informational'
  | 'success'
  | 'warning'
  | 'critical'

export type FdBadgeEmphasis = 'subtle' | 'strong'

@customElement('fd-badge')
export class FdBadge extends FdElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        --_tone: var(--_fd-palette-muted);
        display: inline-flex;
        max-width: 100%;
      }

      :host([tone='accent']) {
        --_tone: var(--_fd-accent-foreground);
      }

      :host([tone='informational']) {
        --_tone: light-dark(#007aff, #0a84ff);
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

      .badge {
        ${textRole('selection-label')}
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border: 1px solid transparent;
        border-radius: 999px;
        background: color-mix(in srgb, var(--_tone) 8%, transparent);
        color: var(--_tone);
      }

      :host([emphasis='strong']) .badge {
        border-color: color-mix(in srgb, var(--_tone) 24%, transparent);
        background: color-mix(in srgb, var(--_tone) 15%, transparent);
      }

      fd-icon {
        width: 8.5px;
        height: 8.5px;
        flex: none;
        font-size: 8.5px;
      }

      .title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `,
  ]

  @property({ attribute: 'title-text' }) override title = ''

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) tone: FdStatusTone = 'neutral'

  @property({ reflect: true }) emphasis: FdBadgeEmphasis = 'subtle'

  override render() {
    return html`
      <span class="badge" part="badge">
        ${this.symbol ? html`<fd-icon name=${this.symbol} part="icon"></fd-icon>` : nothing}
        <span class="title" part="label"><slot>${this.title}</slot></span>
      </span>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-badge': FdBadge
  }
}
