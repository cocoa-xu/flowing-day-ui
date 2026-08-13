import { type FdGraphElementID, graphElementKey } from './model.js'

export interface FdGraphCanvasSearchItem {
  readonly id: FdGraphElementID
  readonly title: string
  readonly subtitle?: string
  readonly keywords?: readonly string[]
  readonly category?: string
}

export interface FdGraphCanvasSearchIndexLimits {
  readonly maximumItems?: number
  readonly maximumTextLength?: number
  readonly maximumKeywordsPerItem?: number
  readonly maximumIndexedCharacters?: number
}

export type FdGraphCanvasSearchIndexIssue =
  | 'itemBudgetExceeded'
  | 'duplicateElementID'
  | 'textBudgetExceeded'
  | 'keywordBudgetExceeded'
  | 'characterBudgetExceeded'

export class FdGraphCanvasSearchIndexError extends Error {
  constructor(readonly issue: FdGraphCanvasSearchIndexIssue) {
    super(`Graph search index rejected its input: ${issue}`)
    this.name = 'FdGraphCanvasSearchIndexError'
  }
}

export interface FdGraphCanvasSearchResult {
  readonly id: FdGraphElementID
  readonly item: FdGraphCanvasSearchItem
  readonly score: number
}

interface FdResolvedGraphSearchIndexLimits {
  readonly maximumItems: number
  readonly maximumTextLength: number
  readonly maximumKeywordsPerItem: number
  readonly maximumIndexedCharacters: number
}

interface FdIndexedGraphSearchItem {
  readonly item: FdGraphCanvasSearchItem
  readonly title: string
  readonly titleTokens: readonly string[]
  readonly subtitle: string
  readonly keywords: string
  readonly category: string
  readonly tokens: ReadonlySet<string>
  readonly order: number
}

interface FdRankedGraphSearchItem {
  readonly result: FdGraphCanvasSearchResult
  readonly normalizedTitle: string
  readonly order: number
}

const defaultLimits: FdResolvedGraphSearchIndexLimits = {
  maximumItems: 1_000_000,
  maximumTextLength: 4_096,
  maximumKeywordsPerItem: 64,
  maximumIndexedCharacters: 64_000_000,
}

const normalize = (value: string): string =>
  value.normalize('NFKD').replaceAll(/\p{M}/gu, '').toLocaleLowerCase('en-US')

const tokens = (value: string): string[] => value.match(/[\p{L}\p{N}]+/gu) ?? []

const fragments = (value: string, width: number): string[] => {
  const characters = [...value]
  if (width <= 0 || characters.length < width) return []
  return Array.from({ length: characters.length - width + 1 }, (_, index) =>
    characters.slice(index, index + width).join(''),
  )
}

const prefixes = (value: string): string[] => {
  const characters = [...value].slice(0, 32)
  return characters.map((_, index) => characters.slice(0, index + 1).join(''))
}

const indexFragments = (value: string): string[] =>
  [1, 2, 3].flatMap((width) => fragments(value, width))

const queryFragments = (value: string): string[] => fragments(value, Math.min([...value].length, 3))

const positiveInteger = (value: number, name: string): number => {
  if (!Number.isInteger(value) || value <= 0) throw new RangeError(`${name} must be positive`)
  return value
}

const nonnegativeInteger = (value: number, name: string): number => {
  if (!Number.isInteger(value) || value < 0) throw new RangeError(`${name} must not be negative`)
  return value
}

const resolveLimits = (
  limits: FdGraphCanvasSearchIndexLimits,
): FdResolvedGraphSearchIndexLimits => ({
  maximumItems: positiveInteger(limits.maximumItems ?? defaultLimits.maximumItems, 'maximum items'),
  maximumTextLength: positiveInteger(
    limits.maximumTextLength ?? defaultLimits.maximumTextLength,
    'maximum text length',
  ),
  maximumKeywordsPerItem: nonnegativeInteger(
    limits.maximumKeywordsPerItem ?? defaultLimits.maximumKeywordsPerItem,
    'maximum keywords per item',
  ),
  maximumIndexedCharacters: positiveInteger(
    limits.maximumIndexedCharacters ?? defaultLimits.maximumIndexedCharacters,
    'maximum indexed characters',
  ),
})

export class FdGraphCanvasSearchIndex {
  private readonly items: readonly FdIndexedGraphSearchItem[]
  private readonly prefixPostings = new Map<string, number[]>()
  private readonly fragmentPostings = new Map<string, number[]>()

  constructor(
    items: readonly FdGraphCanvasSearchItem[],
    limits: FdGraphCanvasSearchIndexLimits = {},
  ) {
    const resolvedLimits = resolveLimits(limits)
    if (items.length > resolvedLimits.maximumItems) {
      throw new FdGraphCanvasSearchIndexError('itemBudgetExceeded')
    }

    const identifiers = new Set<string>()
    let indexedCharacterCount = 0
    this.items = items.map((item, order) => {
      const identifier = graphElementKey(item.id)
      if (identifiers.has(identifier)) {
        throw new FdGraphCanvasSearchIndexError('duplicateElementID')
      }
      identifiers.add(identifier)
      const keywords = item.keywords ?? []
      if (keywords.length > resolvedLimits.maximumKeywordsPerItem) {
        throw new FdGraphCanvasSearchIndexError('keywordBudgetExceeded')
      }
      const values = [item.title, item.subtitle, item.category, ...keywords].filter(
        (value): value is string => value !== undefined,
      )
      if (values.some((value) => value.length > resolvedLimits.maximumTextLength)) {
        throw new FdGraphCanvasSearchIndexError('textBudgetExceeded')
      }
      indexedCharacterCount += values.reduce((total, value) => total + value.length, 0)
      if (indexedCharacterCount > resolvedLimits.maximumIndexedCharacters) {
        throw new FdGraphCanvasSearchIndexError('characterBudgetExceeded')
      }

      const title = normalize(item.title)
      const subtitle = normalize(item.subtitle ?? '')
      const normalizedKeywords = normalize(keywords.join(' '))
      const category = normalize(item.category ?? '')
      const titleTokens = tokens(title)
      const searchableTokens = new Set(
        tokens([title, subtitle, normalizedKeywords, category].join(' ')),
      )
      const indexedPrefixes = new Set<string>()
      const indexedFragments = new Set<string>()
      for (const token of searchableTokens) {
        for (const prefix of prefixes(token)) indexedPrefixes.add(prefix)
        for (const fragment of indexFragments(token)) indexedFragments.add(fragment)
      }
      for (const prefix of indexedPrefixes) {
        this.appendPosting(this.prefixPostings, prefix, order)
      }
      for (const fragment of indexedFragments) {
        this.appendPosting(this.fragmentPostings, fragment, order)
      }
      return {
        item,
        title,
        titleTokens,
        subtitle,
        keywords: normalizedKeywords,
        category,
        tokens: searchableTokens,
        order,
      }
    })
  }

  search(query: string, limit = 20): readonly FdGraphCanvasSearchResult[] {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new RangeError('graph search result limit must not be negative')
    }
    if (limit === 0) return []
    const terms = tokens(normalize(query))
    if (terms.length === 0) return []
    const postings = terms
      .map((term) => this.candidateIndices(term))
      .sort((a, b) => a.length - b.length)
    let candidates = postings[0] ?? []
    for (let index = 1; index < postings.length && candidates.length > 0; index += 1) {
      candidates = intersection(candidates, postings[index] ?? [])
    }
    const ranked: FdRankedGraphSearchItem[] = []
    for (const index of candidates) {
      const item = this.items[index]
      if (!item || !terms.every((term) => matchesTerm(term, item.tokens))) {
        continue
      }
      const candidate: FdRankedGraphSearchItem = {
        result: { id: item.item.id, item: item.item, score: score(terms, item) },
        normalizedTitle: item.title,
        order: item.order,
      }
      const insertionIndex = rankedInsertionIndex(candidate, ranked)
      if (insertionIndex >= limit) continue
      ranked.splice(insertionIndex, 0, candidate)
      if (ranked.length > limit) ranked.pop()
    }
    return ranked.map(({ result }) => result)
  }

  private candidateIndices(term: string): readonly number[] {
    const prefixCandidates = this.prefixPostings.get(term) ?? []
    const termFragments = queryFragments(term)
    const first = termFragments[0]
    if (!first) return prefixCandidates
    let candidates = this.fragmentPostings.get(first)
    if (!candidates) return prefixCandidates
    for (let index = 1; index < termFragments.length; index += 1) {
      const posting = this.fragmentPostings.get(termFragments[index] ?? '')
      if (!posting) return prefixCandidates
      candidates = intersection(candidates, posting)
      if (candidates.length === 0) return prefixCandidates
    }
    return union(prefixCandidates, candidates)
  }

  private appendPosting(postings: Map<string, number[]>, key: string, index: number): void {
    const values = postings.get(key)
    if (values) values.push(index)
    else postings.set(key, [index])
  }
}

const matchesTerm = (term: string, searchableTokens: ReadonlySet<string>): boolean => {
  for (const token of searchableTokens) if (token.includes(term)) return true
  return false
}

const score = (terms: readonly string[], item: FdIndexedGraphSearchItem): number =>
  terms.reduce((total, term) => {
    if (item.title === term) return total + 1_000
    if (item.title.startsWith(term)) return total + 800
    if (item.titleTokens.some((token) => token.startsWith(term))) return total + 650
    if (item.title.includes(term)) return total + 500
    if (item.keywords.includes(term)) return total + 350
    if (item.subtitle.includes(term)) return total + 250
    if (item.category.includes(term)) return total + 150
    return total
  }, 0)

const ranksBefore = (first: FdRankedGraphSearchItem, second: FdRankedGraphSearchItem): boolean => {
  if (first.result.score !== second.result.score) return first.result.score > second.result.score
  if (first.normalizedTitle !== second.normalizedTitle) {
    return first.normalizedTitle < second.normalizedTitle
  }
  return first.order < second.order
}

const rankedInsertionIndex = (
  candidate: FdRankedGraphSearchItem,
  ranked: readonly FdRankedGraphSearchItem[],
): number => {
  let lower = 0
  let upper = ranked.length
  while (lower < upper) {
    const middle = lower + Math.floor((upper - lower) / 2)
    if (ranksBefore(candidate, ranked[middle] as FdRankedGraphSearchItem)) upper = middle
    else lower = middle + 1
  }
  return lower
}

const intersection = (first: readonly number[], second: readonly number[]): number[] => {
  const result: number[] = []
  let firstIndex = 0
  let secondIndex = 0
  while (firstIndex < first.length && secondIndex < second.length) {
    const firstValue = first[firstIndex] as number
    const secondValue = second[secondIndex] as number
    if (firstValue === secondValue) {
      result.push(firstValue)
      firstIndex += 1
      secondIndex += 1
    } else if (firstValue < secondValue) firstIndex += 1
    else secondIndex += 1
  }
  return result
}

const union = (first: readonly number[], second: readonly number[]): number[] => {
  const result: number[] = []
  let firstIndex = 0
  let secondIndex = 0
  while (firstIndex < first.length || secondIndex < second.length) {
    const firstValue = first[firstIndex]
    const secondValue = second[secondIndex]
    if (secondValue === undefined || (firstValue !== undefined && firstValue < secondValue)) {
      result.push(firstValue as number)
      firstIndex += 1
    } else if (firstValue === undefined || secondValue < firstValue) {
      result.push(secondValue)
      secondIndex += 1
    } else {
      result.push(firstValue)
      firstIndex += 1
      secondIndex += 1
    }
  }
  return result
}
