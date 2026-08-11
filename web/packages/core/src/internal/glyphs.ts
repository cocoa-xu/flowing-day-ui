import { svg } from 'lit'

/**
 * Structural chrome — the glyphs a control cannot work without.
 *
 * The icon registry ships no icon data on purpose, so anything a control *needs* to be
 * usable is drawn here instead. Decorative leading symbols still go through `fd-icon`.
 * Each takes its size from the element it sits in and its colour from `currentColor`.
 */

const chevron = (path: string) => svg`
  <svg viewBox="0 0 12 12" aria-hidden="true">
    <path
      d=${path}
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>`

/** `chevron.down`. Rows that disclose rotate this rather than swapping it. */
export const chevronDown = chevron('M2.5 4.5 6 8l3.5-3.5')

/** `chevron.up`. */
export const chevronUp = chevron('M2.5 7.5 6 4l3.5 3.5')

/** `checkmark`. */
export const checkmark = svg`
  <svg viewBox="0 0 12 12" aria-hidden="true">
    <path
      d="M2.6 6.3 4.9 8.6 9.4 3.8"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>`

/** `magnifyingglass`. */
export const magnifyingGlass = svg`
  <svg viewBox="0 0 12 12" aria-hidden="true">
    <circle cx="5.2" cy="5.2" r="3.4" fill="none" stroke="currentColor" stroke-width="1.5" />
    <path
      d="M7.8 7.8 10.4 10.4"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
  </svg>`

export const warningTriangle = svg`
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M8 2.1 14.1 13H1.9L8 2.1Z"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
    />
    <path d="M8 5.6v3.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    <circle cx="8" cy="11.3" r="0.8" fill="currentColor" />
  </svg>`

export const trash = svg`
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M4.3 5.2h7.4l-.5 8H4.8l-.5-8Zm1.8-2.4h3.8l.6 1.4h-5l.6-1.4Z"
      fill="none"
      stroke="currentColor"
      stroke-width="1.35"
      stroke-linejoin="round"
    />
    <path d="M3 4.2h10M6.7 7v4.2M9.3 7v4.2" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" />
  </svg>`
