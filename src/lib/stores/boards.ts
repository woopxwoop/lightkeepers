/**
 * Static meta boards (all teams, enemies, Stygian schedule) and the versions
 * roster-keyed reads should use while a board is on screen.
 *
 * Heavy meta boards: ensureStaticBoards() → GET /api/static
 *
 * Abyss/Stygian solution pager helpers: `#lib/board-solutions.js`
 * (not this file). Solver: `#lib/solver.js`.
 */

import { writable, get } from "svelte/store";
import type {
  AbyssTeam,
  StygianTeam,
  AbyssEnemies,
  StygianEnemies,
  StygianSchedule,
} from "#lib/definitions.js";
import {
  abyssVersionNumber,
  stygianVersionNumber,
  staticBoardsAbyssVersion,
  staticBoardsStygianVersion,
  setStaticBoardsVersions,
  versionsForRosterRequest,
  writeVersionNumbers,
} from "#lib/stores/versions.js";
import {
  invalidateForRosterVersions,
  invalidateNearMissTeams,
  invalidateTeamsOwned,
  nearMissStatus,
  teamsOwnedStatus,
} from "#lib/stores/teams.js";

// ── All-teams stores (warmed from /api/static; not shipped in page __data.json) ─
export const allTeamsAbyss = writable<AbyssTeam[]>([]);
export const allTeamsStygian = writable<StygianTeam[]>([]);

const emptyAbyssEnemies: AbyssEnemies = {
  top: [],
  bottom: [],
  buffName: null,
  openTime: null,
};
const emptyStygianEnemies: StygianEnemies = {
  top: null,
  middle: null,
  bottom: null,
};

export const abyssEnemiesBoard = writable<AbyssEnemies>(emptyAbyssEnemies);
export const stygianEnemiesBoard =
  writable<StygianEnemies>(emptyStygianEnemies);
export const stygianScheduleBoard = writable<StygianSchedule>(null);

/**
 * Static-board fetch. `current` matches the layout versions. `stale` is a
 * previous cycle kept on screen while a backoff retry is scheduled. `error`
 * keeps any teams already applied (`retained`) and shows that same warning.
 */
export type StaticBoardsPhase =
  | { phase: "cold" }
  | { phase: "loading" }
  | { phase: "current" }
  | { phase: "stale" }
  | { phase: "error"; retained: boolean };

export type StaticBoardsView =
  | { kind: "loading" }
  | { kind: "empty-error" }
  | { kind: "board"; notice: "stale" | "retry" | null };

export const staticBoardsPhase = writable<StaticBoardsPhase>({ phase: "cold" });

/** What Abyss, Stygian, Summary, and character teams should render. */
export function staticBoardsView(phase: StaticBoardsPhase): StaticBoardsView {
  if (phase.phase === "cold" || phase.phase === "loading") {
    return { kind: "loading" };
  }
  if (phase.phase === "error" && !phase.retained) {
    return { kind: "empty-error" };
  }
  if (phase.phase === "stale" || phase.phase === "error") {
    return { kind: "board", notice: "stale" };
  }
  return { kind: "board", notice: null };
}

let staticBoardsInFlight: Promise<void> | null = null;
/** Bumped by reset so an older fetch cannot write boards or schedule a retry. */
let staticBoardsGeneration = 0;
/** A payload was applied, including an empty board. */
let staticBoardsApplied = false;
/** Don't hammer /api/static while CDN/L1 is still on the previous cycle. */
let staticBoardsRetryAfterMs = 0;
let staticBoardsRetryTimer: ReturnType<typeof setTimeout> | null = null;
let staticBoardsRetryAttempt = 0;
const STATIC_BOARDS_RETRY_BASE_MS = 30_000;
const STATIC_BOARDS_RETRY_MAX_MS = 5 * 60_000;

function staticBoardsMatchCurrentVersions(): boolean {
  return (
    get(staticBoardsPhase).phase === "current" &&
    staticBoardsAbyssVersion === abyssVersionNumber &&
    staticBoardsStygianVersion === stygianVersionNumber
  );
}

function staticBoardsRetained(): boolean {
  return staticBoardsApplied;
}

/** Drops board stores and a scheduled rollover retry. */
export function resetStaticBoards(): void {
  staticBoardsGeneration += 1;
  clearStaticBoardsRetry();
  staticBoardsInFlight = null;
  setStaticBoardsVersions(-1, -1);
  staticBoardsApplied = false;
  invalidateTeamsOwned();
  invalidateNearMissTeams();
  allTeamsAbyss.set([]);
  allTeamsStygian.set([]);
  abyssEnemiesBoard.set(emptyAbyssEnemies);
  stygianEnemiesBoard.set(emptyStygianEnemies);
  stygianScheduleBoard.set(null);
  staticBoardsPhase.set({ phase: "cold" });
}

function clearStaticBoardsRetry(): void {
  staticBoardsRetryAfterMs = 0;
  staticBoardsRetryAttempt = 0;
  if (staticBoardsRetryTimer != null) {
    clearTimeout(staticBoardsRetryTimer);
    staticBoardsRetryTimer = null;
  }
}

function scheduleStaticBoardsRetry(): void {
  if (staticBoardsRetryTimer != null) return;
  const base = Math.min(
    STATIC_BOARDS_RETRY_MAX_MS,
    STATIC_BOARDS_RETRY_BASE_MS * 2 ** staticBoardsRetryAttempt,
  );
  // Full jitter in [0, base] so clients don't retry in lockstep after a rollover.
  const delay = Math.floor(Math.random() * (base + 1));
  staticBoardsRetryAttempt += 1;
  staticBoardsRetryAfterMs = Date.now() + delay;
  staticBoardsRetryTimer = setTimeout(() => {
    staticBoardsRetryTimer = null;
    // Clear before invoke so a slightly-early timer isn't blocked by the gate.
    staticBoardsRetryAfterMs = 0;
    void ensureStaticBoards().catch(() => {});
  }, delay);
}

/**
 * Fetches the full meta team lists via /api/static and seeds the stores.
 * Kept out of abyss/stygian page loads so client navigations stay lean.
 * Coalesces concurrent callers; skips the network when boards already match
 * the current Abyss/Stygian version numbers.
 *
 * If CDN/L1 is still on the previous cycle after one cache-bust, seeds with
 * the payload's own version stamps (never pretends layout versions matched)
 * and retries on a backoff until current. While a retry is scheduled,
 * further callers return early until the backoff elapses — pass `{ force: true }`
 * (Retry UI) to clear backoff and fetch immediately.
 */
export async function ensureStaticBoards(opts?: {
  force?: boolean;
}): Promise<void> {
  if (opts?.force) {
    clearStaticBoardsRetry();
  } else if (get(staticBoardsPhase).phase === "error") {
    // A failed load stays failed until the user chooses Try again.
    return;
  }
  if (staticBoardsMatchCurrentVersions()) return;
  // Backoff after a stale/failed fetch — skip whether boards loaded or not.
  if (Date.now() < staticBoardsRetryAfterMs) return;
  if (staticBoardsInFlight) return staticBoardsInFlight;

  const phase = get(staticBoardsPhase);
  const keepBoards =
    phase.phase === "current" ||
    phase.phase === "stale" ||
    (phase.phase === "error" && phase.retained);
  const generation = staticBoardsGeneration;
  if (!keepBoards) staticBoardsPhase.set({ phase: "loading" });
  else if (phase.phase === "current") staticBoardsPhase.set({ phase: "stale" });

  const pending = (async () => {
    try {
      const data = await fetchStaticBoardsPayload(false);
      if (generation !== staticBoardsGeneration) return;
      if (applyStaticBoardsIfCurrent(data)) return;

      // Edge/CDN may still be serving the previous cycle — bust once.
      const fresh = await fetchStaticBoardsPayload(true);
      if (generation !== staticBoardsGeneration) return;
      if (applyStaticBoardsIfCurrent(fresh)) return;

      // Still behind — show last cycle with honest stamps; match stays false.
      const abyssVer = fresh.latestAbyssVersion?.version_number;
      const stygianVer = fresh.latestStygianVersion?.version_number;
      // Never replace retained boards with an older cycle of either mode.
      if (
        generation === staticBoardsGeneration &&
        typeof abyssVer === "number" &&
        typeof stygianVer === "number" &&
        abyssVer >= staticBoardsAbyssVersion &&
        stygianVer >= staticBoardsStygianVersion
      ) {
        applyStaticBoardsPayload(fresh, abyssVer, stygianVer);
        staticBoardsPhase.set({ phase: "stale" });
      }
      if (generation !== staticBoardsGeneration) return;
      scheduleStaticBoardsRetry();
    } catch (err) {
      if (generation !== staticBoardsGeneration) return;
      staticBoardsPhase.set({
        phase: "error",
        retained: staticBoardsRetained(),
      });
      throw err;
    }
  })();

  staticBoardsInFlight = pending;
  void pending
    .finally(() => {
      if (staticBoardsInFlight === pending) staticBoardsInFlight = null;
    })
    .catch(() => {});
  return pending;
}

type StaticBoardsPayload = {
  allTeamsAbyss?: AbyssTeam[];
  allTeamsStygian?: StygianTeam[];
  latestAbyssVersion?: { version_number?: number };
  latestStygianVersion?: { version_number?: number };
  abyssEnemies?: AbyssEnemies;
  stygianEnemies?: StygianEnemies;
  stygianSchedule?: StygianSchedule;
};

async function fetchStaticBoardsPayload(
  cacheBust: boolean,
): Promise<StaticBoardsPayload> {
  const url = cacheBust ? `/api/static?_=${Date.now()}` : "/api/static";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`static boards fetch failed: ${res.status}`);
  return (await res.json()) as StaticBoardsPayload;
}

/**
 * Apply boards only when the payload is not behind the *current* layout
 * version globals (re-read after each await). Returns false when versions
 * are present but stale so the caller can retry / reject.
 */
function applyStaticBoardsIfCurrent(data: StaticBoardsPayload): boolean {
  const currentAbyss = abyssVersionNumber;
  const currentStygian = stygianVersionNumber;
  const abyssVer = data.latestAbyssVersion?.version_number;
  const stygianVer = data.latestStygianVersion?.version_number;

  if (typeof abyssVer === "number" && typeof stygianVer === "number") {
    if (abyssVer < currentAbyss || stygianVer < currentStygian) {
      return false;
    }
    applyStaticBoardsPayload(data, abyssVer, stygianVer);
    staticBoardsPhase.set({ phase: "current" });
    return true;
  }

  // No version payload — keep whatever layout has now, still seed boards.
  applyStaticBoardsPayload(data, currentAbyss, currentStygian);
  staticBoardsPhase.set({ phase: "current" });
  return true;
}

/**
 * Versions for roster-keyed reads of the boards currently on screen.
 * While a stale cycle is retained, that cycle's versions — not the newer
 * layout numbers — are what `/api/teams`, `/api/nearmiss`, and cheap clears use.
 */
export function rosterBoardVersions(): { abyss: number; stygian: number } {
  return versionsForRosterRequest();
}

function applyStaticBoardsPayload(
  data: StaticBoardsPayload,
  abyssVer: number,
  stygianVer: number,
): void {
  const previous = versionsForRosterRequest();
  allTeamsAbyss.set(data.allTeamsAbyss ?? []);
  allTeamsStygian.set(data.allTeamsStygian ?? []);
  abyssEnemiesBoard.set(data.abyssEnemies ?? emptyAbyssEnemies);
  stygianEnemiesBoard.set(data.stygianEnemies ?? emptyStygianEnemies);
  stygianScheduleBoard.set(data.stygianSchedule ?? null);
  setStaticBoardsVersions(abyssVer, stygianVer);
  // Never move layout versions backwards if something else advanced them.
  setVersionNumbers(
    Math.max(abyssVer, abyssVersionNumber),
    Math.max(stygianVer, stygianVersionNumber),
  );
  const next = versionsForRosterRequest();
  if (previous.abyss !== next.abyss || previous.stygian !== next.stygian) {
    if (get(teamsOwnedStatus) !== "idle") invalidateTeamsOwned();
    if (get(nearMissStatus) !== "idle") invalidateNearMissTeams();
  }
  if (
    staticBoardsAbyssVersion === abyssVersionNumber &&
    staticBoardsStygianVersion === stygianVersionNumber
  ) {
    clearStaticBoardsRetry();
  }
  staticBoardsApplied = true;
}

/**
 * Layout version numbers changed (seed / layout data). Roster reads follow
 * the board on screen (`invalidateForRosterVersions`), and a layout bump marks
 * current boards stale and refetches in the browser. Same order and conditions
 * as the original single-module `setVersionNumbers`.
 */
export function setVersionNumbers(abyss: number, stygian: number): void {
  const previous = versionsForRosterRequest();
  writeVersionNumbers(abyss, stygian);
  invalidateForRosterVersions(previous, versionsForRosterRequest());
  if (
    staticBoardsAbyssVersion >= 0 &&
    staticBoardsStygianVersion >= 0 &&
    (staticBoardsAbyssVersion !== abyss ||
      staticBoardsStygianVersion !== stygian) &&
    get(staticBoardsPhase).phase === "current"
  ) {
    staticBoardsPhase.set({ phase: "stale" });
    if (typeof globalThis.window !== "undefined") {
      void ensureStaticBoards().catch(() => {});
    }
  }
}
