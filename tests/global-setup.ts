/**
 * Warm Vite's dep optimizer / route modules before the suite so the first
 * client-hydrated tests do not burn their wait budgets on cold compiles.
 */
async function globalSetup() {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173";
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
