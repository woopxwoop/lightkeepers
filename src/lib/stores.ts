import { writable, derived, type Writable } from "svelte/store";
import { db } from "$lib/supabaseClient";
import type {
  CharacterOwned,
  AbyssTeam,
  StygianTeam,
  Version,
} from "$lib/definitions";
import { computePullSuggestions } from "$lib/pullSuggestions";
import type { NearMissStygianTeam } from "$lib/pullSuggestions";
import { computePairSuggestions } from "$lib/pullSuggestions";
import type { NearMissPairTeam } from "$lib/pullSuggestions";

//#region versions
export let latestAbyssVersion: Version = {
  version: "getting latest version",
  version_number: -1,
};

export let latestStygianVersion: Version = {
  version: "getting latest version",
  version_number: -1,
};

export async function writeLatestAbyssVersion() {
  const { data, error: err } = await db
    .from("versions")
    .select("*")
    .order("version_number", { ascending: false })
    .limit(1);

  if (data) latestAbyssVersion = data[0];
  else
    latestAbyssVersion = {
      version: "unable to get latest version",
      version_number: -1,
    };
}

export async function writeLatestStygianVersion() {
  const { data, error: err } = await db
    .from("stygian_versions")
    .select("*")
    .order("version_number", { ascending: false })
    .limit(1);

  if (data) latestStygianVersion = data[0];
  else
    latestStygianVersion = {
      version: "unable to get latest version",
      version_number: -1,
    };
}
//#endregion

//#region abyss
export const charactersOwned = writable<CharacterOwned[]>([]);
export const teamsOwned = writable<AbyssTeam[]>([]);
export const teamsOwnedTop = derived<Writable<AbyssTeam[]>, AbyssTeam[]>(
  teamsOwned,
  ($teamsOwned) =>
    $teamsOwned.filter(
      (team) =>
        (team.usage_rate_top ?? 0) > 40 && (team.members ?? []).length == 4,
    ),
);
export const teamsOwnedBottom = derived<Writable<AbyssTeam[]>, AbyssTeam[]>(
  teamsOwned,
  ($teamsOwned) =>
    $teamsOwned.filter(
      (team) =>
        (team.usage_rate_bottom ?? 0) > 40 && (team.members ?? []).length == 4,
    ),
);

// Request ID counters — discard responses from superseded requests
let abyssRequestId = 0;
let stygianRequestId = 0;
let nearMissRequestId = 0;

export async function writeTopAbyssTeamsOwned(
  charactersOwned: CharacterOwned[],
) {
  const id = ++abyssRequestId;
  const { data, error: err } = await db.rpc(
    "get_teams_with_characters_subset",
    {
      p_character_names: charactersOwned
        .filter((c) => c.isOwned)
        .map((c) => c.name),
      p_version_number: latestAbyssVersion.version_number,
    },
  );
  if (err || id !== abyssRequestId) return;
  teamsOwned.set(data ?? []);
}
//#endregion

//#region stygian
export const teamsOwnedStygian = writable<StygianTeam[]>([]);
export const teamsOwnedStygianTop = derived<
  Writable<StygianTeam[]>,
  StygianTeam[]
>(teamsOwnedStygian, ($teamsOwnedStygian) =>
  $teamsOwnedStygian.filter(
    (team) =>
      (team.usage_rate_top ?? 0) > 40 && (team.members ?? []).length == 4,
  ),
);
export const teamsOwnedStygianMiddle = derived<
  Writable<StygianTeam[]>,
  StygianTeam[]
>(teamsOwnedStygian, ($teamsOwnedStygian) =>
  $teamsOwnedStygian.filter(
    (team) =>
      (team.usage_rate_middle ?? 0) > 40 && (team.members ?? []).length == 4,
  ),
);
export const teamsOwnedStygianBottom = derived<
  Writable<StygianTeam[]>,
  StygianTeam[]
>(teamsOwnedStygian, ($teamsOwnedStygian) =>
  $teamsOwnedStygian.filter(
    (team) =>
      (team.usage_rate_bottom ?? 0) > 40 && (team.members ?? []).length == 4,
  ),
);

export async function writeTopStygianTeamsOwned(
  charactersOwned: CharacterOwned[],
) {
  const id = ++stygianRequestId;
  const { data, error: err } = await db.rpc(
    "get_teams_with_characters_subset_stygian",
    {
      p_character_names: charactersOwned
        .filter((c) => c.isOwned)
        .map((c) => c.name),
      p_version_number: latestStygianVersion.version_number,
    },
  );
  if (err || id !== stygianRequestId) return;
  teamsOwnedStygian.set(data ?? []);
}

export const nearMissStygianTeams = writable<NearMissStygianTeam[]>([]);

export async function writeNearMissStygianTeams(
  charactersOwned: CharacterOwned[],
) {
  const id = ++nearMissRequestId;
  const { data, error: err } = await db.rpc("get_near_miss_stygian_teams", {
    p_character_names: charactersOwned
      .filter((c) => c.isOwned)
      .map((c) => c.name),
    p_version_number: latestStygianVersion.version_number,
  });
  if (err || id !== nearMissRequestId) return;
  nearMissStygianTeams.set(data ?? []);
}

export const stygianPullSuggestions = derived(
  [teamsOwnedStygian, nearMissStygianTeams],
  ([$teamsOwnedStygian, $nearMissStygianTeams]) =>
    computePullSuggestions($nearMissStygianTeams, $teamsOwnedStygian),
);

export const nearMissPairTeams = writable<NearMissPairTeam[]>([]);

export async function writeNearMissPairTeams(
  charactersOwned: CharacterOwned[],
) {
  const { data, error: err } = await db.rpc("get_near_miss_stygian_pairs", {
    p_character_names: charactersOwned
      .filter((c) => c.isOwned)
      .map((c) => c.name),
    p_version_number: latestStygianVersion.version_number,
  });
  if (err) {
    console.error("pair near-miss error:", err);
    return;
  }
  nearMissPairTeams.set(data ?? []);
}

export const stygianPairSuggestions = derived(
  nearMissPairTeams,
  ($nearMissPairTeams) => computePairSuggestions($nearMissPairTeams),
);
//#endregion
