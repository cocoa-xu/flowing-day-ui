import { type CSSResult, css } from 'lit'
import { textRole } from './typography.js'

export const dialogActionStyles: CSSResult = css`
  .dialog-action {
    ${textRole('button-label')}
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 29px;
    gap: 6px;
    padding-inline: 12px;
    border: 0;
    border-radius: var(--_fd-metric-control-radius);
    outline: 0;
    box-shadow: inset 0 0 0 1px var(--_fd-palette-hairline);
    background: var(--_fd-accent-veil);
    color: var(--_fd-accent-foreground);
    font: inherit;
    white-space: nowrap;
    cursor: pointer;
  }

  .dialog-action[data-prominent] {
    box-shadow: none;
    background: var(--_fd-accent-fill);
    color: white;
  }

  .dialog-action[data-destructive] {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, red 16%, transparent);
    background: color-mix(in srgb, red 8%, transparent);
    color: red;
  }

  .dialog-action[data-destructive][data-prominent] {
    box-shadow: none;
    background: red;
    color: white;
  }

  .dialog-action:focus-visible {
    box-shadow: inset 0 0 0 1.5px
      color-mix(in srgb, var(--_fd-accent-foreground) 54%, transparent);
  }

  .dialog-action[data-destructive]:focus-visible {
    box-shadow: inset 0 0 0 1.5px color-mix(in srgb, red 54%, transparent);
  }

  .dialog-action:active {
    opacity: 0.62;
  }

  .dialog-action:disabled {
    cursor: default;
    opacity: 0.42;
  }
`
