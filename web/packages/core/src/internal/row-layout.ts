import { type CSSResult, css } from 'lit'
import { textRole } from './typography.js'

/**
 * The `HStack` that `SettingsRow`, `SettingsExpandableRow` and the header of
 * `SettingsSearchPickerRow` each spell out identically: a 20pt symbol gutter, the
 * title/caption block, and a spacer holding at least 10pt before whatever trails it.
 *
 * Vertical padding is 10px, or 11px once a caption is present. That is keyed off the
 * rendered caption rather than `:host([caption])`, because a wrapping row passing its
 * own null caption down sets the attribute to the empty string.
 */
export const rowLayoutStyles: CSSResult = css`
  .row {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 42px;
    padding-inline: var(--_fd-metric-row-inset);
    padding-block: 10px;
  }

  .row[data-caption] {
    padding-block: 11px;
  }

  .symbol {
    width: 20px;
    flex: none;
    display: flex;
    justify-content: center;
    font-size: 13px;
    font-weight: 500;
    color: var(--_fd-palette-muted);
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .label {
    ${textRole('row-title')}
    color: var(--_fd-palette-ink);
  }

  .caption {
    ${textRole('row-caption')}
    color: var(--_fd-palette-faint);
  }

  /* Spacer(minLength: 10); the stack's 14px spacing sits on either side of it. */
  .spacer {
    flex: 1 1 auto;
    min-width: 10px;
  }
`
