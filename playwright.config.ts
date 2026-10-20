import { defineConfig, devices } from '@playwright/test'

const PORT = 4174
const app = /(app|quality|realism|launch)\.spec\.ts/
// PW_BASE_URL=http://127.0.0.1:8340 runs the suite against a built image
// (CSP, service worker, Caddy headers) instead of the dev server.
const external = process.env.PW_BASE_URL

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results/artifacts',
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list']],
  use: {
    baseURL: external ?? `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: external
    ? undefined
    : {
        command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
        url: `http://127.0.0.1:${PORT}/`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
  projects: [
    { name: 'desktop', testMatch: app, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'pixel7', testMatch: app, use: { ...devices['Pixel 7'] } },
    // WebKit needs Ubuntu libraries: run these via `npm run e2e` (Docker).
    { name: 'iphone15', testMatch: app, use: { ...devices['iPhone 15'] } },
    { name: 'ipad', testMatch: app, use: { ...devices['iPad Pro 11'] } },
    { name: 'lab', testMatch: external ? /^$/ : /lab\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
  ],
})
