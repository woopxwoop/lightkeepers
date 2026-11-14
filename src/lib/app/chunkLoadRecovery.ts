const CHUNK_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|Loading chunk \d+ failed|Importing a module script failed/i;

let reloading = false;

function reloadOnStaleDeploy(): void {
  if (reloading || typeof window === "undefined") return;
  reloading = true;
  window.location.reload();
}

/**
 * Recovers from stale deployments where hashed Vite chunks 404 after a redeploy.
 * Covers vite:preloadError and dynamic import failures SvelteKit does not surface.
 *
 * Every built dynamic import goes through Vite's preload helper, which fires
 * vite:preloadError before rethrowing — even when the caller catches the error
 * (e.g. equipment-data's lazy tables) — so no per-call wrapper is needed.
 */
export function installChunkLoadRecovery(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("vite:preloadError", () => {
    reloadOnStaleDeploy();
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "";

    if (CHUNK_ERROR_PATTERN.test(message)) {
      event.preventDefault();
      reloadOnStaleDeploy();
    }
  });
}
