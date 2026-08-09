import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

/**
 * Components are tested in a real browser. Shadow DOM, adopted stylesheets,
 * `ElementInternals` and form association are the things most worth testing here,
 * and they are exactly what DOM emulators get wrong.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
    },
  },
})
