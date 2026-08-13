import { svg } from 'lit'
import type { FdStatusTone } from '../components/badge/fd-badge.js'

export function defaultStatusGlyph(tone: FdStatusTone) {
  if (tone === 'success') {
    return svg`<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="m4.6 8.2 2.1 2.1 4.6-4.7" fill="none" stroke="var(--_fd-surface-canvas)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  }
  if (tone === 'warning') {
    return svg`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6 15 14H1L8 1.6Z" fill="currentColor"/><path d="M8 5v4.2" stroke="var(--_fd-surface-canvas)" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11.6" r=".8" fill="var(--_fd-surface-canvas)"/></svg>`
  }
  if (tone === 'critical') {
    return svg`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 1.5 6 0 3.5 3.5v6L11 14.5H5L1.5 11V5L5 1.5Z" fill="currentColor"/><path d="m5.6 5.6 4.8 4.8m0-4.8-4.8 4.8" stroke="var(--_fd-surface-canvas)" stroke-width="1.5" stroke-linecap="round"/></svg>`
  }
  if (tone === 'accent') {
    return svg`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.7 9.2 6.8 14.3 8l-5.1 1.2L8 14.3 6.8 9.2 1.7 8l5.1-1.2L8 1.7Z" fill="currentColor"/></svg>`
  }
  return svg`<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.7" fill=${tone === 'informational' ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="4.8" r=".8" fill=${tone === 'informational' ? 'var(--_fd-surface-canvas)' : 'currentColor'}/><path d="M8 7.2v4" stroke=${tone === 'informational' ? 'var(--_fd-surface-canvas)' : 'currentColor'} stroke-width="1.4" stroke-linecap="round"/></svg>`
}
