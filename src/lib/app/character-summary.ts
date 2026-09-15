/**
 * Lazy client loaders for Builds summaries.
 *
 * Per-character: `/api/character-summary/[key]` (planner autofill, character page).
 * Account bulk: `/api/character-index` → aggregate `characters.json.gz`.
 *
 * `null` from per-key load = genuinely missing (HTTP 404). Transient failures throw.
 */
import { CDN_FETCH_TIMEOUT_MS } from "$lib/cdn-fetch";
import type {
  CharacterIndex,
  CharacterIndexFile,
} from "$lib/types/investment";

const cache = new Map<string, CharacterIndex | null>();
const pending = new Map<string, Promise<CharacterIndex | null>>();

let indexCached: CharacterIndexFile | null = null;
let indexPending: Promise<CharacterIndexFile> | null = null;

export function getCharacterSummaryCached(
  key: string,
): CharacterIndex | null | undefined {
  if (!cache.has(key)) return undefined;
  return cache.get(key) ?? null;
}

export function getCharacterIndexCached(): CharacterIndexFile | null {
  return indexCached;
}

/** Seed the per-key map from an aggregate index (skips later one-off fetches). */
export function seedCharacterSummariesFromIndex(
  file: CharacterIndexFile,
): void {
  for (const [key, summary] of Object.entries(file.characters ?? {})) {
    if (!key) continue;
    cache.set(key, summary);
  }
}

/**
 * One request for every Builds summary. Prefer this for account-wide grading.
 */
export function loadCharacterIndex(): Promise<CharacterIndexFile> {
  if (indexCached) return Promise.resolve(indexCached);
  if (indexPending) return indexPending;

  indexPending = (async () => {
    const res = await fetch("/api/character-index", {
      signal: AbortSignal.timeout(CDN_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as CharacterIndexFile;
    indexCached = data;
    seedCharacterSummariesFromIndex(data);
    return data;
  })().finally(() => {
    indexPending = null;
  });

  return indexPending;
}

/** Lookup in a loaded index; missing key → null (not an error). */
export function characterSummaryFromIndex(
  file: CharacterIndexFile | null | undefined,
  key: string,
): CharacterIndex | null {
  if (!file || !key) return null;
  return file.characters[key] ?? null;
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
