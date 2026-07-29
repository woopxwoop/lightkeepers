/**
 * Roster save snapshots.
 *
 * Capture a frozen clone + JSON *before* any await so a successful response
 * commits exactly what was sent, while later editor edits stay unsaved.
 */

import type { CharacterOwned } from "$lib/definitions";

export const ROSTER_STORAGE_KEY = "charactersOwned";

export type RosterCapture = {
  /** Shallow-cloned roster frozen at capture time. */
  roster: CharacterOwned[];
  /** Stable JSON of `roster` for comparison / localStorage. */
  json: string;
  /** True when `current` no longer matches this capture. */
  differsFrom(current: CharacterOwned[]): boolean;
};

/** Clone the editor roster and freeze it for a pending save. */
export function captureRoster(roster: CharacterOwned[]): RosterCapture {
  const cloned = roster.map((c) => ({ ...c }));
  const json = JSON.stringify(cloned);
  return {
    roster: cloned,
    json,
    differsFrom(current) {
      return JSON.stringify(current) !== json;
    },
  };
}

/** Whether the editor differs from a previously saved JSON snapshot. */
export function rosterDiffersFromSnapshot(
  roster: CharacterOwned[],
  savedJson: string,
): boolean {
  return JSON.stringify(roster) !== savedJson;
}

/** Persist roster JSON to localStorage. Returns false if storage is unavailable. */
export function writeRosterLocal(json: string): boolean {
  try {
    localStorage.setItem(ROSTER_STORAGE_KEY, json);
    return true;
  } catch {
    return false;
  }
}

/** POST a captured roster to `/api/roster`. */
export async function postRoster(
  roster: CharacterOwned[],
): Promise<{ ok: true } | { ok: false; status: number }> {
  const res = await fetch("/api/roster", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roster }),
  });
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true };
}
