import { type CSSResultGroup, css, html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { textRole } from '../../internal/typography.js'
import '../card/fd-card.js'
import type { FdRowSeparatorLeadingEdge } from '../separator/fd-separator.js'
import '../section-header/fd-section-header.js'

type RowIconPresence = 'empty' | 'icons' | 'text' | 'mixed'

const isRow = (element: Element): element is HTMLElement =>
  element instanceof HTMLElement &&
  (element.localName === 'fd-row' ||
    element.localName.endsWith('-row') ||
    element.localName === 'fd-switch-group')

const isHiddenDependentRow = (element: HTMLElement): boolean => {
  if (element.hidden) return true
  const parent = element.parentElement
  if (!parent) return false
  return parent.closest('fd-dependent-rows:not([visible]), fd-switch-group:not([checked])') !== null
}

/**
 * Mirrors `PreferencesSection`: uppercase header, card, and an optional footer whose
 * horizontal inset matches the row text above it.
 *
 * @slot - Rows placed inside the card.
 * @csspart header - The uppercase section title.
 * @csspart card - The `fd-card` wrapping the rows.
 * @csspart footer - The caption below the card.
 */
@customElement('fd-section')
export class FdSection extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        align-self: stretch;
        width: 100%;
      }

      .footer {
        ${textRole('row-caption')}
        color: var(--_fd-palette-faint);
        padding-inline: var(--_fd-metric-row-inset);
        padding-top: 7px;
      }
    `,
  ]

  /** Section title. Rendered uppercase; omit to render the card alone. */
  @property({ reflect: true }) label: string | null = null

  /** Caption below the card. */
  @property({ reflect: true }) footer: string | null = null

  /** Alignment used only when the section mixes rows with and without symbols. */
  @property({ attribute: 'mixed-row-separator-leading-edge', reflect: true })
  mixedRowSeparatorLeadingEdge: FdRowSeparatorLeadingEdge = 'content'

  @state() private rowIconPresence: RowIconPresence = 'empty'

  #observer: MutationObserver | null = null

  override connectedCallback(): void {
    super.connectedCallback()
    this.#observer = new MutationObserver(() => this.#collectRowIconPresence())
    this.#observer.observe(this, {
      attributeFilter: ['checked', 'hidden', 'symbol', 'visible'],
      attributes: true,
      childList: true,
      subtree: true,
    })
    this.#collectRowIconPresence()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer?.disconnect()
    this.#observer = null
  }

  private get separatorLeadingInset(): string {
    if (this.rowIconPresence === 'icons') return '34px'
    if (this.rowIconPresence === 'text') return '0px'
    return this.mixedRowSeparatorLeadingEdge === 'iconText' ? '34px' : '0px'
  }

  #collectRowIconPresence(): void {
    const presence = [...this.querySelectorAll('*')]
      .filter(isRow)
      .filter((row) => !isHiddenDependentRow(row))
      .map(
        (row) => row.hasAttribute('symbol') && (row.getAttribute('symbol')?.trim().length ?? 0) > 0,
      )

    if (presence.length === 0) this.rowIconPresence = 'empty'
    else if (presence.every(Boolean)) this.rowIconPresence = 'icons'
    else if (presence.every((hasIcon) => !hasIcon)) this.rowIconPresence = 'text'
    else this.rowIconPresence = 'mixed'
  }

  override render() {
    return html`
      ${
        this.label
          ? html`<fd-section-header
              class="header"
              part="header"
              .label=${this.label}
            ></fd-section-header>`
          : nothing
      }
      <fd-card
        part="card"
        style="--_fd-section-separator-leading-inset: ${this.separatorLeadingInset}"
      ><slot></slot></fd-card>
      ${this.footer ? html`<div class="footer" part="footer">${this.footer}</div>` : nothing}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-section': FdSection
  }
}
