/** Characters released within this many days are considered "new". */
export const NEW_CHARACTER_DAYS = 20;

/**
 * Whether a character was released recently enough to be flagged as "new".
 * Characters with no `released_at` are not considered new.
 *
 * Kept in its own module so call sites (e.g. root layout bootstrap) do not
 * pull `$lib/utils` — that file eagerly imports weapons.json (~400KB).
 */
export function isNewCharacter(releasedAt: string | null | undefined): boolean {
  if (!releasedAt) return false;
  // Normalize space-separated timestamps (e.g. "2026-06-29 16:00:00+00")
  // to ISO 8601 format so `new Date()` parses reliably across runtimes.
  const released = new Date(releasedAt.replace(" ", "T"));
  if (isNaN(released.getTime())) return false;
  const cutoff = Date.now() - NEW_CHARACTER_DAYS * 86_400_000;
  return released.getTime() > cutoff;
}
