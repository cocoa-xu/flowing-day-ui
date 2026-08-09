import { describe, expect, it } from 'vitest'
import { FdGraphSearchIndex, FdGraphSearchIndexError, type FdGraphSearchItem } from './search.js'

const item = (
  id: string | number,
  title: string,
  options: Omit<FdGraphSearchItem, 'id' | 'title'> = {},
): FdGraphSearchItem => ({ id, title, ...options })

const rejectedIssue = (operation: () => unknown): string | undefined => {
  try {
    operation()
    return undefined
  } catch (error) {
    if (error instanceof FdGraphSearchIndexError) return error.issue
    throw error
  }
}

describe('graph search index', () => {
  it('ranks exact titles before prefixes and metadata matches', () => {
    const index = new FdGraphSearchIndex([
      item('keyword', 'Adapter', { keywords: ['USB'] }),
      item('prefix', 'USB Hub'),
      item('exact', 'USB'),
      item('subtitle', 'Dock', { subtitle: 'USB accessory' }),
      item('category', 'Controller', { category: 'USB' }),
    ])

    expect(index.search('usb').map(({ item }) => item.id)).toEqual([
      'exact',
      'prefix',
      'keyword',
      'subtitle',
      'category',
    ])
  })

  it('normalizes case and diacritics and supports multiple terms', () => {
    const index = new FdGraphSearchIndex([
      item('dock', 'Café Thunderbolt Dock'),
      item('display', 'Thunderbolt Display'),
    ])

    expect(index.search('CAFE dock').map(({ item }) => item.id)).toEqual(['dock'])
  })

  it('supports short and interior substrings', () => {
    const index = new FdGraphSearchIndex([
      item('usb', 'USB Controller'),
      item('thunderbolt', 'Thunderbolt Bridge'),
    ])

    expect(index.search('us').map(({ item }) => item.id)).toEqual(['usb'])
    expect(index.search('derb').map(({ item }) => item.id)).toEqual(['thunderbolt'])
  })

  it('uses presentation order for otherwise equivalent items and bounds results', () => {
    const index = new FdGraphSearchIndex([item('second-id', 'Port'), item('first-id', 'Port')])

    expect(index.search('port').map(({ item }) => item.id)).toEqual(['second-id', 'first-id'])
    expect(index.search('port', 1).map(({ item }) => item.id)).toEqual(['second-id'])
    expect(index.search('port', 0)).toEqual([])
  })

  it('keeps numeric and string identifiers distinct and rejects exact duplicates', () => {
    expect(() => new FdGraphSearchIndex([item(1, 'Number'), item('1', 'String')])).not.toThrow()
    expect(
      rejectedIssue(() => new FdGraphSearchIndex([item('same', 'First'), item('same', 'Second')])),
    ).toBe('duplicateElementID')
  })

  it.each([
    [{ maximumItems: 1 }, [item('one', 'One'), item('two', 'Two')], 'itemBudgetExceeded'],
    [{ maximumTextLength: 3 }, [item('text', 'Length')], 'textBudgetExceeded'],
    [
      { maximumKeywordsPerItem: 1 },
      [item('keywords', 'Node', { keywords: ['one', 'two'] })],
      'keywordBudgetExceeded',
    ],
    [
      { maximumIndexedCharacters: 4 },
      [item('characters', 'Node', { subtitle: 'Subtitle' })],
      'characterBudgetExceeded',
    ],
  ] as const)('enforces independent input budgets', (limits, items, issue) => {
    expect(rejectedIssue(() => new FdGraphSearchIndex(items, limits))).toBe(issue)
  })

  it('finds bounded results in one hundred thousand indexed items', () => {
    const items = Array.from({ length: 100_000 }, (_, index) =>
      item(index, `Element ${index}`, { keywords: index === 87_654 ? ['needle'] : [] }),
    )
    const index = new FdGraphSearchIndex(items)

    expect(index.search('needle').map(({ item }) => item.id)).toEqual([87_654])
    expect(index.search('87654').map(({ item }) => item.id)).toEqual([87_654])
    expect(index.search('element', 20)).toHaveLength(20)
  })
})
