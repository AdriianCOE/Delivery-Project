import { defineConfig, devices } from '@playwright/test'

const e2ePort = process.env.PLAYWRIGHT_PORT || '5174'
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${e2ePort}`
const shouldStartWebServer =
  process.env.PLAYWRIGHT_USE_WEBSERVER &&
  !process.env.PLAYWRIGHT_BASE_URL &&
  !process.env.PLAYWRIGHT_SKIP_WEBSERVER
process.env.VITE_PLAYWRIGHT_FIXTURES = process.env.VITE_PLAYWRIGHT_FIXTURES || 'true'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html'], ['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 390, height: 844 },
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: shouldStartWebServer
    ? {
        command: 'node scripts/playwright-vite-server.mjs',
        url: `http://127.0.0.1:${e2ePort}`,
        reuseExistingServer: false,
        timeout: 120_000,
        gracefulShutdown: { signal: 'SIGTERM', timeout: 1_000 },
      }
    : undefined,
})
