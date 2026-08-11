/**
 * Lazy client loader for per-character Builds summaries (planner autofill).
 * Goes through `/api/character-summary/[key]` — CDN has no browser CORS.
 */
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
      );
      if (res.status === 404) {
        cache.set(key, null);
        return null;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as CharacterIndex;
      cache.set(key, data);
      return data;
    } catch {
      // Don't poison cache on transient errors — allow retry.
      return null;
    } finally {
      pending.delete(key);
    }
  })();

  pending.set(key, req);
  return req;
}
