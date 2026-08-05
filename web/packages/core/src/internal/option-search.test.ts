import { describe, expect, it } from 'vitest'
import { optionMatches } from './option-search.js'

describe('optionMatches', () => {
  it('matches everything for an empty query', () => {
    expect(optionMatches('Ada Lovelace', '')).toBe(true)
  })

  /** trimmingCharacters(in: .whitespacesAndNewlines) */
  it('treats a whitespace-only query as empty', () => {
    expect(optionMatches('Ada Lovelace', '   ')).toBe(true)
    expect(optionMatches('Ada Lovelace', '\n\t ')).toBe(true)
  })

  it('trims before searching', () => {
    expect(optionMatches('Ada Lovelace', '  lace  ')).toBe(true)
  })

  it('is case insensitive in both directions', () => {
    expect(optionMatches('Ada Lovelace', 'ADA')).toBe(true)
    expect(optionMatches('ADA LOVELACE', 'ada')).toBe(true)
  })

  it('matches anywhere in the label, not just the start', () => {
    expect(optionMatches('Ada Lovelace', 'Love')).toBe(true)
  })

  it('rejects a query that is not present', () => {
    expect(optionMatches('Ada Lovelace', 'Babbage')).toBe(false)
  })

  it('folds case the way the current locale does', () => {
    expect(optionMatches('İstanbul', 'i̇st')).toBe(true)
    expect(optionMatches('STRASSE', 'strasse')).toBe(true)
  })
})
