import { type CSSResultGroup, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { FdElement } from '../../internal/base-element.js'

/**
 * Mirrors `SettingsPopupOption`. Declared as a child so a plain HTML page can define a
 * menu without writing any JavaScript:
 *
 * ```html
 * <fd-popup><fd-option value="auto">Automatic</fd-option></fd-popup>
 * ```
 *
 * The label is the element's text content; `value` is what the popup reports.
 */
@customElement('fd-option')
export class FdOption extends FdElement {
  static override styles: CSSResultGroup = css`
    :host {
      display: none;
    }
  `

  @property({ reflect: true }) value = ''

  /** Falls back to the element's text content. */
  @property({ reflect: true }) label: string | null = null

  get optionLabel(): string {
    return this.label ?? this.textContent?.trim() ?? ''
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-option': FdOption
  }
}
