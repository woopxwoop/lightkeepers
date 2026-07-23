/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // Cold `vite dev` on CI can take >15s before client effects fire /api/teams.
  timeout: 60_000,
  expect: {
    timeout: process.env.CI ? 30_000 : 10_000,
  },
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    serviceWorkers: 'block',
    navigationTimeout: 60_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // Inline env so PLAYWRIGHT_E2E is set before Vite snapshots process.env
    // (Kit's $env/dynamic/private is config-time; we also read process.env live).
    command:
      process.platform === 'win32'
        ? 'pnpm dev'
        : 'PLAYWRIGHT_E2E=1 pnpm dev',
    url: 'http://localhost:5173',
    // Only reuse a server that was already started with PLAYWRIGHT_E2E=1.
    // A plain `pnpm dev` would miss SSR fixtures and greenwash false failures.
    reuseExistingServer:
      !process.env.CI && process.env.PLAYWRIGHT_E2E === '1',
    timeout: 120_000,
    env: {
      ...process.env,
      PLAYWRIGHT_E2E: '1',
    },
  },
});
