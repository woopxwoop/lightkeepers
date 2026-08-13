/**
 * Client fetch + cache for Stygian clear videos (team_key × enemy_id).
 * Called after the solver for the visible solution's three seats.
 */

import type {
  StygianClearVideo,
  StygianClearVideoPair,
  StygianClearVideosPayload,
} from "$lib/definitions";
import { raceAbort } from "$lib/app/race-abort";

const API_URL = "/api/stygian-clear-videos";
const FETCH_TIMEOUT_MS = 15_000;
/** Keep in sync with MAX_TEAM_ENEMY_PAIRS in request-validation. */
const MAX_PAIRS_PER_REQUEST = 12;

function pairKey(teamKey: string, enemyId: number): string {
  return `${teamKey}|${enemyId}`;
}

/** Cached clears keyed by team_key|enemy_id (empty array = known miss). */
const cache = new Map<string, StygianClearVideo[]>();
const inflight = new Map<string, Promise<void>>();

export function clearVideosCacheKey(teamKey: string, enemyId: number): string {
  return pairKey(teamKey, enemyId);
}

/** YouTube video id from a watch / youtu.be / Shorts URL, or null. */
function youtubeVideoId(videoUrl: string): string | null {
  try {
    const u = new URL(videoUrl);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    let id: string | null = null;
    if (host === "youtu.be") {
      id = u.pathname.replace(/^\/+|\/+$/g, "").split("/")[0] || null;
    } else if (host === "youtube.com" || host === "m.youtube.com") {
      id = u.searchParams.get("v");
      if (!id) {
        const shorts = u.pathname.match(/^\/shorts\/([^/]+)/);
        id = shorts?.[1] ?? null;
      }
    }
    if (!id || !/^[\w-]{6,}$/.test(id)) return null;
    return id;
  } catch {
    return null;
  }
}

/**
 * YouTube thumbnail URL, or null for non-YouTube / unparseable links.
 * Prefers maxres (1280×720, true 16:9); callers should fall back on error —
 * maxres is missing for some older videos.
 */
export function youtubeThumbnailUrl(videoUrl: string): string | null {
  const id = youtubeVideoId(videoUrl);
  if (!id) return null;
  return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
}

/** Reliable HQ fallback when maxres 404s (480×360, often letterboxed). */
export function youtubeThumbnailFallbackUrl(videoUrl: string): string | null {
  const id = youtubeVideoId(videoUrl);
  if (!id) return null;
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** Clears already in cache for this pair (including empty). */
export function getClearVideosCached(
  teamKey: string,
  enemyId: number,
): StygianClearVideo[] | undefined {
  return cache.get(pairKey(teamKey, enemyId));
}

/**
 * Ensure clear videos for these pairs are cached. Only requests missing keys.
 * Returns a map of pairKey → clears (empty arrays for misses).
 */
export async function ensureClearVideos(
  pairs: StygianClearVideoPair[],
  signal?: AbortSignal,
): Promise<Map<string, StygianClearVideo[]>> {
  const unique = new Map<string, StygianClearVideoPair>();
  for (const p of pairs) {
    if (!p.team_key || !Number.isFinite(p.enemy_id) || p.enemy_id <= 0) continue;
    unique.set(pairKey(p.team_key, p.enemy_id), p);
  }

  const missing: StygianClearVideoPair[] = [];
  const waits: Promise<void>[] = [];
  for (const [key, pair] of unique) {
    if (cache.has(key)) continue;
    const pending = inflight.get(key);
    if (pending) {
      waits.push(pending);
    } else {
      missing.push(pair);
    }
  }

  for (let i = 0; i < missing.length; i += MAX_PAIRS_PER_REQUEST) {
    const chunk = missing.slice(i, i + MAX_PAIRS_PER_REQUEST);
    const fetchPromise = (async () => {
      const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pairs: chunk }),
        signal: timeout,
      });
      if (!res.ok) {
        throw new Error(`stygian-clear-videos HTTP ${res.status}`);
      }
      const payload = (await res.json()) as StygianClearVideosPayload;
      const byPair = new Map<string, StygianClearVideo[]>();
      for (const p of chunk) {
        byPair.set(pairKey(p.team_key, p.enemy_id), []);
      }
      for (const row of payload.clears ?? []) {
        const key = pairKey(row.team_key, row.enemy_id);
        const list = byPair.get(key);
        if (list) list.push(row);
        else byPair.set(key, [row]);
      }
      for (const [key, list] of byPair) {
        cache.set(key, list);
      }
    })();

    for (const p of chunk) {
      inflight.set(pairKey(p.team_key, p.enemy_id), fetchPromise);
    }
    void fetchPromise.finally(() => {
      for (const p of chunk) {
        const key = pairKey(p.team_key, p.enemy_id);
        if (inflight.get(key) === fetchPromise) inflight.delete(key);
      }
    });
    waits.push(fetchPromise);
  }

  if (waits.length > 0) {
    await raceAbort(Promise.all(waits), signal);
  }

  const out = new Map<string, StygianClearVideo[]>();
  for (const key of unique.keys()) {
    out.set(key, cache.get(key) ?? []);
  }
  return out;
}
