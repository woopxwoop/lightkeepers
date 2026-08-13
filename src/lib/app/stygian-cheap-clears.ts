/**
 * Client fetch + cache for experimental Stygian cost-capped clears.
 * Roster-keyed: owned teams × Fearless clears with cost ≤ maxCost, by time.
 */

import type {
  CharacterOwned,
  StygianCheapClearRow,
  StygianCheapClearsPayload,
} from "$lib/definitions";
import {
  STYGIAN_CHEAP_CLEARS_DEFAULT_MAX_COST,
  STYGIAN_CHEAP_CLEARS_DIFFICULTY,
} from "$lib/definitions";
import { ownedNameIds } from "$lib/utils";

const API_URL = "/api/stygian-cheap-clears";
const FETCH_TIMEOUT_MS = 15_000;

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
  difficulty: string,
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
  difficulty?: string;
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
  if (hit) return hit.rows;

  const pending = inflight.get(key);
  if (pending) return pending;

  const fetchPromise = (async () => {
    const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    const combined =
      opts.signal !== undefined
        ? AbortSignal.any([opts.signal, timeout])
        : timeout;
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
      signal: combined,
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
  try {
    return await fetchPromise;
  } finally {
    inflight.delete(key);
  }
}
