/**
 * Client fetch for Stygian boss historical top teams.
 */

import type { StygianEnemyTeamsPayload } from "$lib/definitions";
import {
  isAbortError,
  isTimeoutError,
} from "$lib/app/character-analytics";

export { isAbortError, isTimeoutError };

const FETCH_TIMEOUT_MS = 15_000;

export async function fetchStygianEnemyTeams(
  enemyId: number,
  signal?: AbortSignal,
): Promise<StygianEnemyTeamsPayload> {
  const params = new URLSearchParams({ enemyId: String(enemyId) });
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const combined =
    signal !== undefined ? AbortSignal.any([signal, timeout]) : timeout;
  const res = await fetch(`/api/stygian-enemy-teams?${params}`, {
    signal: combined,
  });
  if (!res.ok) {
    throw new Error(`stygian-enemy-teams HTTP ${res.status}`);
  }
  return (await res.json()) as StygianEnemyTeamsPayload;
}
