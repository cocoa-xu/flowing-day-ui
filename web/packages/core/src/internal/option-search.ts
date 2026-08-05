/**
 * Mirrors `PreferencesOptionSearch.matches(_:query:)`: the query is trimmed, an empty one
 * matches everything, and anything else is a case-insensitive substring test.
 */
export function optionMatches(label: string, query: string): boolean {
  const trimmed = query.trim()
  if (trimmed === '') return true
  return label.toLocaleLowerCase().includes(trimmed.toLocaleLowerCase())
}
