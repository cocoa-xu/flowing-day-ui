import { type CSSResultGroup, css, html, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { FdElement } from '../../internal/base-element.js'

export type FdPageIcon = string

/**
 * Mirrors `PreferencesPage`. Declared as a child of `fd-preferences-window`, which reads the
 * metadata to build the sidebar and shows only the active page's content.
 *
 * @slot - The page body, typically an `fd-pane-stack`.
 */
@customElement('fd-page')
export class FdPage extends FdElement {
  static override styles: CSSResultGroup = css`
    :host {
      display: none;
    }

    :host([active]) {
      display: block;
    }
  `

  /** Identifier used by `fd-preferences-window`'s `page` attribute. */
  @property({ attribute: 'page-id', reflect: true }) pageId = ''

  @property({ reflect: true }) label = ''

  @property({ reflect: true }) subtitle: string | null = null

  /** Icon registry key for the sidebar row. */
  @property({ reflect: true }) icon: FdPageIcon | null = null

  /** Mirrors `headerIcon`, which falls back to `icon`. */
  @property({ attribute: 'header-icon', reflect: true }) headerIcon: FdPageIcon | null = null

  /**
   * Mirrors `PreferencesPage(accent:)`. One colour: the fill, foreground, wash and veil all
   * derive from it, in both appearances.
   */
  @property({ reflect: true }) accent: string | null = null

  /** Escape hatch for a foreground the derivation does not suit. */
  @property({ attribute: 'accent-foreground', reflect: true }) accentForeground: string | null =
    null

  /** Mirrors `isAvailable: false`: dimmed and not selectable. */
  @property({ type: Boolean, reflect: true }) unavailable = false

  /** Set by `fd-preferences-window`; not intended to be authored. */
  @property({ type: Boolean, reflect: true }) active = false

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    // The page's own content lives in light DOM, so its accent has to be published here
    // rather than by the window: slotted nodes inherit from their light-DOM parent.
    for (const [token, value] of [
      ['--fd-accent', this.accent],
      ['--fd-accent-foreground', this.accentForeground],
    ] as const) {
      if (value) this.style.setProperty(token, value)
      else this.style.removeProperty(token)
    }
  }

  override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-page': FdPage
  }
}
