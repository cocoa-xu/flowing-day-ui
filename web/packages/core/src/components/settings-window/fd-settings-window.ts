import { type CSSResultGroup, css, html, nothing, type PropertyValues, svg } from 'lit'
import { customElement, property, query, state } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { FdStringsRegistry } from '../../internal/strings.js'
import { textRole } from '../../internal/typography.js'
import type { FdPage } from '../page/fd-page.js'
import type { FdPageGroup } from '../page/fd-page-group.js'
import '../icon/fd-icon.js'
import '../page/fd-page-group.js'
import '../page/fd-page.js'

interface ResolvedGroup {
  label: string | null
  indented: boolean
  pages: FdPage[]
}

const xmark = svg`
  <svg viewBox="0 0 12 12" aria-hidden="true">
    <path
      d="M3 3 9 9 M9 3 3 9"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
  </svg>`

/**
 * Mirrors `SettingsView`: the sidebar, its hairline divider and the scrolling content
 * pane with a page header. `SettingsWindowPresenter`'s `NSPanel` is deliberately not
 * ported — this is the view, and the page decides how to present it.
 *
 * Pages are declared as light DOM so a static page can build a whole settings window
 * without any JavaScript:
 *
 * ```html
 * <fd-settings-window app-name="Afloat" page="general">
 *   <fd-page-group label="General">
 *     <fd-page page-id="general" label="General" symbol="gearshape">…</fd-page>
 *   </fd-page-group>
 * </fd-settings-window>
 * ```
 *
 * @slot - `fd-page-group` and `fd-page` children.
 * @slot app-icon - Artwork for the brand block, sized 32×32.
 * @fires fd-page-change - `{ page: string }` when the selection changes.
 * @fires fd-close - When the close button is pressed.
 * @csspart sidebar - The sidebar column.
 * @csspart content - The scrolling content pane.
 * @csspart page-header - The large page heading.
 */
@customElement('fd-settings-window')
export class FdSettingsWindow extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: flex;
        position: relative;
        overflow: hidden;
        background: var(--_fd-surface-canvas);
        border-radius: var(--_fd-window-radius);
      }

      :host::after {
        content: '';
        position: absolute;
        inset: 0;
        border: 1px solid var(--_fd-palette-edge);
        border-radius: inherit;
        pointer-events: none;
      }

      .sidebar {
        display: flex;
        flex-direction: column;
        flex: none;
        width: var(--_fd-sidebar-width);
        background: var(--_fd-surface-sidebar);
      }

      .divider {
        flex: none;
        width: 1px;
        background: var(--_fd-palette-hairline);
      }

      /* 24×32 hit target around a 16×16 circle, inset 8pt from the leading edge. */
      .close {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: none;
        align-self: flex-start;
        width: 24px;
        height: 32px;
        margin-inline-start: 8px;
        margin-block-start: 4px;
        padding: 0;
        border: 0;
        background: none;
        cursor: pointer;
      }

      .close-dot {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--_fd-surface-field);
        color: var(--_fd-palette-muted);
        transition:
          background-color var(--_fd-motion-hover) var(--_fd-motion-easing),
          color var(--_fd-motion-hover) var(--_fd-motion-easing);
      }

      .close:hover .close-dot {
        background: var(--_fd-close-hover);
        color: rgb(0 0 0 / 0.55);
      }

      .close-dot svg {
        width: 8px;
        height: 8px;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 11px;
        padding-inline: 20px;
        padding-block: 5px 22px;
      }

      .brand-icon {
        display: flex;
        flex: none;
        width: 32px;
        height: 32px;
      }

      .brand-icon::slotted(*) {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .brand-text {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
      }

      .brand-name {
        ${textRole('brand-title')}
        color: var(--_fd-palette-ink);
      }

      .brand-subtitle {
        ${textRole('brand-subtitle')}
        color: var(--_fd-palette-faint);
      }

      .nav {
        display: flex;
        flex-direction: column;
        gap: 18px;
        flex: 1 1 auto;
        min-height: 0;
        padding-inline: 12px;
        overflow-y: auto;
        scrollbar-width: none;
      }

      .nav::-webkit-scrollbar {
        display: none;
      }

      .group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .group-label {
        ${textRole('sidebar-group')}
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--_fd-palette-faint);
        padding-inline: 8px;
        padding-block-end: 3px;
      }

      .nav-row {
        display: flex;
        align-items: center;
        gap: 9px;
        width: 100%;
        padding-inline: 10px;
        padding-block: 8px;
        border: 0;
        border-radius: 10px;
        background: none;
        font: inherit;
        text-align: start;
        cursor: pointer;
      }

      .nav-row[data-indented] {
        padding-inline-start: 20px;
      }

      /* Swift layers accent.wash over surfaces.control for the selected row. */
      .nav-row[aria-current='page'] {
        background:
          linear-gradient(0deg, var(--_fd-accent-wash) 0 100%),
          var(--_fd-surface-control);
      }

      .nav-row[disabled] {
        opacity: 0.45;
        cursor: default;
      }

      .nav-icon {
        flex: none;
        width: 18px;
        font-size: 12px;
        color: var(--_fd-palette-muted);
      }

      .nav-row[aria-current='page'] .nav-icon {
        color: var(--_fd-accent-foreground);
      }

      .nav-label {
        ${textRole('sidebar-item')}
        flex: 1 1 auto;
        min-width: 0;
        color: var(--_fd-palette-muted);
      }

      .nav-row[aria-current='page'] .nav-label {
        ${textRole('sidebar-item-selected')}
        color: var(--_fd-palette-ink);
      }

      .sidebar-footer {
        ${textRole('brand-subtitle')}
        flex: none;
        margin-block-start: 14px;
        padding-inline: 20px;
        padding-block-end: 18px;
        color: var(--_fd-palette-faint);
      }

      .content {
        flex: 1 1 auto;
        min-width: 0;
        overflow-y: auto;
        background: var(--_fd-surface-canvas);
      }

      /*
       * SwiftUI caps the column before padding is applied, so the border-box default
       * would make the content 68pt narrower than the original.
       */
      .content-inner {
        display: flex;
        flex-direction: column;
        gap: 28px;
        box-sizing: content-box;
        max-width: var(--_fd-metric-content-width);
        padding: 38px 34px 40px;
      }

      .page-header {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .page-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: none;
        width: 38px;
        height: 38px;
        border-radius: 11px;
        background: var(--_fd-accent-wash);
        font-size: 15px;
        color: var(--_fd-accent-foreground);
      }

      .page-text {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }

      .page-title {
        ${textRole('page-title')}
        color: var(--_fd-palette-ink);
      }

      .page-subtitle {
        ${textRole('page-subtitle')}
        color: var(--_fd-palette-muted);
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
      }
    `,
  ]

  @property({ attribute: 'app-name', reflect: true }) appName = ''

  @property({ attribute: 'settings-title', reflect: true }) settingsTitle = 'Settings'

  @property({ attribute: 'sidebar-footer', reflect: true }) sidebarFooter: string | null = null

  /** The selected `fd-page`'s `page-id`. */
  @property({ reflect: true }) page: string | null = null

  /** Suppresses the close button for embeds that have nothing to close. */
  @property({ type: Boolean, attribute: 'hide-close', reflect: true }) hideClose = false

  @state() private groups: ResolvedGroup[] = []

  @query('.content-inner') private contentInner!: HTMLElement

  #observer: MutationObserver | null = null

  get pages(): FdPage[] {
    return this.groups.flatMap((group) => group.pages)
  }

  /** Mirrors `selectedPage`, which falls back to the first available page. */
  get selectedPage(): FdPage | undefined {
    const available = this.pages.filter((page) => !page.unavailable)
    return available.find((page) => page.pageId === this.page) ?? available[0]
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#observer = new MutationObserver(() => this.#collect())
    this.#observer.observe(this, { childList: true, subtree: true, attributes: true })
    this.#collect()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer?.disconnect()
    this.#observer = null
  }

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)

    const selected = this.selectedPage
    for (const page of this.pages) page.active = page === selected

    this.style.setProperty('--fd-accent-fill', selected?.accent ?? '')
    this.style.setProperty('--fd-accent-foreground', selected?.accentForeground ?? '')
    if (changed.has('page') && changed.get('page') !== undefined) this.#animatePageChange()
  }

  #collect(): void {
    const groups: ResolvedGroup[] = []
    for (const child of this.children) {
      if (child.localName === 'fd-page-group') {
        const group = child as FdPageGroup
        groups.push({
          label: group.label,
          indented: group.indented,
          pages: [...group.children].filter((page): page is FdPage => page.localName === 'fd-page'),
        })
      } else if (child.localName === 'fd-page') {
        // A bare page with no group, mirroring a single unlabelled SettingsPageGroup.
        const last = groups.at(-1)
        if (last && last.label === null && !last.indented) last.pages.push(child as FdPage)
        else groups.push({ label: null, indented: false, pages: [child as FdPage] })
      }
    }
    this.groups = groups
    this.requestUpdate()
  }

  /** Mirrors `.animation(.easeInOut(duration: 0.22), value: selection)`. */
  #animatePageChange(): void {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    this.contentInner?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 220,
      easing: 'ease-in-out',
    })
  }

  #select(page: FdPage): void {
    if (page.unavailable || page.pageId === this.page) return
    this.page = page.pageId
    this.dispatchEvent(
      new CustomEvent('fd-page-change', {
        detail: { page: page.pageId },
        bubbles: true,
        composed: true,
      }),
    )
  }

  #renderNavRow(page: FdPage, indented: boolean) {
    const selected = page === this.selectedPage
    return html`
      <button
        class="nav-row"
        type="button"
        aria-current=${selected ? 'page' : nothing}
        ?data-indented=${indented}
        ?disabled=${page.unavailable}
        style=${
          [
            page.accent ? `--fd-accent-fill: ${page.accent}` : '',
            page.accentForeground ? `--fd-accent-foreground: ${page.accentForeground}` : '',
          ]
            .filter(Boolean)
            .join(';') || nothing
        }
        @click=${() => this.#select(page)}
      >
        ${page.symbol ? html`<fd-icon class="nav-icon" name=${page.symbol}></fd-icon>` : nothing}
        <span class="nav-label">${page.label}</span>
      </button>
    `
  }

  override render() {
    const selected = this.selectedPage
    const strings = FdStringsRegistry.get()
    const headerSymbol = selected?.headerSymbol ?? selected?.symbol

    return html`
      <div class="sidebar" part="sidebar">
        ${
          this.hideClose
            ? nothing
            : html`
              <button
                class="close"
                type="button"
                aria-label=${strings.closeSettings}
                @click=${() =>
                  this.dispatchEvent(
                    new CustomEvent('fd-close', { bubbles: true, composed: true }),
                  )}
              >
                <span class="close-dot">${xmark}</span>
              </button>
            `
        }

        <div class="brand">
          <slot class="brand-icon" name="app-icon"></slot>
          <div class="brand-text">
            <span class="brand-name">${this.appName}</span>
            <span class="brand-subtitle">${this.settingsTitle}</span>
          </div>
        </div>

        <nav class="nav">
          ${this.groups.map(
            (group) => html`
              <div class="group">
                ${group.label ? html`<span class="group-label">${group.label}</span>` : nothing}
                ${group.pages.map((page) => this.#renderNavRow(page, group.indented))}
              </div>
            `,
          )}
        </nav>

        ${
          this.sidebarFooter
            ? html`<span class="sidebar-footer">${this.sidebarFooter}</span>`
            : nothing
        }
      </div>

      <div class="divider"></div>

      <div class="content" part="content">
        <div class="content-inner">
          ${
            selected
              ? html`
                <div class="page-header" part="page-header">
                  ${
                    headerSymbol
                      ? html`<span class="page-icon"
                        ><fd-icon name=${headerSymbol}></fd-icon
                      ></span>`
                      : nothing
                  }
                  <div class="page-text">
                    <span class="page-title">${selected.label}</span>
                    ${
                      selected.subtitle
                        ? html`<span class="page-subtitle">${selected.subtitle}</span>`
                        : nothing
                    }
                  </div>
                </div>
              `
              : nothing
          }
          <slot></slot>
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-settings-window': FdSettingsWindow
  }
}
