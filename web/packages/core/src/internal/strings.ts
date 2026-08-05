/** Mirrors `SettingsStrings`. Override globally for localization. */
export interface FdStrings {
  closeSettings: string
  selected: string
  notSelected: string
  expanded: string
  collapsed: string
  on: string
  off: string
  search: string
  noResults: string
}

const defaults: FdStrings = {
  closeSettings: 'Close Settings',
  selected: 'Selected',
  notSelected: 'Not Selected',
  expanded: 'Expanded',
  collapsed: 'Collapsed',
  on: 'On',
  off: 'Off',
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
