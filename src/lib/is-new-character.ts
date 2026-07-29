/** Characters released within this many days are considered "new". */
export const NEW_CHARACTER_DAYS = 20;

/**
 * Whether a character was released recently enough to be flagged as "new".
 * Characters with no `released_at` are not considered new.
 *
 * Kept in its own module so bootstrap/layout can import it without pulling
 * heavier client modules (equipment JSON, large utils graphs).
 */
export function isNewCharacter(releasedAt: string | null | undefined): boolean {
  if (!releasedAt) return false;
  // Normalize space-separated timestamps (e.g. "2026-06-29 16:00:00+00")
  // to ISO 8601 format so `new Date()` parses reliably across runtimes.
  const released = new Date(releasedAt.replace(" ", "T"));
  if (isNaN(released.getTime())) return false;
  const now = Date.now();
  // Future-dated rows are not "new" yet (bad data / unreleased).
  if (released.getTime() > now) return false;
  const cutoff = now - NEW_CHARACTER_DAYS * 86_400_000;
  return released.getTime() > cutoff;
}
