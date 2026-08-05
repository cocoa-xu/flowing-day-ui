import '@flowing-day/ui'
import { installTheme, registerPlaceholderIcons } from './shared.js'

installTheme()
registerPlaceholderIcons()

const root = document.documentElement
const toggle = document.querySelector<HTMLButtonElement>('#scheme')

// The backdrop is black, so the mock opens dark and can be flipped to compare.
root.dataset.fdScheme = 'dark'

toggle?.addEventListener('click', () => {
  const next = root.dataset.fdScheme === 'dark' ? 'light' : 'dark'
  root.dataset.fdScheme = next
  root.style.colorScheme = next
  toggle.textContent = next === 'dark' ? 'Light' : 'Dark'
})

document.querySelector('fd-settings-window')?.addEventListener('fd-close', () => {
  // Nothing to close in an embed; the SwiftUI original calls through to NSPanel.close().
  toggle?.animate([{ opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }], { duration: 400 })
})
