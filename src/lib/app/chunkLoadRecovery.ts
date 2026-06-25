const CHUNK_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|Loading chunk \d+ failed|Importing a module script failed/i;

let reloading = false;

export function reloadOnStaleDeploy(): void {
  if (reloading || typeof window === "undefined") return;
  reloading = true;
  window.location.reload();
}

/**
 * Recovers from stale deployments where hashed Vite chunks 404 after a redeploy.
 * Covers vite:preloadError and dynamic import failures SvelteKit does not surface.
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

/** Wrap manual import() calls so stale chunk 404s trigger a full reload. */
export async function safeDynamicImport<T>(
  importFn: () => Promise<T>,
): Promise<T> {
  try {
    return await importFn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (CHUNK_ERROR_PATTERN.test(message)) {
      reloadOnStaleDeploy();
    }
    throw err;
  }
}
