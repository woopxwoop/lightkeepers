import { updated } from "$app/state";

const CHUNK_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|Loading chunk \d+ failed|Importing a module script failed/i;

let reloading = false;

/**
 * Reload only when a newer build is actually deployed — the case where hashed
 * chunks 404 and nothing but a reload helps. Any other chunk failure (offline,
 * flaky network) is left to the importer: LoadOnFirstOpen and the lazy
 * equipment tables catch it and retry on the next request, which a reload
 * into a browser offline page would only make worse.
 */
async function reloadIfNewDeploy(): Promise<void> {
  if (reloading || typeof window === "undefined") return;
  let newDeploy = updated.current;
  if (!newDeploy) {
    try {
      newDeploy = await updated.check();
    } catch {
      newDeploy = false; // version.json unreachable too — not a deploy signal
    }
  }
  if (!newDeploy || reloading) return;
  reloading = true;
  window.location.reload();
}

/**
 * Recovers from stale deployments where hashed Vite chunks 404 after a redeploy.
 * Covers vite:preloadError and dynamic import failures SvelteKit does not surface.
 *
 * Every built dynamic import goes through Vite's preload helper, which fires
 * vite:preloadError before rethrowing — even when the caller catches the error
 * (e.g. equipment-data's lazy tables) — so no per-call wrapper is needed. The
 * listener never calls preventDefault, so the import still rejects and its
 * caller's own recovery runs whenever this decides not to reload.
 */
export function installChunkLoadRecovery(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("vite:preloadError", () => {
    void reloadIfNewDeploy();
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
      // Known stale deploy: the reload replaces the error, so don't report it.
      if (updated.current) event.preventDefault();
      void reloadIfNewDeploy();
    }
  });
}
