/// <reference types="node" />
import { defineConfig, devices } from "@playwright/test";

const onCI = !!process.env.CI;

/**
 * CI uses a production Node build — `vite dev` on Ubuntu runners was serving
 * SSR HTML while client modules never hydrated enough to call /api/teams.
 * Local keeps `vite dev` for fast iteration.
 */
const webServerCommand = onCI
  ? "pnpm build && PORT=5173 HOST=127.0.0.1 ORIGIN=http://127.0.0.1:5173 node build"
  : process.platform === "win32"
    ? "pnpm dev"
    : "PLAYWRIGHT_E2E=1 pnpm dev";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: true,
  forbidOnly: onCI,
  retries: onCI ? 2 : 0,
  workers: onCI ? 1 : undefined,
  timeout: 60_000,
  expect: {
    timeout: onCI ? 30_000 : 10_000,
  },
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
    serviceWorkers: "block",
    navigationTimeout: 60_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: webServerCommand,
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !onCI && process.env.PLAYWRIGHT_E2E === "1",
    timeout: 180_000,
    env: {
      ...process.env,
      PLAYWRIGHT_E2E: "1",
      PLAYWRIGHT_DEBUG_NET: onCI ? "1" : process.env.PLAYWRIGHT_DEBUG_NET ?? "",
    },
  },
});
