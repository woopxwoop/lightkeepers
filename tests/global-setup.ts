/**
 * Warm the app before the suite. On CI this hits the production Node server
 * (see playwright.config.ts); locally it warms vite dev.
 */
async function globalSetup() {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173";
  const paths = ["/", "/abyss", "/stygian", "/pulls", "/api/static"];
  await Promise.all(
    paths.map(async (path) => {
      try {
        await fetch(`${base}${path}`);
      } catch {
        /* webServer readiness is enforced separately */
      }
    }),
  );
}

export default globalSetup;
