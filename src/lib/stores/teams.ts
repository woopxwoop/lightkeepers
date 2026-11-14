/**
 * Roster-keyed team lists, fetched against the board versions on screen.
 *
 * The browser never talks to Supabase directly — everything goes through
 * `/api/*` so the service role key and caches stay on the server.
 *
 * Owned teams:       ensureTeamsOwned()  → POST /api/teams
 * Pull suggestions:  ensureNearMissTeams() → POST /api/nearmiss
 */

import { writable, get } from "svelte/store";
import type {
  CharacterOwned,
  AbyssTeam,
  StygianTeam,
} from "#lib/definitions.js";
import type {
  NearMissStygianTeam,
  NearMissPairTeam,
} from "#lib/pullSuggestions.js";
import { postJson } from "#lib/api/http.js";
import {
  assertVersionsSeeded,
  versionsForRosterRequest,
} from "#lib/stores/versions.js";
import { charactersOwned } from "#lib/stores/roster.js";

// ── Abyss stores ──────────────────────────────────────────────────────────
export const teamsOwned = writable<AbyssTeam[]>([]);

// ── Stygian stores ─────────────────────────────────────────────────────────
export const teamsOwnedStygian = writable<StygianTeam[]>([]);

/**
 * Owned-team fetch for `teamsOwnedRosterKey`.
 * `ready` is the only state whose lists match that key — including the
 * empty-roster short-circuit, whose key is `""`. `error` clears the lists
 * and does not match any roster, so the next ensure retries.
 */
export type RosterFetchStatus = "idle" | "loading" | "ready" | "error";

export const teamsOwnedStatus = writable<RosterFetchStatus>("idle");

// ── Near-miss stores ───────────────────────────────────────────────────────
export const nearMissStygianTeams = writable<NearMissStygianTeam[]>([]);
export const nearMissPairTeams = writable<NearMissPairTeam[]>([]);
/** Both near-miss lists move together. `ready` stays until invalidate. */
export const nearMissStatus = writable<RosterFetchStatus>("idle");

// ── Request ID counters ────────────────────────────────────────────────────
// Discard responses from superseded requests (fast roster changes).
let teamsRequestId = 0;
let nearMissRequestId = 0;
let teamsInFlight: Promise<void> | null = null;
/** Roster key of `teamsInFlight`, when a fetch is running. */
let teamsInFlightKey = "";
/**
 * Request key the current lists were fetched for: both board versions plus
 * the owned name_ids. Meaningful only while `teamsOwnedStatus` is `ready`.
 * The roster portion is `""` when the roster owns nobody.
 */
let teamsOwnedRosterKey = "";

/** Stable key for the owned slice. Order-independent. */
function ownedTeamsRosterKey(owned: CharacterOwned[]): string {
  return owned
    .filter((character) => character.isOwned)
    .map((character) => character.name_id)
    .sort()
    .join("\0");
}

/** Roster plus the board versions the lists were fetched against. */
function ownedTeamsRequestKey(owned: CharacterOwned[]): string {
  const versions = versionsForRosterRequest();
  return `${versions.abyss}:${versions.stygian}:${ownedTeamsRosterKey(owned)}`;
}

// ── Write functions ────────────────────────────────────────────────────────

/**
 * Clears owned-team stores so the next Abyss / Stygian / Pulls visit refetches.
 */
export function invalidateTeamsOwned(): void {
  teamsRequestId++;
  teamsInFlight = null;
  teamsInFlightKey = "";
  teamsOwnedRosterKey = "";
  teamsOwnedStatus.set("idle");
  teamsOwned.set([]);
  teamsOwnedStygian.set([]);
}

/**
 * Fetches both abyss and stygian owned-team lists in a single server round-trip.
 * The server caches results by character list so rapid re-calls are cheap.
 */
async function writeTeamsOwned(owned: CharacterOwned[]): Promise<void> {
  assertVersionsSeeded();
  const id = ++teamsRequestId;
  const characters = owned.filter((c) => c.isOwned).map((c) => c.name_id);
  const versions = versionsForRosterRequest();
  const requestKey = ownedTeamsRequestKey(owned);

  teamsOwnedStatus.set("loading");

  // Empty `p_name_ids` is the all-teams sentinel (/api/static). Posting it
  // here would store every meta team as "owned" and the solver would seat
  // characters this roster does not have.
  if (characters.length === 0) {
    if (id !== teamsRequestId) return;
    teamsOwned.set([]);
    teamsOwnedStygian.set([]);
    teamsOwnedRosterKey = requestKey;
    teamsOwnedStatus.set("ready");
    return;
  }

  try {
    const { abyssTeams, stygianTeams } = await postJson<{
      abyssTeams: AbyssTeam[];
      stygianTeams: StygianTeam[];
    }>("/api/teams", {
      characters,
      abyssVersion: versions.abyss,
      stygianVersion: versions.stygian,
    });

    if (id !== teamsRequestId) return; // superseded
    teamsOwned.set(abyssTeams);
    teamsOwnedStygian.set(stygianTeams);
    teamsOwnedRosterKey = requestKey;
    teamsOwnedStatus.set("ready");
  } catch (err) {
    console.error("[stores] writeTeamsOwned failed:", err);
    if (id !== teamsRequestId) return;
    teamsOwned.set([]);
    teamsOwnedStygian.set([]);
    teamsOwnedRosterKey = "";
    teamsOwnedStatus.set("error");
    throw err;
  }
}

/**
 * Load owned teams only when needed (Abyss / Stygian / Pulls).
 * No-ops if already loaded; coalesces concurrent callers.
 */
export async function ensureTeamsOwned(owned: CharacterOwned[]): Promise<void> {
  const requestKey = ownedTeamsRequestKey(owned);
  if (get(teamsOwnedStatus) === "ready" && teamsOwnedRosterKey === requestKey) {
    return;
  }
  if (teamsInFlight && teamsInFlightKey === requestKey) return teamsInFlight;
  // A fetch already running for a different roster is superseded inside
  // writeTeamsOwned (request id). Don't join that promise — its body is the
  // earlier roster, including the pre-seed empty list.
  const pending = writeTeamsOwned(owned);
  teamsInFlight = pending;
  teamsInFlightKey = requestKey;
  // Consume rejection on the finally-derived promise so cleanup cannot
  // surface as an unhandled rejection; callers still await `pending`.
  void pending
    .finally(() => {
      if (teamsInFlight === pending) {
        teamsInFlight = null;
        teamsInFlightKey = "";
      }
    })
    .catch(() => {});
  return pending;
}

/**
 * Clears near-miss stores so the next /tools/pulls visit refetches.
 * Call after roster changes instead of eagerly hitting /api/nearmiss.
 */
export function invalidateNearMissTeams(): void {
  nearMissRequestId++;
  nearMissInFlight = null;
  nearMissStatus.set("idle");
  nearMissStygianTeams.set([]);
  nearMissPairTeams.set([]);
}

/**
 * Fetches near-miss data for the Pulls page.
 * Combines single + pair into one server call.
 */
async function writeNearMissTeams(owned: CharacterOwned[]): Promise<void> {
  assertVersionsSeeded();
  const id = ++nearMissRequestId;
  const characters = owned.filter((c) => c.isOwned).map((c) => c.name_id);
  const versions = versionsForRosterRequest();

  nearMissStatus.set("loading");

  try {
    const { nearMissTeams, nearMissPairs } = await postJson<{
      nearMissTeams: NearMissStygianTeam[];
      nearMissPairs: NearMissPairTeam[];
    }>("/api/nearmiss", {
      characters,
      stygianVersion: versions.stygian,
      minPmi: 0.3,
    });

    if (id !== nearMissRequestId) return; // superseded
    nearMissStygianTeams.set(nearMissTeams);
    nearMissPairTeams.set(nearMissPairs);
    nearMissStatus.set("ready");
  } catch (err) {
    console.error("[stores] writeNearMissTeams failed:", err);
    if (id !== nearMissRequestId) return;
    nearMissStygianTeams.set([]);
    nearMissPairTeams.set([]);
    nearMissStatus.set("error");
    throw err;
  }
}

/**
 * Load near-miss only when needed (Pulls page). No-ops if already loaded;
 * coalesces concurrent callers onto one in-flight request.
 */
let nearMissInFlight: Promise<void> | null = null;

export async function ensureNearMissTeams(
  owned: CharacterOwned[],
): Promise<void> {
  if (get(nearMissStatus) === "ready") return;
  if (nearMissInFlight) return nearMissInFlight;
  const pending = writeNearMissTeams(owned);
  nearMissInFlight = pending;
  void pending
    .finally(() => {
      if (nearMissInFlight === pending) nearMissInFlight = null;
    })
    .catch(() => {});
  return pending;
}

/**
 * A roster write can land outside Abyss / Pulls. Drop ready lists so the
 * next ensure — which no-ops while status is `ready` — fetches the new roster.
 */
let rosterFetchIdentity = "";
charactersOwned.subscribe((owned) => {
  const next = ownedTeamsRosterKey(owned);
  if (next === rosterFetchIdentity) return;
  rosterFetchIdentity = next;
  // The identity check above leaves `error` in place for this roster.
  // A different roster leaves `error` so idle-only callers fetch it.
  if (get(teamsOwnedStatus) !== "idle") invalidateTeamsOwned();
  if (get(nearMissStatus) !== "idle") invalidateNearMissTeams();
});

/**
 * Roster reads follow the board on screen. A layout-only advance keeps the
 * applied cycle, so those results stay until that cycle actually changes.
 * Reset to idle even from `ready`: Pulls only ensures from idle.
 * Called by `setVersionNumbers()` (`#lib/stores/boards.js`).
 */
export function invalidateForRosterVersions(
  previous: { abyss: number; stygian: number },
  next: { abyss: number; stygian: number },
): void {
  if (previous.stygian >= 0 && next.stygian !== previous.stygian) {
    invalidateNearMissTeams();
  }
  if (
    previous.abyss >= 0 &&
    previous.stygian >= 0 &&
    (next.abyss !== previous.abyss || next.stygian !== previous.stygian) &&
    get(teamsOwnedStatus) !== "idle"
  ) {
    invalidateTeamsOwned();
  }
}
