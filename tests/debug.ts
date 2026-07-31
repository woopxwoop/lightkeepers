import type { Page } from "@playwright/test";

/** Verbose browser/network logs for CI diagnosis (PLAYWRIGHT_DEBUG_NET=1 or CI). */
export function attachBrowserDebug(page: Page): void {
  const enabled =
    process.env.PLAYWRIGHT_DEBUG_NET === "1" ||
    process.env.CI === "true" ||
    process.env.CI === "1";
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
    let pathname = req.url();
    try {
      pathname = new URL(req.url()).pathname;
    } catch {
      /* keep raw url fallback only if unparseable — still avoid logging it below */
      pathname = "(unparseable)";
    }
    const errText = req.failure()?.errorText?.replace(/\s+/g, " ").trim();
    // eslint-disable-next-line no-console
    console.log(
      "[browser FAIL]",
      req.method(),
      pathname,
      ...(errText ? [errText] : []),
    );
  });
}
