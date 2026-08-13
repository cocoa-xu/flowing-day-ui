import { css, html, nothing, svg } from 'lit'
import { textRole } from './typography.js'

export type FdFieldValidation =
  | { readonly kind: 'none' }
  | { readonly kind: 'success'; readonly message?: string }
  | { readonly kind: 'warning' | 'error'; readonly message: string }

export const noFieldValidation: FdFieldValidation = Object.freeze({ kind: 'none' })

export const fieldValidationStyles = css`
  .field[data-validation='success'],
  .supporting[data-validation='success'] {
    --_validation-color: light-dark(#248a3d, #30d158);
  }

  .field[data-validation='warning'],
  .supporting[data-validation='warning'] {
    --_validation-color: light-dark(#c93400, #ff9f0a);
  }

  .field[data-validation='error'],
  .supporting[data-validation='error'] {
    --_validation-color: light-dark(#d70015, #ff453a);
  }

  .field[data-validation]:not([data-validation='none']) {
    border-color: color-mix(in srgb, var(--_validation-color) 58%, transparent);
  }

  .supporting {
    ${textRole('row-caption')}
    display: flex;
    align-items: baseline;
    gap: 5px;
    padding-inline: 2px;
    color: var(--_fd-palette-faint);
  }

  .supporting:not([data-validation='none']) {
    color: var(--_validation-color);
  }

  .validation-icon {
    width: 9px;
    height: 9px;
    flex: none;
  }

  .validation-icon svg {
    display: block;
    width: 100%;
    height: 100%;
  }
`

export function renderFieldSupportingText(
  validation: FdFieldValidation,
  supportingText: string | null,
) {
  const message =
    validation.kind === 'none' ? supportingText : (validation.message ?? supportingText)
  if (!message) return nothing
  const displayedKind = validation.kind !== 'none' && validation.message ? validation.kind : 'none'
  return html`
    <div class="supporting" part="supporting-text" data-validation=${displayedKind}>
      ${
        displayedKind === 'none'
          ? nothing
          : html`<span class="validation-icon">${validationGlyph(displayedKind)}</span>`
      }
      <span>${message}</span>
    </div>
  `
}

function validationGlyph(kind: Exclude<FdFieldValidation['kind'], 'none'>) {
  if (kind === 'success') {
    return svg`<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5.4" fill="currentColor"/><path d="m3.2 6.1 1.7 1.7 3.8-3.9" fill="none" stroke="var(--_fd-surface-canvas)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  }
  if (kind === 'warning') {
    return svg`<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 .8 11.5 11H.5L6 .8Z" fill="currentColor"/><path d="M6 4v3" stroke="var(--_fd-surface-canvas)" stroke-width="1.2" stroke-linecap="round"/><circle cx="6" cy="8.7" r=".6" fill="var(--_fd-surface-canvas)"/></svg>`
  }
  return svg`<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5.4" fill="currentColor"/><path d="m3.8 3.8 4.4 4.4m0-4.4L3.8 8.2" stroke="var(--_fd-surface-canvas)" stroke-width="1.3" stroke-linecap="round"/></svg>`
}
