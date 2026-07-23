/**
 * Warm the app before the suite. On CI this hits the production Node server
 * (see playwright.config.ts); locally it warms vite dev.
 */
async function globalSetup() {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173";
  const paths = ["/", "/abyss", "/stygian", "/pulls", "/api/static"];
  const timeoutMs = 15_000;

  await Promise.all(
    paths.map(async (path) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        await fetch(`${base}${path}`, { signal: controller.signal });
      } catch {
        /* webServer readiness is enforced separately */
      } finally {
        clearTimeout(timer);
      }
    }),
  );
}

export default globalSetup;
