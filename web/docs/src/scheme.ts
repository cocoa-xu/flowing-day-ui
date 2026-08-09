export type ResolvedScheme = 'light' | 'dark'

export function resolveScheme(value: string, systemPrefersDark: boolean): ResolvedScheme {
  if (value === 'dark') return 'dark'
  if (value === 'light') return 'light'
  return systemPrefersDark ? 'dark' : 'light'
}
