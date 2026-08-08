import { type CSSResult, css, svg } from 'lit'
import { textRole } from './typography.js'

/**
 * The chrome shared by `PreferencesSelectionButton` and `PreferencesSymbolSelectionButton`:
 * an equal-width pill that is accent-washed and accent-bordered while selected, and
 * sits on the control surface behind a hairline while it is not.
 */
export const selectionStyles: CSSResult = css`
  .strip {
    display: flex;
    gap: 6px;
    width: var(--_control-width);
  }

  .segment {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex: 1 1 0;
    min-width: 0;
    padding-block: 7px;
    padding-inline: 9px;
    border: 0;
    border-radius: var(--_fd-metric-control-radius);
    /* Inset so the stroke stays inside the shape, as strokeBorder does. */
    box-shadow: inset 0 0 0 1px var(--_fd-palette-hairline);
    background: var(--_fd-surface-control);
    color: var(--_fd-palette-muted);
    font: inherit;
    cursor: pointer;
    transition:
      background-color var(--_fd-motion-default) ease-in-out,
      color var(--_fd-motion-default) ease-in-out,
      box-shadow var(--_fd-motion-default) ease-in-out;
  }

  .segment[data-compact] {
    padding-inline: 6px;
  }

  .segment[data-symbol] {
    padding-block: 8px;
    padding-inline: 6px;
  }

  .segment[data-selected] {
    background: var(--_fd-accent-wash);
    color: var(--_fd-accent-foreground);
    box-shadow: inset 0 0 0 1px
      color-mix(in srgb, var(--_fd-accent-foreground) 22%, transparent);
  }

  .segment:focus-visible {
    outline: 2px solid var(--_fd-accent-fill);
    outline-offset: 2px;
  }

  .segment[disabled] {
    opacity: 0.4;
    cursor: default;
  }

  .strip[data-connected] {
    gap: 0;
    box-sizing: border-box;
    padding: 2px;
    border-radius: var(--_fd-metric-control-radius);
    background: var(--_fd-surface-control);
    box-shadow: inset 0 0 0 1px var(--_fd-palette-hairline);
  }

  .strip[data-connected] .segment {
    padding-block: 6px;
    padding-inline: 9px;
    border-radius: max(0px, calc(var(--_fd-metric-control-radius) - 2px));
    background: transparent;
    box-shadow: none;
  }

  .strip[data-connected] .segment:not(:last-child)::after {
    position: absolute;
    top: 50%;
    inset-inline-end: 0;
    width: 1px;
    height: 14px;
    background: var(--_fd-palette-hairline);
    content: '';
    opacity: 1;
    transform: translateY(-50%);
    transition: opacity var(--_fd-motion-default) ease-in-out;
  }

  .strip[data-connected] .segment[data-hide-divider]::after {
    opacity: 0;
  }

  .strip[data-connected] .segment:not([data-selected]):not([disabled]):hover {
    background: var(--_fd-accent-veil);
  }

  .strip[data-connected] .segment:not([data-selected]):not([disabled]):active {
    background: var(--_fd-accent-wash);
  }

  .strip[data-connected] .segment[data-selected] {
    background: var(--_fd-accent-wash);
    box-shadow: inset 0 0 0 1px
      color-mix(in srgb, var(--_fd-accent-foreground) 22%, transparent);
  }

  .strip[data-connected] .segment:focus-visible {
    outline-offset: -2px;
  }

  .segment-label {
    ${textRole('selection-label')}
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .segment-mark {
    flex: none;
    width: 11px;
    height: 11px;
  }

  .segment-icon {
    flex: none;
    font-size: 12px;
  }
`

/**
 * Stands in for `checkmark.circle.fill`. The glyph is knocked out of the disc by
 * stroking it in the surface behind the pill rather than by a compound path.
 */
export const checkCircleFill = svg`
  <svg class="segment-mark" viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="7.25" fill="currentColor" />
    <path
      d="M4.7 8.2 6.9 10.4 11.3 5.9"
      fill="none"
      stroke="var(--_fd-surface-control)"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>`

/** Stands in for `circle`. */
export const circleOutline = svg`
  <svg class="segment-mark" viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.6" />
  </svg>`
