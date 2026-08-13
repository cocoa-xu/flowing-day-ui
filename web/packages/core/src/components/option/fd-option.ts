import { type CSSResultGroup, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { FdElement } from '../../internal/base-element.js'

/**
 * The option element shared by every list-like control, covering
 * `PreferencesPopupOption`, `PreferencesSymbolSegmentOption` and `PreferencesMultiSelectOption`.
 *
 * Declared as a child so a plain HTML page can define a control without JavaScript:
 *
 * ```html
 * <fd-select><fd-option value="auto">Automatic</fd-option></fd-select>
 * ```
 *
 * The label is the element's text content unless `label` overrides it.
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

  /** Icon registry key, used by `fd-symbol-segmented-row`. */
  @property({ reflect: true }) symbol: string | null = null

  /** Optional base accent used to distinguish this option in popup menus. */
  @property({ reflect: true }) accent: string | null = null

  /** Mirrors `PreferencesMultiSelectOption.isOn`; only meaningful in a multi-select. */
  @property({ type: Boolean, reflect: true }) selected = false

  /** Mirrors `PreferencesMultiSelectOption(isEnabled: false)`. */
  @property({ type: Boolean, reflect: true }) disabled = false

  get optionLabel(): string {
    return this.label ?? this.textContent?.trim() ?? ''
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-option': FdOption
  }
}
