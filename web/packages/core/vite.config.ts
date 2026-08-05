import { globSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))
const srcDir = resolve(root, 'src')

/** One entry per module so consumers can import a single component. */
const entries = Object.fromEntries(
  globSync('**/*.ts', { cwd: srcDir })
    .filter((file) => !file.endsWith('.test.ts'))
    .map((file) => {
      const absolute = resolve(srcDir, file)
      return [relative(srcDir, absolute).replace(/\.ts$/, ''), absolute]
    }),
)

export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true,
    emptyOutDir: true,
    lib: {
      entry: entries,
      formats: ['es'],
    },
    rollupOptions: {
      external: /^lit(\/.*)?$/,
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        preserveModules: false,
      },
    },
  },
})
