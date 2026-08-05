import { svg } from 'lit'

/**
 * Structural chrome — the glyphs a control cannot work without.
 *
 * The icon registry ships no icon data on purpose, so anything a control *needs* to be
 * usable is drawn here instead. Decorative leading symbols still go through `fd-icon`.
 * Each takes its size from the element it sits in and its colour from `currentColor`.
 */

/** `chevron.down`, or `chevron.up` when the popup opens upward. */
export const chevron = (up: boolean) => svg`
  <svg viewBox="0 0 12 12" aria-hidden="true">
    <path
      d=${up ? 'M2.5 7.5 6 4l3.5 3.5' : 'M2.5 4.5 6 8l3.5-3.5'}
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>`

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
