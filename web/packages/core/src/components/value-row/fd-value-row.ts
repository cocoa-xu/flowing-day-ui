import { type CSSResultGroup, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import {
  DEFAULT_TAIL_LENGTH,
  middleTruncated,
  middleTruncateStyles,
} from '../../internal/middle-truncate.js'
import { textRole } from '../../internal/typography.js'
import '../row/fd-row.js'

/**
 * Mirrors `PreferencesValueRow`: a read-only value at the trailing edge, selectable and
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
    middleTruncateStyles,
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
        color: var(--_fd-palette-muted);
        user-select: text;
        -webkit-user-select: text;
      }
    `,
  ]

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) label = ''

  /** The read-only value. `PreferencesValueRow` takes no caption. */
  @property({ reflect: true }) value = ''

  /** Characters kept at the trailing end when the value is truncated. */
  @property({ type: Number, attribute: 'tail-length' }) tailLength = DEFAULT_TAIL_LENGTH

  override render() {
    return html`
      <fd-row symbol=${this.symbol ?? ''} label=${this.label}>
        <span class="value-group" slot="trailing">
          <span class="value truncate" part="value"
            >${middleTruncated(this.value, this.tailLength)}</span
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
