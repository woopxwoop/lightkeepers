/**
 * Client fetch for character usage/top-team analytics.
 */

import type {
  CharacterAnalyticsMode,
  CharacterAnalyticsPayload,
} from "$lib/definitions";

const FETCH_TIMEOUT_MS = 15_000;

export function isAbortError(err: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      err instanceof DOMException &&
      err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

export async function fetchCharacterAnalytics(
  nameId: string,
  mode: CharacterAnalyticsMode,
  signal?: AbortSignal,
): Promise<CharacterAnalyticsPayload> {
  const params = new URLSearchParams({ nameId, mode });
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const combined =
    signal !== undefined ? AbortSignal.any([signal, timeout]) : timeout;
  const res = await fetch(`/api/character-analytics?${params}`, {
    signal: combined,
  });
  if (!res.ok) {
    throw new Error(`character-analytics HTTP ${res.status}`);
  }
  return (await res.json()) as CharacterAnalyticsPayload;
}
