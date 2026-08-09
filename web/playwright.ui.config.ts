import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './ui-tests',
  testMatch: '**/*.ui.spec.ts',
  fullyParallel: true,
  forbidOnly: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'pnpm exec vite --config ui-tests/vite.config.ts',
    url: 'http://127.0.0.1:4174/ui-tests/fixture.html',
    reuseExistingServer: true,
  },
})
