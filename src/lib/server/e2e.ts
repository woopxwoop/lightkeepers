import { env } from "$env/dynamic/private";

/** True when Playwright launched the app with PLAYWRIGHT_E2E=1. */
export function isPlaywrightE2e(): boolean {
  const v = env.PLAYWRIGHT_E2E?.trim().toLowerCase();
  return v === "1" || v === "true";
}
