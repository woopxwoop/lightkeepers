/**
 * Client fetch for character usage/top-team analytics.
 */

import type {
  CharacterAnalyticsMode,
  CharacterAnalyticsPayload,
} from "$lib/definitions";

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
  const res = await fetch(`/api/character-analytics?${params}`, { signal });
  if (!res.ok) {
    throw new Error(`character-analytics HTTP ${res.status}`);
  }
  return (await res.json()) as CharacterAnalyticsPayload;
}
