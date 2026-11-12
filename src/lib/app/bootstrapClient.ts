/**
 * Client bootstrap after layout SSR.
 *
 * seedClientStores — sync, safe during SSR/hydration (versions + local roster).
 * bootstrapClient — onMount only: warm /api/static, sync /api/roster if logged in.
 * A later guest → signed-in transition calls syncCloudRoster from the layout.
 * The first settled user id does not: mount bootstrap already synced it.
 * Owned teams stay lazy (Abyss / Stygian / Pulls call ensureTeamsOwned).
 *
 * Roster sync on login:
 * - no cloud row → upload local, unless a direct account switch has no
 *   trusted owner for this roster (or it belongs to someone else)
 * - cloud differs from local → confirm use-cloud vs upload-local
 * - same → no-op
 */

import { get } from "svelte/store";
import type { Character, CharacterOwned } from "#lib/definitions.js";
import { authClient } from "#lib/auth-client.js";
import {
  charactersOwned,
  charactersHydrated,
  initHasSavedRoster,
  setHasSavedRoster,
  setVersionNumbers,
  invalidateTeamsOwned,
  invalidateNearMissTeams,
  ensureStaticBoards,
} from "#lib/stores.js";
import { isNewCharacter } from "#lib/is-new-character.js";
import { isBetaCharacter } from "#lib/is-beta-character.js";
import { parseRosterProgress } from "#lib/roster-progress.js";
import {
  postRoster,
  rostersDifferForSync,
  writeRosterLocal,
} from "#lib/roster-snapshot.js";
import { noteCloudRosterSynced } from "#lib/app/cloud-roster-probe.js";
import { promptRosterSyncConflict } from "#lib/app/roster-sync-conflict.js";

type LayoutHydration = {
  characters: Character[];
  abyssVersionNumber: number;
  stygianVersionNumber: number;
};

type CachedOwnedEntry = {
  name_id?: unknown;
  id?: unknown;
  isOwned?: unknown;
  progress?: unknown;
};

type CloudRosterFetch =
  | { status: "guest" }
  | { status: "error" }
  | { status: "missing"; userId: string }
  | { status: "ok"; userId: string; roster: CharacterOwned[] };

const ROSTER_FETCH_TIMEOUT_MS = 15_000;

/**
 * Reads and validates the cached roster from localStorage.
 *
 * Things that can go wrong (and how we handle them):
 * - localStorage unavailable (privacy mode / blocked / SecurityError): return undefined
 * - missing key: return undefined
 * - invalid JSON: return undefined
 * - schema drift (old shape, missing fields, different id types): ignore invalid entries
 * - partial/corrupted writes or manual edits: ignore invalid entries
 *
 * Fallback behavior: if anything is off, we default to "owned" for all characters
 * to preserve the pre-cache UX.
 */
function readOwnedCache(): CachedOwnedEntry[] | undefined {
  let cachedJSON: string | null = null;
  try {
    cachedJSON = localStorage.getItem("charactersOwned");
  } catch {
    return undefined;
  }

  if (!cachedJSON) return undefined;

  try {
    const parsed = JSON.parse(cachedJSON);
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter(
      (v): v is CachedOwnedEntry =>
        typeof v === "object" && v !== null && ("name_id" in v || "id" in v),
    );
  } catch {
    return undefined;
  }
}

function mergeOwnedFlags(
  characters: Character[],
  cachedOwned: CachedOwnedEntry[] | undefined,
): CharacterOwned[] {
  const defaultOwned = (c: Character): boolean => {
    // Recent releases and CB/unreleased rows default to not owned — the user
    // likely doesn't have them yet. Prevents auto-assigning owned for every
    // new/beta character that lands in the DB.
    if (isNewCharacter(c.released_at)) return false;
    if (isBetaCharacter(c.name_id, c.released_at)) return false;
    return true;
  };

  if (!cachedOwned) {
    return characters.map((c) => ({
      ...c,
      isOwned: defaultOwned(c),
      progress: null,
    }));
  }

  const normalized = cachedOwned.map((v) => ({
    name_id: "name_id" in v && v.name_id != null ? v.name_id : v.id,
    isOwned: v.isOwned,
    progress: parseRosterProgress(v.progress),
  }));

  return characters.map((c) => {
    const cached = normalized.find((x) => x.name_id === c.name_id);
    const isOwned =
      typeof cached?.isOwned === "boolean" ? cached.isOwned : defaultOwned(c);
    return {
      ...c,
      isOwned,
      progress: cached?.progress ?? null,
    };
  });
}

async function activeSessionUserId(): Promise<
  { status: "ok"; userId: string | null } | { status: "error" }
> {
  try {
    const { data: session } = await authClient.getSession();
    return { status: "ok", userId: session?.user?.id ?? null };
  } catch {
    return { status: "error" };
  }
}

async function fetchCloudRoster(
  characters: Character[],
): Promise<CloudRosterFetch> {
  try {
    const { data: session } = await authClient.getSession();
    const userId = session?.user?.id;
    if (!userId) return { status: "guest" };

    const res = await fetch("/api/roster", {
      signal: AbortSignal.timeout(ROSTER_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return { status: "error" };
    const body: unknown = await res.json();
    if (body === null || typeof body !== "object" || !("roster" in body)) {
      return { status: "error" };
    }
    const roster = (body as { roster: unknown }).roster;
    if (roster === null) return { status: "missing", userId };
    if (!Array.isArray(roster)) return { status: "error" };
    // `[]` is a stored roster. Uploading local over it skips the conflict prompt.
    return {
      status: "ok",
      userId,
      roster: mergeOwnedFlags(characters, roster),
    };
  } catch {
    return { status: "error" };
  }
}

function applyCloudRoster(roster: CharacterOwned[]): void {
  charactersOwned.set(roster);
  writeRosterLocal(JSON.stringify(roster));
  setHasSavedRoster();
  invalidateTeamsOwned();
  invalidateNearMissTeams();
}

async function uploadLocalRoster(
  roster: CharacterOwned[],
): Promise<
  | { ok: true; inventoryOmitted?: boolean }
  | { ok: false; status: number; message?: string }
> {
  try {
    const result = await postRoster(roster);
    if (!result.ok) {
      console.error("[roster sync] upload failed", {
        status: result.status,
        message: result.message,
      });
    }
    return result;
  } catch (err) {
    console.error("[roster sync] upload failed", err);
    return {
      ok: false,
      status: 0,
      message: "Network error — roster not saved",
    };
  }
}

function uploadFailureMessage(result: {
  status: number;
  message?: string;
}): string {
  return result.message
    ? `Upload failed (${result.status}): ${result.message}`
    : `Upload failed (${result.status}). Try again.`;
}

/**
 * Conflict popup → revalidate session → apply/upload.
 * Upload failures reopen the popup with an error so the user can retry.
 * `uploadRetry` is for missing-cloud upload failures (no “Use cloud” side).
 */
async function resolveRosterConflict(args: {
  userId: string;
  local: CharacterOwned[];
  cloud: CharacterOwned[];
  error?: string | null;
  uploadRetry?: boolean;
}): Promise<boolean> {
  let error: string | null = args.error ?? null;
  const uploadRetry = args.uploadRetry === true;

  for (;;) {
    const choice = await promptRosterSyncConflict(
      args.local,
      args.cloud,
      error,
      { uploadRetry },
    );

    // Dismiss needs no session revalidation — leave both sides unchanged.
    if (choice === "dismiss") return false;

    error = null;

    const session = await activeSessionUserId();
    if (session.status === "error") {
      error = "Could not verify signed-in account. Try again.";
      continue;
    }
    if (session.userId !== args.userId) {
      return false;
    }

    if (choice === "use-cloud") {
      if (uploadRetry) continue;
      applyCloudRoster(args.cloud);
      return true;
    }

    const result = await uploadLocalRoster(args.local);
    if (result.ok) return true;
    error = uploadFailureMessage(result);
  }
}

const ROSTER_OWNER_KEY = "rosterOwnerUserId";

function readRosterOwnerUserId(): string | null {
  try {
    const value = localStorage.getItem(ROSTER_OWNER_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Record the account whose roster was just stored on this device. */
export function rememberRosterOwner(userId: string): void {
  try {
    localStorage.setItem(ROSTER_OWNER_KEY, userId);
  } catch {
    /* the roster is still local; the next sync asks again */
  }
}

/**
 * Missing cloud row. Upload without asking when this device already stored
 * the roster for `sessionUserId`. A direct account switch with no owner, or
 * a roster stored for someone else, has to be confirmed first.
 */
export function missingCloudRosterNeedsConfirm(
  sessionUserId: string,
  directAccountSwitch: boolean,
): boolean {
  const owner = readRosterOwnerUserId();
  if (owner === sessionUserId) return false;
  if (owner !== null) return true;
  return directAccountSwitch;
}

/**
 * True when a settled session changes to a different signed-in user.
 * Includes guest → user and a direct user A → user B switch (no null in
 * between). The first settled id is a no-op so mount bootstrap is not
 * prompted twice. Logout does not sync.
 */
export function shouldSyncCloudRoster(
  previousUserId: string | null | undefined,
  nextUserId: string | null,
): boolean {
  if (previousUserId === undefined || nextUserId === null) return false;
  return previousUserId !== nextUserId;
}

/**
 * Client-side hydration from root layout SSR data.
 * Full allTeams* lists are warmed via ensureStaticBoards (not layout HTML).
 */
export function seedClientStores(data: LayoutHydration): void {
  setVersionNumbers(data.abyssVersionNumber, data.stygianVersionNumber);

  initHasSavedRoster();

  const cachedOwned = readOwnedCache();
  const localRoster = mergeOwnedFlags(data.characters, cachedOwned);
  charactersOwned.set(localRoster);
  charactersHydrated.set(true);
}

/**
 * Pull the signed-in cloud roster: upload when missing, prompt when it differs.
 * Guest and fetch errors leave the local roster alone.
 */
export async function syncCloudRoster(
  characters: Character[],
  opts?: { directAccountSwitch?: boolean },
): Promise<boolean> {
  const cloud = await fetchCloudRoster(characters);
  if (cloud.status === "guest" || cloud.status === "error") return false;

  const localRoster = get(charactersOwned);
  const confirmMissing = missingCloudRosterNeedsConfirm(
    cloud.userId,
    opts?.directAccountSwitch === true,
  );

  if (cloud.status === "missing") {
    if (confirmMissing) {
      const confirmed = await resolveRosterConflict({
        userId: cloud.userId,
        local: localRoster,
        cloud: [],
        uploadRetry: true,
      });
      if (confirmed) rememberRosterOwner(cloud.userId);
      return confirmed;
    }
    const result = await uploadLocalRoster(localRoster);
    if (result.ok) {
      rememberRosterOwner(cloud.userId);
      setHasSavedRoster();
      return true;
    }
    const confirmed = await resolveRosterConflict({
      userId: cloud.userId,
      local: localRoster,
      cloud: [],
      error: uploadFailureMessage(result),
      uploadRetry: true,
    });
    if (confirmed) rememberRosterOwner(cloud.userId);
    return confirmed;
  }

  if (!rostersDifferForSync(localRoster, cloud.roster)) {
    rememberRosterOwner(cloud.userId);
    return false;
  }

  const confirmed = await resolveRosterConflict({
    userId: cloud.userId,
    local: localRoster,
    cloud: cloud.roster,
  });
  if (confirmed) rememberRosterOwner(cloud.userId);
  return confirmed;
}

/**
 * Seeds layout stores, syncs DB roster if logged in.
 * Owned teams + near-miss load lazily on Abyss / Stygian / Pulls.
 * Meta team boards warm in the background so home → /tools/abyss|stygian nav is snappy.
 */
export async function bootstrapClient(data: LayoutHydration): Promise<void> {
  seedClientStores(data);

  // Fire early — do not await; home stays interactive while boards warm.
  // Failures land in staticBoardsPhase for Abyss/Stygian retry UI.
  // Investment JSON is loaded on Teams / character routes (not every visit).
  void ensureStaticBoards();

  if (await syncCloudRoster(data.characters)) noteCloudRosterSynced();
}
