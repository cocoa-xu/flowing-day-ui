import { type CSSResultGroup, css, html, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import type { FdEdgeInsets } from '../../internal/overlay-position.js'

export type FdHorizontalAlignment = 'leading' | 'center' | 'trailing'

/**
 * Mirrors `PreferencesCard`: rounded, hairline-bordered container that clips a
 * vertical stack of rows.
 *
 * @slot - Rows to stack, typically `fd-row` variants separated by `fd-separator`.
 */
@customElement('fd-card')
export class FdCard extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: var(--_alignment);
        gap: var(--_spacing);
        background: var(--_fd-surface-card);
        border-radius: var(--_fd-metric-card-radius);
        overflow: hidden;
      }

      /* strokeBorder draws inside the shape, so an inset overlay rather than a border. */
      :host::after {
        content: '';
        position: absolute;
        inset: 0;
        border: 1px solid var(--_fd-palette-edge);
        border-radius: inherit;
        pointer-events: none;
      }
    `,
  ]

  @property({ reflect: true }) alignment: FdHorizontalAlignment = 'leading'

  @property({ type: Number }) spacing = 0

  @property({ attribute: false }) contentInsets: FdEdgeInsets = {
    top: 0,
    leading: 0,
    bottom: 0,
    trailing: 0,
  }

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    const alignment =
      this.alignment === 'center'
        ? 'center'
        : this.alignment === 'trailing'
          ? 'flex-end'
          : 'flex-start'
    const spacing = Number.isFinite(this.spacing) && this.spacing >= 0 ? this.spacing : 0
    const inset = (value: number): number => (Number.isFinite(value) ? Math.max(0, value) : 0)
    this.style.setProperty('--_alignment', alignment)
    this.style.setProperty('--_spacing', `${spacing}px`)
    this.style.paddingBlockStart = `${inset(this.contentInsets.top)}px`
    this.style.paddingInlineStart = `${inset(this.contentInsets.leading)}px`
    this.style.paddingBlockEnd = `${inset(this.contentInsets.bottom)}px`
    this.style.paddingInlineEnd = `${inset(this.contentInsets.trailing)}px`
  }

  override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-card': FdCard
  }
}
