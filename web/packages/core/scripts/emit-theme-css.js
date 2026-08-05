/**
 * Emits `dist/theme.css` from the built token module, so the standalone stylesheet
 * and the shadow-root aliases can never disagree. Runs after `vite build`.
 */
import { writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { globalThemeCss } from '../dist/tokens/theme.js'

const outFile = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/theme.css')

await writeFile(outFile, globalThemeCss(), 'utf8')

console.log(`emitted ${outFile}`)
