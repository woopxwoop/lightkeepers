/**
 * Roster save snapshots.
 *
 * Capture a frozen clone + JSON *before* any await so a successful response
 * commits exactly what was sent, while later editor edits stay unsaved.
 */

import type {
  CharacterOwned,
  InventoryArtifact,
  InventoryWeapon,
  RosterProgress,
} from "$lib/definitions";
import { cloneRosterProgress } from "$lib/roster-progress";
import {
  cloneInventoryArtifact,
  cloneInventoryWeapon,
} from "$lib/roster-inventory";

export const ROSTER_STORAGE_KEY = "charactersOwned";

export type RosterCapture = {
  /** Cloned roster frozen at capture time (including progress). */
  roster: CharacterOwned[];
  /** Stable JSON of `roster` for comparison / localStorage. */
  json: string;
  /** True when `current` no longer matches this capture. */
  differsFrom(current: CharacterOwned[]): boolean;
};

/** Clone the editor roster and freeze it for a pending save. */
export function captureRoster(roster: CharacterOwned[]): RosterCapture {
  const cloned = roster.map((c) => ({
    ...c,
    progress: cloneRosterProgress(c.progress),
  }));
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

/** POST a captured roster to `/api/roster`. Optional inventory slices ride along on GOOD import. */
export async function postRoster(
  roster: CharacterOwned[],
  inventory?: {
    weapons?: InventoryWeapon[];
    artifacts?: InventoryArtifact[];
  },
): Promise<{ ok: true } | { ok: false; status: number; message?: string }> {
  const entries = roster.map((c) => {
    const entry: {
      name_id: string;
      isOwned: boolean;
      progress?: RosterProgress | null;
    } = {
      name_id: c.name_id,
      isOwned: c.isOwned,
    };
    if (c.progress !== undefined) {
      entry.progress = cloneRosterProgress(c.progress);
    }
    return entry;
  });
  const body: {
    roster: typeof entries;
    weapons?: InventoryWeapon[];
    artifacts?: InventoryArtifact[];
  } = { roster: entries };
  if (inventory?.weapons) {
    body.weapons = inventory.weapons.map(cloneInventoryWeapon);
  }
  if (inventory?.artifacts) {
    body.artifacts = inventory.artifacts.map(cloneInventoryArtifact);
  }
  const res = await fetch("/api/roster", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true };

  let message: string | undefined;
  try {
    const text = await res.text();
    if (text) {
      try {
        const parsed = JSON.parse(text) as { message?: unknown };
        message =
          typeof parsed.message === "string" && parsed.message
            ? parsed.message
            : text;
      } catch {
        message = text;
      }
    }
  } catch {
    /* ignore body read failures */
  }

  if (res.status === 400) {
    const sample = entries[0];
    console.error("[roster sync] 400 Bad Request", {
      message: message ?? "(no body)",
      count: entries.length,
      sampleKeys: sample ? Object.keys(sample) : [],
      sample,
    });
  }

  return { ok: false, status: res.status, message };
}
