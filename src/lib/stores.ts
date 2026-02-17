import { writable, derived, type Writable } from "svelte/store";
import { db } from "$lib/supabaseClient";
import type {
  CharacterOwned,
  AbyssTeam,
  StygianTeam,
  Version,
} from "$lib/definitions";

//#region versions
export let latestAbyssVersion: Version;
export let latestStygianVersion: Version;

async function getLatestAbyssVersion() {
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
async function getLatestStygianVersion() {
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
  console.log(latestStygianVersion);
}

await getLatestAbyssVersion();
await getLatestStygianVersion();
//#endregion

//#region abyss
export const charactersOwned = writable<CharacterOwned[]>([]);
export const teamsOwned = writable<AbyssTeam[]>([]);
export const teamsOwnedTop = derived<Writable<AbyssTeam[]>, AbyssTeam[]>(
  teamsOwned,
  ($teamsOwned) => {
    return $teamsOwned.filter(
      (team) =>
        (team.usage_rate_top ?? 0) > 40 && (team.members ?? []).length == 4,
    );
  },
);
export const teamsOwnedBottom = derived<Writable<AbyssTeam[]>, AbyssTeam[]>(
  teamsOwned,
  ($teamsOwned) => {
    return $teamsOwned.filter(
      (team) =>
        (team.usage_rate_bottom ?? 0) > 40 && (team.members ?? []).length == 4,
    );
  },
);
export async function writeTopAbyssTeamsOwned(
  charactersOwned: CharacterOwned[],
) {
  const { data, error: err } = await db.rpc(
    "get_teams_with_characters_subset",
    {
      p_character_names: charactersOwned
        .filter((character) => character.isOwned)
        .map((character) => character.name),
      p_version_number: latestAbyssVersion.version_number,
    },
  );
  if (err) {
    return;
  } else {
    teamsOwned.set(data ?? []);
  }
}
//#endregion

//#region stygian
export const teamsOwnedStygian = writable<StygianTeam[]>([]);
export const teamsOwnedStygianTop = derived<
  Writable<StygianTeam[]>,
  StygianTeam[]
>(teamsOwnedStygian, ($teamsOwnedStygian) => {
  return $teamsOwnedStygian.filter(
    (team) =>
      (team.usage_rate_top ?? 0) > 40 && (team.members ?? []).length == 4,
  );
});
export const teamsOwnedStygianMiddle = derived<
  Writable<StygianTeam[]>,
  StygianTeam[]
>(teamsOwnedStygian, ($teamsOwnedStygian) => {
  return $teamsOwnedStygian.filter(
    (team) =>
      (team.usage_rate_middle ?? 0) > 40 && (team.members ?? []).length == 4,
  );
});
export const teamsOwnedStygianBottom = derived<
  Writable<StygianTeam[]>,
  StygianTeam[]
>(teamsOwnedStygian, ($teamsOwnedStygian) => {
  return $teamsOwnedStygian.filter(
    (team) =>
      (team.usage_rate_bottom ?? 0) > 40 && (team.members ?? []).length == 4,
  );
});
export async function writeTopStygianTeamsOwned(
  charactersOwned: CharacterOwned[],
) {
  const { data, error: err } = await db.rpc(
    "get_teams_with_characters_subset_stygian",
    {
      p_character_names: charactersOwned
        .filter((character) => character.isOwned)
        .map((character) => character.name),
      p_version_number: latestStygianVersion.version_number,
    },
  );
  if (err) {
    return;
  } else {
    teamsOwnedStygian.set(data ?? []);
  }
}
//#endregion
