/**
 * SF Symbols cannot be redistributed, so the library ships the icon *interface* and
 * no icon data. Applications register any set they like — `@flowing-day/ui-icons-lucide`
 * provides a ready-made mapping from SF Symbol names to Lucide equivalents.
 *
 * Registered markup is inserted verbatim into the shadow root. Treat it exactly like
 * the application's own source: never register markup from an untrusted origin.
 */

const icons = new Map<string, string>()
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

export const FdIcons = {
  /** Register icons by name. Later registrations of the same name win. */
  register(entries: Readonly<Record<string, string>>): void {
    for (const [name, markup] of Object.entries(entries)) icons.set(name, markup)
    notify()
  },

  resolve(name: string): string | undefined {
    return icons.get(name)
  },

  has(name: string): boolean {
    return icons.has(name)
  },

  names(): string[] {
    return [...icons.keys()]
  },

  clear(): void {
    icons.clear()
    notify()
  },

  /** Lets already-rendered `<fd-icon>` elements pick up a late registration. */
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
} as const
