/**
 * Client fetch for character usage/top-team analytics.
 */

import type {
  CharacterAnalyticsMode,
  CharacterAnalyticsPayload,
} from "$lib/definitions";

export async function fetchCharacterAnalytics(
  nameId: string,
  mode: CharacterAnalyticsMode,
): Promise<CharacterAnalyticsPayload> {
  const params = new URLSearchParams({ nameId, mode });
  const res = await fetch(`/api/character-analytics?${params}`);
  if (!res.ok) {
    throw new Error(`character-analytics HTTP ${res.status}`);
  }
  return (await res.json()) as CharacterAnalyticsPayload;
}
