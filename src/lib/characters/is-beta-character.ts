/**
 * CB / unreleased characters for Characters UI (BETA badge).
 * Dimbreath rows have `released_at`; CB-only kits leave it null.
 * Traveler resonance ids also lack release dates — exclude them.
 */
export function isBetaCharacter(
  nameId: string | null | undefined,
  releasedAt: string | null | undefined,
): boolean {
  if (!nameId) return false;
  if (nameId.startsWith("PlayerBoy") || nameId.startsWith("PlayerGirl")) {
    return false;
  }
  return releasedAt == null || releasedAt === "";
}
