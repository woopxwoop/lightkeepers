/**
 * Characters whose CDN Builds summary is known-stale (typically after a kit
 * buff, until the investment pipeline is re-run).
 *
 * Ids are kit `name_id`s — the character page slug (`Hutao`, `Ayaka`, `Qin`
 * for Jean), not GOOD keys. Traveler element suffixes are stripped, so
 * `PlayerBoy` covers every resonance.
 *
 * Fallback until CDN summaries carry `upToDate: false` from gcsim
 * `characters.json` (Yae / Beidou stellar buffs). Prefer the payload flag
 * after merge+sync; keep ids here so the site hides numbers before that.
 *
 * While stale, the Builds tab hides the summary and points at Crimson Witch;
 * planner autofill also skips those numbers. Remove the id once summaries
 * are regenerated and marked up to date.
 */
import { travelerBaseNameId } from "$lib/traveler-kits";

export const STALE_BUILD_SUMMARY_NAME_IDS: ReadonlySet<string> = new Set([
  "Yae",
  "Beidou",
]);

export function isStaleBuildSummary(
  nameId: string | null | undefined,
  staleIds: ReadonlySet<string> = STALE_BUILD_SUMMARY_NAME_IDS,
): boolean {
  if (!nameId) return false;
  return staleIds.has(travelerBaseNameId(nameId));
}
