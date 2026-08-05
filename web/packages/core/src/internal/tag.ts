import { type CSSResult, css } from 'lit'
import { textRole } from './typography.js'

/**
 * The pill geometry `PreferencesTag` and `PreferencesSelectableTag` share: the monospaced tag
 * role, 10/6 padding on a radius of 8, sized to its text and never wrapped.
 */
export const tagStyles: CSSResult = css`
  .tag {
    ${textRole('tag')}
    display: inline-flex;
    align-items: center;
    flex: none;
    padding-inline: 10px;
    padding-block: 6px;
    border: 0;
    border-radius: 8px;
    background: var(--_fd-accent-veil);
    color: var(--_fd-accent-foreground);
    white-space: nowrap;
  }
`
