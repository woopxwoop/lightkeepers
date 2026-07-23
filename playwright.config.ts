/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
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
