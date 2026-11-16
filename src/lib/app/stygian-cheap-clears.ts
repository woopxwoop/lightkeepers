/**
 * Client fetch + cache for experimental Stygian cost-capped clears.
 * Roster-keyed: owned teams × Fearless clears with cost ≤ maxCost, by time.
 */

import type {
  CharacterOwned,
  StygianCheapClearRow,
  StygianCheapClearsPayload,
  StygianClearDifficulty,
} from "#lib/definitions.js";
import {
  STYGIAN_CHEAP_CLEARS_DEFAULT_MAX_COST,
  STYGIAN_CHEAP_CLEARS_DIFFICULTY,
} from "#lib/definitions.js";
import { raceAbort } from "#lib/app/race-abort.js";
import { ownedNameIds } from "#lib/utils.js";

const API_URL = "/api/stygian-cheap-clears";
const FETCH_TIMEOUT_MS = 15_000;

export type CheapClearsStatus =
  "idle" | "loading" | "ready" | "empty" | "error" | "unavailable";

export type CheapClearsFetchPhase = "idle" | "loading" | "settled" | "failed";

/**
 * Status for one cheap-clear request.
 * Fewer than three bosses is `unavailable` (no request). A settled payload
 * with no rows is `empty`. `fetchKey` must match `requestKey` or the
 * previous result is still in flight for a different roster or attempt.
 */
export function cheapClearsStatus(input: {
  active: boolean;
  bossCount: number;
  fetch: CheapClearsFetchPhase;
  fetchKey: string | null;
  requestKey: string;
  rowCount: number;
}): CheapClearsStatus {
  if (!input.active) return "idle";
  if (input.bossCount < 3) return "unavailable";
  if (
    input.fetch === "idle" ||
    input.fetch === "loading" ||
    input.fetchKey !== input.requestKey
  ) {
    return "loading";
  }
  if (input.fetch === "failed") return "error";
  if (input.rowCount === 0) return "empty";
  return "ready";
}

type CacheEntry = {
  rows: StygianCheapClearRow[];
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<StygianCheapClearRow[]>>();

function rosterKey(characters: string[]): string {
  return JSON.stringify([...characters].sort());
}

function cacheKey(
  characters: string[],
  stygianVersion: number,
  enemyIds: number[],
  difficulty: StygianClearDifficulty,
  maxCost: number,
): string {
  const enemies = [...enemyIds].sort((a, b) => a - b).join(",");
  return `${stygianVersion}:${difficulty}:c${maxCost}:${enemies}:${rosterKey(characters)}`;
}

/**
 * Ensure cost-capped clear rows for this roster × board are cached.
 * Returns the rows (empty if none).
 */
export async function ensureCheapClears(opts: {
  owned: CharacterOwned[];
  stygianVersion: number;
  enemyIds: number[];
  difficulty?: StygianClearDifficulty;
  maxCost?: number;
  signal?: AbortSignal;
}): Promise<StygianCheapClearRow[]> {
  const characters = [...ownedNameIds(opts.owned)];
  const difficulty = opts.difficulty ?? STYGIAN_CHEAP_CLEARS_DIFFICULTY;
  const maxCost = opts.maxCost ?? STYGIAN_CHEAP_CLEARS_DEFAULT_MAX_COST;
  const enemyIds = opts.enemyIds.filter((id) => Number.isFinite(id) && id > 0);
  if (characters.length === 0 || enemyIds.length === 0) return [];

  const key = cacheKey(
    characters,
    opts.stygianVersion,
    enemyIds,
    difficulty,
    maxCost,
  );
  const hit = cache.get(key);
  if (hit) return raceAbort(Promise.resolve(hit.rows), opts.signal);

  let fetchPromise = inflight.get(key);
  if (!fetchPromise) {
    fetchPromise = (async () => {
      const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          characters,
          stygianVersion: opts.stygianVersion,
          enemyIds,
          difficulty,
          maxCost,
        }),
        signal: timeout,
      });
      if (!res.ok) {
        throw new Error(`stygian-cheap-clears HTTP ${res.status}`);
      }
      const payload = (await res.json()) as StygianCheapClearsPayload;
      const rows = payload.rows ?? [];
      cache.set(key, { rows });
      return rows;
    })();
    inflight.set(key, fetchPromise);
    void fetchPromise
      .finally(() => {
        if (inflight.get(key) === fetchPromise) inflight.delete(key);
      })
      .then(
        () => {},
        () => {},
      );
  }

  return raceAbort(fetchPromise, opts.signal);
}
