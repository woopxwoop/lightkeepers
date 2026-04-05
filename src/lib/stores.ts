/**
 * stores.ts
 *
 * All Supabase calls now go through SvelteKit API routes instead of
 * hitting Supabase directly from the browser. Benefits:
 *   - Server-side in-memory LRU cache cuts duplicate Supabase round-trips
 *   - Static data (all teams) is Cloudflare-edge-cached via /api/static
 *   - Per-user data (/api/teams, /api/nearmiss) is cached by character list
 *   - Service-role key stays server-side only
 */

import { writable, derived, type Writable } from "svelte/store";
import type { CharacterOwned, AbyssTeam, StygianTeam } from "$lib/definitions";
import type {
  NearMissStygianTeam,
  NearMissPairTeam,
} from "$lib/pullSuggestions";

// ── Version numbers ────────────────────────────────────────────────────────
// Populated from layout server data — no client-side fetch needed.
export let abyssVersionNumber = -1;
export let stygianVersionNumber = -1;

export function setVersionNumbers(abyss: number, stygian: number) {
  abyssVersionNumber = abyss;
  stygianVersionNumber = stygian;
}

// ── Character store ────────────────────────────────────────────────────────
export const charactersOwned = writable<CharacterOwned[]>([]);

// ── Abyss stores ──────────────────────────────────────────────────────────
export const teamsOwned = writable<AbyssTeam[]>([]);
export const teamsOwnedTop = derived<Writable<AbyssTeam[]>, AbyssTeam[]>(
  teamsOwned,
  ($teamsOwned) =>
    $teamsOwned.filter(
      (team) =>
        (team.usage_rate_top ?? 0) > 40 && (team.members ?? []).length === 4,
    ),
);
export const teamsOwnedBottom = derived<Writable<AbyssTeam[]>, AbyssTeam[]>(
  teamsOwned,
  ($teamsOwned) =>
    $teamsOwned.filter(
      (team) =>
        (team.usage_rate_bottom ?? 0) > 40 && (team.members ?? []).length === 4,
    ),
);

// ── Stygian stores ─────────────────────────────────────────────────────────
export const teamsOwnedStygian = writable<StygianTeam[]>([]);
export const teamsOwnedStygianTop = derived<
  Writable<StygianTeam[]>,
  StygianTeam[]
>(teamsOwnedStygian, ($t) =>
  $t.filter(
    (team) =>
      (team.usage_rate_top ?? 0) > 40 && (team.members ?? []).length === 4,
  ),
);
export const teamsOwnedStygianMiddle = derived<
  Writable<StygianTeam[]>,
  StygianTeam[]
>(teamsOwnedStygian, ($t) =>
  $t.filter(
    (team) =>
      (team.usage_rate_middle ?? 0) > 40 && (team.members ?? []).length === 4,
  ),
);
export const teamsOwnedStygianBottom = derived<
  Writable<StygianTeam[]>,
  StygianTeam[]
>(teamsOwnedStygian, ($t) =>
  $t.filter(
    (team) =>
      (team.usage_rate_bottom ?? 0) > 40 && (team.members ?? []).length === 4,
  ),
);

// ── All-teams stores (pre-populated from layout server data) ───────────────
export const allTeamsAbyss = writable<AbyssTeam[]>([]);
export const allTeamsStygian = writable<StygianTeam[]>([]);

// ── Near-miss stores ───────────────────────────────────────────────────────
export const nearMissStygianTeams = writable<NearMissStygianTeam[]>([]);
export const nearMissStygianLoaded = writable(false);
export const nearMissPairTeams = writable<NearMissPairTeam[]>([]);
export const nearMissPairLoaded = writable(false);

// ── Request ID counters ────────────────────────────────────────────────────
// Discard responses from superseded requests (fast roster changes).
let teamsRequestId = 0;
let nearMissRequestId = 0;

// ── API helpers ────────────────────────────────────────────────────────────

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Write functions ────────────────────────────────────────────────────────

/**
 * Fetches both abyss and stygian owned-team lists in a single server round-trip.
 * The server caches results by character list so rapid re-calls are cheap.
 */
export async function writeTeamsOwned(owned: CharacterOwned[]): Promise<void> {
  const id = ++teamsRequestId;
  const characters = owned.filter((c) => c.isOwned).map((c) => c.name);

  try {
    const { abyssTeams, stygianTeams } = await postJson<{
      abyssTeams: AbyssTeam[];
      stygianTeams: StygianTeam[];
    }>("/api/teams", {
      characters,
      abyssVersion: abyssVersionNumber,
      stygianVersion: stygianVersionNumber,
    });

    if (id !== teamsRequestId) return; // superseded
    teamsOwned.set(abyssTeams);
    teamsOwnedStygian.set(stygianTeams);
  } catch (err) {
    console.error("[stores] writeTeamsOwned failed:", err);
  }
}

/**
 * Fetches near-miss data for the Pulls page.
 * Combines single + pair into one server call.
 */
export async function writeNearMissTeams(
  owned: CharacterOwned[],
): Promise<void> {
  const id = ++nearMissRequestId;
  const characters = owned.filter((c) => c.isOwned).map((c) => c.name);

  nearMissStygianLoaded.set(false);
  nearMissPairLoaded.set(false);

  try {
    const { nearMissTeams, nearMissPairs } = await postJson<{
      nearMissTeams: NearMissStygianTeam[];
      nearMissPairs: NearMissPairTeam[];
    }>("/api/nearmiss", {
      characters,
      stygianVersion: stygianVersionNumber,
      minPmi: 0.3,
    });

    if (id !== nearMissRequestId) return; // superseded
    nearMissStygianTeams.set(nearMissTeams);
    nearMissPairTeams.set(nearMissPairs);
  } catch (err) {
    console.error("[stores] writeNearMissTeams failed:", err);
    nearMissStygianTeams.set([]);
    nearMissPairTeams.set([]);
  } finally {
    if (id === nearMissRequestId) {
      nearMissStygianLoaded.set(true);
      nearMissPairLoaded.set(true);
    }
  }
}

// ── Legacy shims ───────────────────────────────────────────────────────────
// Keep old function names so existing callers don't need updating immediately.

/** @deprecated Use writeTeamsOwned() instead */
export async function writeTopAbyssTeamsOwned(
  owned: CharacterOwned[],
): Promise<void> {
  return writeTeamsOwned(owned);
}

/** @deprecated Use writeTeamsOwned() instead */
export async function writeTopStygianTeamsOwned(
  owned: CharacterOwned[],
): Promise<void> {
  // Already triggered by writeTeamsOwned — no-op to avoid double calls.
}

/** @deprecated Use writeNearMissTeams() instead */
export async function writeNearMissStygianTeams(
  owned: CharacterOwned[],
): Promise<void> {
  return writeNearMissTeams(owned);
}

/** @deprecated Use writeNearMissTeams() instead */
export async function writeNearMissPairTeams(
  owned: CharacterOwned[],
): Promise<void> {
  // Already triggered by writeNearMissTeams — no-op to avoid double calls.
}
