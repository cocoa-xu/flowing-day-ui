import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const here = import.meta.dirname

/**
 * The playground consumes the core package's sources rather than its build output, so
 * editing a component hot-reloads the page instead of waiting on a rebuild. Published
 * consumers still resolve through the package's `exports` map as normal.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@flowing-day/ui': resolve(here, '../packages/core/src/index.ts'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(here, 'index.html'),
        window: resolve(here, 'window.html'),
      },
    },
  },
})
