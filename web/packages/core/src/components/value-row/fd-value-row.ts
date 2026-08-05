import { type CSSResultGroup, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { textRole } from '../../internal/typography.js'
import '../row/fd-row.js'

/**
 * Mirrors `SettingsValueRow`: a read-only value at the trailing edge, selectable and
 * truncated in the middle so both ends of a path or an identifier stay readable, with
 * room for a further control 10px after it.
 *
 * @slot trailing - An optional control after the value.
 * @csspart value - The value text.
 */
@customElement('fd-value-row')
export class FdValueRow extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      /* The value is a lineLimit(1) label, so it compresses instead of overflowing. */
      fd-row {
        --_fd-row-trailing-flex: 0 1 auto;
      }

      .value-group {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .value {
        ${textRole('value')}
        min-width: 0;
        color: var(--_fd-palette-muted);
        white-space: nowrap;
        /*
         * truncationMode(.middle). No CSS keyword truncates a middle, so the value is
         * split into a head that shrinks and a tail that never does; the ellipsis lands
         * between them exactly as it does in SwiftUI.
         */
        display: flex;
        user-select: text;
        -webkit-user-select: text;
      }

      .head {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .tail {
        flex: none;
        white-space: pre;
      }
    `,
  ]

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) label = ''

  /** The read-only value. `SettingsValueRow` takes no caption. */
  @property({ reflect: true }) value = ''

  /** Characters kept at the trailing end when the value is truncated. */
  @property({ type: Number, attribute: 'tail-length' }) tailLength = 8

  override render() {
    const split = Math.max(this.value.length - this.tailLength, 0)

    return html`
      <fd-row symbol=${this.symbol ?? ''} label=${this.label}>
        <span class="value-group" slot="trailing">
          <span class="value" part="value"
            ><span class="head">${this.value.slice(0, split)}</span
            ><span class="tail">${this.value.slice(split)}</span></span
          >
          <slot name="trailing"></slot>
        </span>
      </fd-row>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-value-row': FdValueRow
  }
}
