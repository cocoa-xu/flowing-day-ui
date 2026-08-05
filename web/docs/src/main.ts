import '@flowing-day/ui'
import { installTheme, registerPlaceholderIcons } from './shared.js'

installTheme()
registerPlaceholderIcons()

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
