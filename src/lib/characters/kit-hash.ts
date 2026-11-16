/**
 * `#kit-…` anchors on the character page (skills, passives, constellations).
 *
 * The Kit panel only exists while its tab is open, so the page listens here
 * to switch tabs from any tab; the panel scrolls to the target on mount.
 */

/** The decoded `#kit-…` hash of the current URL, or null. */
export function currentKitHash(): string | null {
  let hash = window.location.hash;
  try {
    hash = decodeURIComponent(hash);
  } catch {
    // Keep the raw hash when it is not valid URI encoding.
  }
  return hash.startsWith("#kit-") ? hash : null;
}

/** Call `handler` whenever the URL moves to a `#kit-…` hash. Returns the unsubscribe. */
export function onKitHashChange(handler: (hash: string) => void): () => void {
  const listener = () => {
    const hash = currentKitHash();
    if (hash) handler(hash);
  };
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}
