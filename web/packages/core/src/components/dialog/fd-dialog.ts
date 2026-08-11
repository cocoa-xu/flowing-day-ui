import { type CSSResultGroup, css, html, nothing, type PropertyValues } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import { baseStyles, FdElement } from '../../internal/base-element.js'
import { dialogActionStyles } from '../../internal/dialog-action.js'
import { trash, warningTriangle } from '../../internal/glyphs.js'
import { textRole } from '../../internal/typography.js'
import '../icon/fd-icon.js'

export type FdConfirmationKind = 'confirmation' | 'warning' | 'destructive'
export type FdDialogTone =
  | 'neutral'
  | 'accent'
  | 'informational'
  | 'success'
  | 'warning'
  | 'critical'

const DIALOG_MINIMUM_WIDTH = 380
const DIALOG_IDEAL_WIDTH = 440
const DIALOG_MAXIMUM_WIDTH = 560

/**
 * A native dialog lifecycle with FlowingDayUI's visual hierarchy.
 *
 * Set `confirm-label` for a confirmation dialog, or provide `actions` slot content for
 * a custom sheet. `showModal`, `show`, and `close` delegate to the native dialog.
 *
 * @slot - Dialog content.
 * @slot actions - Custom `fd-dialog-action` controls.
 * @fires fd-confirm - Before a built-in confirmation closes; cancelable.
 * @fires fd-cancel - Before cancellation closes the dialog; cancelable.
 * @fires fd-close - After the native dialog closes.
 * @csspart dialog - The native dialog.
 * @csspart body - The scrolling content area.
 * @csspart actions - The action footer.
 */
@customElement('fd-dialog')
export class FdDialog extends FdElement {
  static override styles: CSSResultGroup = [
    baseStyles,
    dialogActionStyles,
    css`
      :host {
        display: contents;
      }

      dialog {
        width: min(
          calc(100vw - 32px),
          clamp(${DIALOG_MINIMUM_WIDTH}px, ${DIALOG_IDEAL_WIDTH}px, ${DIALOG_MAXIMUM_WIDTH}px)
        );
        max-width: calc(100vw - 32px);
        max-height: calc(100dvh - 32px);
        padding: 0;
        border: 1px solid var(--_fd-palette-edge);
        border-radius: var(--_fd-metric-card-radius);
        outline: 0;
        background: var(--_fd-surface-canvas);
        box-shadow: var(--_fd-window-shadow);
        color: var(--_fd-palette-ink);
        overflow: hidden;
      }

      dialog[open] {
        display: flex;
        flex-direction: column;
      }

      dialog::backdrop {
        background: rgb(0 0 0 / 0.2);
        backdrop-filter: blur(1.5px);
      }

      .header {
        display: flex;
        align-items: flex-start;
        flex: none;
        gap: 12px;
        padding: 18px 20px;
      }

      .symbol {
        display: grid;
        width: 32px;
        height: 32px;
        flex: none;
        border-radius: 10px;
        background: color-mix(in srgb, var(--_tone) 9%, transparent);
        color: var(--_tone);
        place-items: center;
      }

      .symbol svg,
      .symbol fd-icon {
        width: 14px;
        height: 14px;
        font-size: 14px;
      }

      .titles {
        min-width: 0;
        flex: 1 1 auto;
      }

      .heading {
        ${textRole('content-title')}
        margin: 0;
        color: var(--_fd-palette-ink);
      }

      .message {
        ${textRole('body')}
        margin: 3px 0 0;
        color: var(--_fd-palette-muted);
      }

      .separator {
        height: 1px;
        flex: none;
        background: var(--_fd-palette-hairline);
      }

      .body {
        min-height: 0;
        padding: 20px;
        overflow: auto;
        overscroll-behavior: contain;
      }

      .actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        min-height: 58px;
        flex: none;
        gap: 8px;
        padding: 14px 20px;
      }

      dialog[data-tone='neutral'] {
        --_tone: var(--_fd-palette-muted);
      }

      dialog[data-tone='accent'] {
        --_tone: var(--_fd-accent-foreground);
      }

      dialog[data-tone='informational'] {
        --_tone: LinkText;
      }

      dialog[data-tone='success'] {
        --_tone: green;
      }

      dialog[data-tone='warning'] {
        --_tone: orange;
      }

      dialog[data-tone='critical'] {
        --_tone: red;
      }
    `,
  ]

  @property({ reflect: true }) heading = ''

  @property({ reflect: true }) message: string | null = null

  @property({ reflect: true }) symbol: string | null = null

  @property({ reflect: true }) tone: FdDialogTone = 'accent'

  @property({ attribute: 'confirmation-kind', reflect: true })
  confirmationKind: FdConfirmationKind = 'confirmation'

  @property({ attribute: 'confirm-label', reflect: true }) confirmLabel = ''

  @property({ attribute: 'cancel-label', reflect: true }) cancelLabel = 'Cancel'

  @property({ type: Boolean, reflect: true }) open = false

  @property({ type: Boolean, reflect: true }) modal = true

  @property({ type: Boolean, reflect: true }) dismissible = true

  @query('dialog') private dialog!: HTMLDialogElement

  override firstUpdated(changed: PropertyValues<this>): void {
    super.firstUpdated(changed)
    this.#synchronizePresentation()
  }

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (changed.has('open') || changed.has('modal')) this.#synchronizePresentation()
  }

  showModal(): void {
    this.modal = true
    this.open = true
  }

  show(): void {
    this.modal = false
    this.open = true
  }

  close(returnValue = ''): void {
    if (this.dialog?.open) {
      this.dialog.close(returnValue)
    } else {
      this.open = false
    }
  }

  #synchronizePresentation(): void {
    if (!this.dialog) return
    if (!this.open) {
      if (this.dialog.open) this.dialog.close()
      return
    }
    if (this.dialog.open) return
    this.modal ? this.dialog.showModal() : this.dialog.show()
  }

  #onNativeCancel = (event: Event): void => {
    const cancellation = new CustomEvent('fd-cancel', {
      bubbles: true,
      composed: true,
      cancelable: true,
    })
    if (!this.dismissible || !this.dispatchEvent(cancellation)) event.preventDefault()
  }

  #onNativeClose = (): void => {
    this.open = false
    this.dispatchEvent(
      new CustomEvent('fd-close', {
        detail: { returnValue: this.dialog.returnValue },
        bubbles: true,
        composed: true,
      }),
    )
  }

  #cancel = (): void => {
    const event = new CustomEvent('fd-cancel', {
      bubbles: true,
      composed: true,
      cancelable: true,
    })
    if (this.dispatchEvent(event)) this.close('cancel')
  }

  #confirm = (): void => {
    const event = new CustomEvent('fd-confirm', {
      bubbles: true,
      composed: true,
      cancelable: true,
    })
    if (this.dispatchEvent(event)) this.close('confirm')
  }

  get #resolvedTone(): FdDialogTone {
    if (!this.confirmLabel) return this.tone
    if (this.confirmationKind === 'warning') return 'warning'
    if (this.confirmationKind === 'destructive') return 'critical'
    return this.tone
  }

  get #symbolContent() {
    if (this.symbol) return html`<fd-icon name=${this.symbol}></fd-icon>`
    if (this.confirmLabel && this.confirmationKind === 'warning') return warningTriangle
    if (this.confirmLabel && this.confirmationKind === 'destructive') return trash
    return nothing
  }

  get #showsSymbol(): boolean {
    return Boolean(
      this.symbol ||
        (this.confirmLabel &&
          (this.confirmationKind === 'warning' || this.confirmationKind === 'destructive')),
    )
  }

  override render() {
    const symbol = this.#symbolContent

    return html`
      <dialog
        part="dialog"
        aria-labelledby="heading"
        aria-describedby=${this.message ? 'message' : nothing}
        data-tone=${this.#resolvedTone}
        @cancel=${this.#onNativeCancel}
        @close=${this.#onNativeClose}
      >
        <header class="header">
          ${this.#showsSymbol ? html`<span class="symbol" aria-hidden="true">${symbol}</span>` : nothing}
          <div class="titles">
            <h2 class="heading" id="heading">${this.heading}</h2>
            ${this.message ? html`<p class="message" id="message">${this.message}</p>` : nothing}
          </div>
        </header>
        <div class="separator"></div>
        <div class="body" part="body"><slot></slot></div>
        <div class="separator"></div>
        <footer class="actions" part="actions">
          ${
            this.confirmLabel
              ? html`
                  <button class="dialog-action" type="button" @click=${this.#cancel}>
                    ${this.cancelLabel}
                  </button>
                  <button
                    class="dialog-action"
                    type="button"
                    ?data-prominent=${this.confirmationKind !== 'destructive'}
                    ?data-destructive=${this.confirmationKind === 'destructive'}
                    @click=${this.#confirm}
                  >
                    ${this.confirmLabel}
                  </button>
                `
              : html`<slot name="actions"></slot>`
          }
        </footer>
      </dialog>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fd-dialog': FdDialog
  }
}
