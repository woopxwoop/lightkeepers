import { X as writable, Z as derived } from './index-BWYQ_Nod.js';
import { createClient } from '@supabase/supabase-js';

const PUBLIC_SUPABASE_KEY = "sb_publishable_hDHBlsqOx1Dv3ltcSGZr0g_Lhq6UJYu";
const PUBLIC_SUPABASE_URL = "https://ysjscplavjuixuvsdile.supabase.co";
const db = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_KEY);
let latestAbyssVersion = {
  version_number: -1
};
let latestStygianVersion = {
  version_number: -1
};
async function writeLatestAbyssVersion() {
  const { data, error: err } = await db.from("versions").select("*").order("version_number", { ascending: false }).limit(1);
  if (data) latestAbyssVersion = data[0];
  else
    latestAbyssVersion = {
      version: "unable to get latest version",
      version_number: -1
    };
}
async function writeLatestStygianVersion() {
  const { data, error: err } = await db.from("stygian_versions").select("*").order("version_number", { ascending: false }).limit(1);
  if (data) latestStygianVersion = data[0];
  else
    latestStygianVersion = {
      version: "unable to get latest version",
      version_number: -1
    };
}
const charactersOwned = writable([]);
const teamsOwned = writable([]);
derived(
  teamsOwned,
  ($teamsOwned) => $teamsOwned.filter(
    (team) => (team.usage_rate_top ?? 0) > 40 && (team.members ?? []).length == 4
  )
);
derived(
  teamsOwned,
  ($teamsOwned) => $teamsOwned.filter(
    (team) => (team.usage_rate_bottom ?? 0) > 40 && (team.members ?? []).length == 4
  )
);
const teamsOwnedStygian = writable([]);
derived(
  teamsOwnedStygian,
  ($teamsOwnedStygian) => $teamsOwnedStygian.filter(
    (team) => (team.usage_rate_top ?? 0) > 40 && (team.members ?? []).length == 4
  )
);
derived(
  teamsOwnedStygian,
  ($teamsOwnedStygian) => $teamsOwnedStygian.filter(
    (team) => (team.usage_rate_middle ?? 0) > 40 && (team.members ?? []).length == 4
  )
);
derived(
  teamsOwnedStygian,
  ($teamsOwnedStygian) => $teamsOwnedStygian.filter(
    (team) => (team.usage_rate_bottom ?? 0) > 40 && (team.members ?? []).length == 4
  )
);
const nearMissStygianLoaded = writable(false);
const nearMissPairLoaded = writable(false);
const allTeamsAbyss = writable([]);
const allTeamsStygian = writable([]);
async function writeAllAbyssTeams() {
  const { data, error } = await db.rpc("get_teams_with_characters_subset", {
    p_character_names: [],
    p_version_number: latestAbyssVersion.version_number
  });
  if (error) return;
  allTeamsAbyss.set(data ?? []);
}
async function writeAllStygianTeams() {
  const { data, error } = await db.rpc(
    "get_teams_with_characters_subset_stygian",
    {
      p_character_names: [],
      p_version_number: latestStygianVersion.version_number
    }
  );
  if (error) return;
  allTeamsStygian.set(data ?? []);
}

export { writeLatestStygianVersion as a, writeAllStygianTeams as b, writeAllAbyssTeams as c, db as d, charactersOwned as e, allTeamsAbyss as f, allTeamsStygian as g, teamsOwnedStygian as h, nearMissPairLoaded as i, nearMissStygianLoaded as n, teamsOwned as t, writeLatestAbyssVersion as w };
//# sourceMappingURL=stores-CzW-3W-X.js.map
