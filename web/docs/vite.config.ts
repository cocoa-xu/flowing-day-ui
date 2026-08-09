import { resolve } from 'node:path'
import { defineConfig } from 'vite'

/**
 * The landing page consumes the core package's sources rather than its build output, so
 * editing a component hot-reloads the page instead of waiting on a rebuild. Published
 * consumers still resolve through the package's `exports` map as normal.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@flowing-day/canvas': resolve(import.meta.dirname, '../packages/canvas/src/index.ts'),
      '@flowing-day/ui': resolve(import.meta.dirname, '../packages/core/src/index.ts'),
    },
  },
})
