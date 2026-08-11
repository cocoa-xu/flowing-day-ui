import { type CSSResultGroup, css, html, nothing, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { tagStyles } from '../../internal/tag.js'

/**
 * Mirrors `PreferencesSelectableTag`: a tag pill with four hover × selected treatments,
 * each of foreground, background and border. Selection is owned by the caller, exactly
 * as the SwiftUI original takes `isSelected` and hands back an action.
 *
 * `inactive-accent` is `FlowingAccent?`: the unselected pill re-derives the accent set
 * from that colour, which is what `data-fd-accent-scope` exists for.
 *
 * @fires fd-activate - When the tag is pressed.
 * @csspart tag - The pill.
 */
@customElement('fd-selectable-tag')
export class FdSelectableTag extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    tagStyles,
    css`
      :host {
        display: inline-flex;
      }

      .tag {
        cursor: pointer;
        color: color-mix(in srgb, var(--_fd-accent-foreground) 62%, transparent);
        /* strokeBorder(lineWidth: 1) keeps the stroke inside the shape. */
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--_fd-accent-fill) 12%, transparent);
        transition-property: color, background-color, box-shadow;
        transition-timing-function: var(--_fd-motion-easing);
        transition-duration: var(--_tag-motion, var(--_fd-motion-selection));
      }

      .tag:hover {
        color: color-mix(in srgb, var(--_fd-accent-foreground) 80%, transparent);
        background: var(--_fd-accent-wash);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--_fd-accent-fill) 24%, transparent);
      }

      .tag[data-selected] {
        color: var(--_fd-accent-foreground);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--_fd-accent-fill) 24%, transparent);
      }

      .tag[data-selected]:hover {
        background: var(--_fd-accent-wash);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--_fd-accent-fill) 35%, transparent);
      }

      .tag:focus-visible {
        outline: 2px solid var(--_fd-accent-fill);
        outline-offset: 2px;
      }

      :host([disabled]) .tag {
        cursor: default;
        opacity: 0.4;
      }
    `,
  ]

  /** Falls back to the element's text content. */
  @property({ reflect: true }) label: string | null = null

  @property({ type: Boolean, reflect: true }) selected = false

  /** Reported on `fd-activate`, so one listener can serve a whole set. */
  @property({ reflect: true }) value = ''

  /** `PreferencesSelectableTag.inactiveAccent` — any CSS colour. */
  @property({ reflect: true, attribute: 'inactive-accent' }) inactiveAccent: string | null = null

  @property({ type: Boolean, reflect: true }) disabled = false

  /**
   * `.animation(_, value:)` picks a duration per *cause*, which a CSS transition cannot:
   * both signals move the same three properties. Writing the duration at the moment the
   * cause is known, before the style change is painted, reproduces it exactly.
   */
  #useMotion(cause: 'selection' | 'hover'): void {
    this.style.setProperty('--_tag-motion', `var(--_fd-motion-${cause})`)
  }

  override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('selected')) this.#useMotion('selection')
  }

  #onHover = (): void => {
    this.#useMotion('hover')
  }

  #onClick = (): void => {
    if (this.disabled) return
    this.dispatchEvent(
      new CustomEvent('fd-activate', {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    )
  }

  override render() {
    const retint = this.inactiveAccent !== null && !this.selected

    return html`
      <button
        class="tag"
        part="tag"
        type="button"
        aria-pressed=${this.selected}
        ?data-selected=${this.selected}
        ?data-fd-accent-scope=${retint}
        style=${retint ? `--fd-accent: ${this.inactiveAccent}` : nothing}
        ?disabled=${this.disabled}
        @pointerenter=${this.#onHover}
        @pointerleave=${this.#onHover}
        @click=${this.#onClick}
      >
        ${this.label ?? html`<slot></slot>`}
      </button>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-selectable-tag': FdSelectableTag
  }
}
