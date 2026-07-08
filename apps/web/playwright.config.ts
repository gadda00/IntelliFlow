import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for the Busara web app.
 *
 * - Spins up the Next.js dev server (`pnpm dev:web`) automatically.
 * - Runs against Chromium desktop + Pixel 5 mobile viewport.
 * - Captures a trace on the first retry (for CI debugging).
 * - Retries twice in CI, zero locally (fail fast for developer feedback).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'pnpm dev:web',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
