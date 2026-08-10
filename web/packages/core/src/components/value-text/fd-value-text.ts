import { type CSSResultGroup, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import {
  DEFAULT_TAIL_LENGTH,
  middleTruncated,
  middleTruncateStyles,
} from '../../internal/middle-truncate.js'
import { textRole } from '../../internal/typography.js'

export type FdValueTextTruncation = 'start' | 'middle' | 'end'

/** The reusable counterpart to `FlowingValueText`. */
@customElement('fd-value-text')
export class FdValueText extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    middleTruncateStyles,
    css`
      :host {
        ${textRole('value')}
        display: block;
        min-width: 0;
        color: var(--_fd-palette-muted);
        white-space: nowrap;
        overflow: hidden;
      }

      :host([selection-enabled]) {
        -webkit-user-select: text;
        user-select: text;
      }

      .end,
      .start {
        display: block;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .start {
        direction: rtl;
        text-align: start;
      }
    `,
  ]

  @property({ reflect: true }) value = ''

  @property({ type: Boolean, reflect: true, attribute: 'selection-enabled' }) selectionEnabled =
    true

  @property({ reflect: true }) truncation: FdValueTextTruncation = 'middle'

  @property({ type: Number, attribute: 'tail-length' }) tailLength = DEFAULT_TAIL_LENGTH

  override render() {
    const tailLength =
      Number.isFinite(this.tailLength) && this.tailLength >= 0
        ? Math.floor(this.tailLength)
        : DEFAULT_TAIL_LENGTH
    if (this.truncation === 'middle') {
      return html`<span class="truncate" part="value"
        >${middleTruncated(this.value, tailLength)}</span
      >`
    }
    return html`<span class=${this.truncation} part="value">${this.value}</span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-value-text': FdValueText
  }
}
