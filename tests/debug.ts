import type { Page } from "@playwright/test";

/** Verbose browser/network logs for CI diagnosis (PLAYWRIGHT_DEBUG_NET=1 or CI). */
export function attachBrowserDebug(page: Page): void {
  const enabled =
    process.env.PLAYWRIGHT_DEBUG_NET === "1" || process.env.CI === "true" || process.env.CI === "1";
  if (!enabled) return;

  page.on("console", (msg) => {
    // eslint-disable-next-line no-console
    console.log(`[browser:${msg.type()}]`, msg.text());
  });
  page.on("pageerror", (err) => {
    // eslint-disable-next-line no-console
    console.log("[browser ERROR]", err.message);
  });
  page.on("request", (req) => {
    try {
      const p = new URL(req.url()).pathname;
      if (p.includes("/api/") || p.endsWith(".js") || p.includes("nodes/")) {
        // eslint-disable-next-line no-console
        console.log("[browser REQ]", req.method(), p);
      }
    } catch {
      /* ignore */
    }
  });
  page.on("requestfailed", (req) => {
    // eslint-disable-next-line no-console
    console.log(
      "[browser FAIL]",
      req.method(),
      req.url(),
      req.failure()?.errorText,
    );
  });
}
