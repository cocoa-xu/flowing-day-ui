import { type CSSResult, css } from 'lit'
import { textRole } from './typography.js'

/**
 * Mirrors `PreferencesSoftButtonStyle`, the appearance shared by `PreferencesButtonRow`,
 * `PreferencesLinkRow` and anything else wanting a trailing button: 12/5 padding on
 * `controlRadius`, accent veil behind a hairline, dimmed to 0.6 while pressed.
 *
 * `data-prominent` is the `isProminent` branch — solid accent fill, white label, and a
 * cleared border rather than a drawn one.
 */
export const softButtonStyles: CSSResult = css`
  .soft-button {
    ${textRole('button-label')}
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding-inline: 12px;
    padding-block: 5px;
    border: 0;
    border-radius: var(--_fd-metric-control-radius);
    /* Inset so the stroke stays inside the shape, as strokeBorder does. */
    box-shadow: inset 0 0 0 1px var(--_fd-palette-hairline);
    background: var(--_fd-accent-veil);
    color: var(--_fd-accent-foreground);
    text-decoration: none;
    cursor: pointer;
  }

  .soft-button[data-prominent] {
    box-shadow: none;
    background: var(--_fd-accent-fill);
    color: #fff;
  }

  .soft-button:active {
    opacity: 0.6;
  }

  .soft-button:focus-visible {
    outline: 2px solid var(--_fd-accent-fill);
    outline-offset: 2px;
  }

  .soft-button[disabled] {
    opacity: 0.4;
    cursor: default;
  }
`
