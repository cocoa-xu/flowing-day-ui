import { type CSSResult, css, html, type TemplateResult } from 'lit'

/**
 * `truncationMode(.middle)`, which no CSS keyword provides.
 *
 * The text is split into a head that shrinks and a tail that never does, so the ellipsis
 * lands between them and the end of a path or an identifier always stays readable.
 */
export const middleTruncateStyles: CSSResult = css`
  .truncate {
    display: flex;
    min-width: 0;
    white-space: nowrap;
  }

  .truncate-head {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .truncate-tail {
    flex: none;
    white-space: pre;
  }
`

/** Characters held back at the trailing end. */
export const DEFAULT_TAIL_LENGTH = 8

export function middleTruncated(value: string, tailLength = DEFAULT_TAIL_LENGTH): TemplateResult {
  const split = Math.max(value.length - tailLength, 0)
  return html`<span class="truncate-head">${value.slice(0, split)}</span
    ><span class="truncate-tail">${value.slice(split)}</span>`
}
