import { type CSSResultGroup, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { unsafeSVG } from 'lit/directives/unsafe-svg.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { FdIcons } from '../../internal/icon-registry.js'

/**
 * Renders an icon from the registry. Mirrors `Image(systemName:)`: the glyph takes its
 * size from `font-size` and its colour from `currentColor`, so callers style the parent.
 *
 * @csspart svg - The rendered icon markup.
 */
@customElement('fd-icon')
export class FdIcon extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1em;
        height: 1em;
        flex: none;
        color: inherit;
      }

      svg {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ]

  /** Registry key, conventionally the SF Symbol name (e.g. `gearshape`). */
  @property({ reflect: true }) name = ''

  /** Accessible label. Without one the icon is hidden from assistive technology. */
  @property({ attribute: 'label' }) label: string | null = null

  #unsubscribe: (() => void) | null = null

  override connectedCallback(): void {
    super.connectedCallback()
    this.#unsubscribe = FdIcons.subscribe(() => this.requestUpdate())
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#unsubscribe?.()
    this.#unsubscribe = null
  }

  override render() {
    const markup = FdIcons.resolve(this.name)

    if (this.label) {
      this.removeAttribute('aria-hidden')
      this.setAttribute('role', 'img')
      this.setAttribute('aria-label', this.label)
    } else {
      this.removeAttribute('role')
      this.removeAttribute('aria-label')
      this.setAttribute('aria-hidden', 'true')
    }

    return markup ? html`${unsafeSVG(markup)}` : nothing
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-icon': FdIcon
  }
}
