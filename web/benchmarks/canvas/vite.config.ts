import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@flowing-day/canvas': resolve(import.meta.dirname, '../../packages/canvas/src/index.ts'),
    },
  },
})
