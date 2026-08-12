/**
 * Lazy client loader for per-character Builds summaries (planner autofill).
 * Goes through `/api/character-summary/[key]` — CDN has no browser CORS.
 *
 * `null` = genuinely missing (HTTP 404). Transient fetch/parse failures throw
 * so callers can leave existing targets unchanged.
 */
import { CDN_FETCH_TIMEOUT_MS } from "$lib/cdn-fetch";
import type { CharacterIndex } from "$lib/types/investment";

const cache = new Map<string, CharacterIndex | null>();
const pending = new Map<string, Promise<CharacterIndex | null>>();

export function getCharacterSummaryCached(
  key: string,
): CharacterIndex | null | undefined {
  if (!cache.has(key)) return undefined;
  return cache.get(key) ?? null;
}

export function loadCharacterSummary(
  key: string,
): Promise<CharacterIndex | null> {
  if (!key) return Promise.resolve(null);
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);

  const existing = pending.get(key);
  if (existing) return existing;

  const req = (async () => {
    try {
      const res = await fetch(
        `/api/character-summary/${encodeURIComponent(key)}`,
        { signal: AbortSignal.timeout(CDN_FETCH_TIMEOUT_MS) },
      );
      if (res.status === 404) {
        cache.set(key, null);
        return null;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as CharacterIndex;
      cache.set(key, data);
      return data;
    } finally {
      pending.delete(key);
    }
  })();

  pending.set(key, req);
  return req;
}
