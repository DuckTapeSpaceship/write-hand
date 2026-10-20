import { defineConfig, devices } from '@playwright/test'

const PORT = 4174
const app = /(app|quality|realism)\.spec\.ts/

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results/artifacts',
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
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
    { name: 'lab', testMatch: /lab\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
  ],
})
