import { FdIcons } from '@flowing-day/ui'
import '@flowing-day/ui'
import '@flowing-day/ui/theme.css'

/**
 * Placeholder glyphs so the playground is not blank. Real applications register a
 * proper set — SF Symbols themselves cannot be redistributed.
 */
const stroke = (path: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">${path}</svg>`

FdIcons.register({
  power: stroke('<path d="M12 3v9"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>'),
  eye: stroke(
    '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  ),
  sparkles: stroke('<path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>'),
  bolt: stroke('<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>'),
})

const accent = document.querySelector<HTMLInputElement>('#accent')
const inset = document.querySelector<HTMLInputElement>('#inset')
const scheme = document.querySelector<HTMLButtonElement>('#scheme')
const root = document.documentElement

accent?.addEventListener('input', () => {
  root.style.setProperty('--fd-accent-fill', accent.value)
})

inset?.addEventListener('input', () => {
  root.style.setProperty('--fd-metric-row-inset', `${inset.value}px`)
})

scheme?.addEventListener('click', () => {
  root.dataset.fdScheme = root.dataset.fdScheme === 'dark' ? 'light' : 'dark'
})

// A subtree override, mirroring `.settingsAccent(_:)` applied to one branch of the view tree.
const scoped = document.querySelectorAll('fd-section')[2]
scoped?.style.setProperty('--fd-accent-fill', '#C4453D')
