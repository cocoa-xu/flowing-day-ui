import { type CSSResult, unsafeCSS } from 'lit'

/** The 17 roles of `PreferencesTypography`, kebab-cased. */
export type TextRole =
  | 'brand-title'
  | 'brand-subtitle'
  | 'sidebar-group'
  | 'sidebar-item'
  | 'sidebar-item-selected'
  | 'page-title'
  | 'page-subtitle'
  | 'content-title'
  | 'body'
  | 'section-header'
  | 'row-title'
  | 'row-caption'
  | 'value'
  | 'slider-value'
  | 'selection-label'
  | 'button-label'
  | 'tag'

/** Expands one typography role into its four token reads. */
export function textRole(role: TextRole): CSSResult {
  return unsafeCSS(
    `font-family: var(--_fd-text-${role}-family);` +
      `font-size: var(--_fd-text-${role}-size);` +
      `font-weight: var(--_fd-text-${role}-weight);` +
      `font-variant-numeric: var(--_fd-text-${role}-numeric);`,
  )
}
