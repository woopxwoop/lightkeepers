/**
 * Playwright E2E detection.
 *
 * Use `process.env` (not `$env/dynamic/private`). In `vite dev`, Kit's dynamic
 * private env is a config-time snapshot from `loadEnv` and has missed
 * PLAYWRIGHT_E2E on CI even when Playwright's webServer.env set it.
 */
export function isPlaywrightE2e(): boolean {
  const v = process.env.PLAYWRIGHT_E2E?.trim().toLowerCase();
  return v === "1" || v === "true";
}
