import { type CSSResultGroup, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import '../separator/fd-separator.js'

/**
 * Mirrors `SettingsDependentRows`: sub-rows revealed only while a controlling value is
 * on, with the separator, transition, animation and Reduce Motion behaviour owned here
 * rather than by the caller.
 *
 * The collapse animates `grid-template-rows` between `0fr` and `1fr`, which is the one
 * technique that animates to an unknown content height in every current browser.
 * Duration, easing and the -5px entry offset all come from the motion tokens, so Reduce
 * Motion shortens and flattens this exactly as `SettingsDependentRowsMotion` does.
 *
 * @slot - The dependent rows.
 */
@customElement('fd-dependent-rows')
export class FdDependentRows extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: grid;
        grid-template-rows: 0fr;
        transition: grid-template-rows var(--_fd-motion-disclosure) var(--_fd-motion-easing);
      }

      :host([visible]) {
        grid-template-rows: 1fr;
      }

      /* The .clipped() that keeps the rows from spilling out mid-collapse. */
      .clip {
        min-height: 0;
        overflow: hidden;
      }

      .content {
        opacity: 0;
        translate: 0 var(--_fd-motion-disclosure-offset);
        transition:
          opacity var(--_fd-motion-disclosure) var(--_fd-motion-easing),
          translate var(--_fd-motion-disclosure) var(--_fd-motion-easing);
      }

      :host([visible]) .content {
        opacity: 1;
        translate: 0 0;
      }
    `,
  ]

  @property({ type: Boolean, reflect: true }) visible = false

  /** Mirrors `showsSeparator`, which defaults to true. */
  @property({ type: Boolean, attribute: 'no-separator', reflect: true }) noSeparator = false

  /** Mirrors `isSeparatorIndented`, which defaults to true. */
  @property({ type: Boolean, attribute: 'separator-flush', reflect: true }) separatorFlush = false

  override render() {
    return html`
      <div class="clip">
        <div class="content">
          ${
            this.noSeparator
              ? nothing
              : html`<fd-separator ?indented=${!this.separatorFlush}></fd-separator>`
          }
          <slot></slot>
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-dependent-rows': FdDependentRows
  }
}
