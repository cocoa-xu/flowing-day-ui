/**
 * The text this library renders, for localization.
 *
 * `PreferencesStrings` also carries the words for selected, expanded and on/off, which it
 * hands to `accessibilityValue`. They have no counterpart here: `aria-pressed`,
 * `aria-expanded` and `aria-selected` carry those states natively, and a screen reader
 * speaks them in its own language rather than the page's. Putting them in the label as
 * well only makes the state announce twice, in one language.
 */
export interface FdStrings {
  closePreferences: string
  search: string
  noResults: string
}

const defaults: FdStrings = {
  closePreferences: 'Close Preferences',
  search: 'Search',
  noResults: 'No Results',
}

let current: FdStrings = { ...defaults }

export const FdStringsRegistry = {
  get(): FdStrings {
    return current
  },

  set(overrides: Partial<FdStrings>): void {
    current = { ...current, ...overrides }
  },

  reset(): void {
    current = { ...defaults }
  },
} as const
