/**
 * Deterministic payloads for Playwright E2E (PLAYWRIGHT_E2E=1).
 * Used by SSR (/api/static, layout characters) and client API mocks.
 */

import type {
  AbyssEnemies,
  AbyssTeam,
  AbyssVersion,
  Character,
  NearMissStygianPair,
  NearMissStygianTeam,
  StygianEnemies,
  StygianSchedule,
  StygianTeam,
  StygianVersion,
} from "$lib/definitions";

export const E2E_ABYSS_TEAM_TOP = {
  team_key: "test-abyss-top",
  version_number: 1,
  members: ["Hutao", "Yelan", "Zhongli", "Albedo"],
  members_names: ["Hu Tao", "Yelan", "Zhongli", "Albedo"],
  usage_total: 45.5,
  usage_rate: 45.5,
  field_1_rate: 70,
  field_2_rate: 30,
  has_total: 1000,
} satisfies AbyssTeam;

export const E2E_ABYSS_TEAM_BOTTOM = {
  team_key: "test-abyss-bottom",
  version_number: 1,
  members: ["RaidenShogun", "Kazuha", "Bennett", "Xiangling"],
  members_names: ["Raiden Shogun", "Kazuha", "Bennett", "Xiangling"],
  usage_total: 38.2,
  usage_rate: 38.2,
  field_1_rate: 25,
  field_2_rate: 75,
  has_total: 1000,
} satisfies AbyssTeam;

export const E2E_STYGIAN_TEAM_TOP = {
  team_key: "test-stygian-top",
  version_number: 1,
  members: ["Hutao", "Yelan", "Zhongli", "Albedo"],
  members_names: ["Hu Tao", "Yelan", "Zhongli", "Albedo"],
  usage_total: 40,
  usage_rate: 40,
  avg_usage_rate: 40,
  field_1_rate: 80,
  field_2_rate: 10,
  field_3_rate: 10,
  has_total: 1000,
} satisfies StygianTeam;

export const E2E_STYGIAN_TEAM_MIDDLE = {
  team_key: "test-stygian-middle",
  version_number: 1,
  members: ["RaidenShogun", "Kazuha", "Bennett", "Xiangling"],
  members_names: ["Raiden Shogun", "Kazuha", "Bennett", "Xiangling"],
  usage_total: 35,
  usage_rate: 35,
  avg_usage_rate: 35,
  field_1_rate: 10,
  field_2_rate: 10,
  field_3_rate: 80,
  has_total: 1000,
} satisfies StygianTeam;

export const E2E_STYGIAN_TEAM_BOTTOM = {
  team_key: "test-stygian-bottom",
  version_number: 1,
  members: ["Neuvillette", "Furina", "Xingqiu", "Nahida"],
  members_names: ["Neuvillette", "Furina", "Xingqiu", "Nahida"],
  usage_total: 30,
  usage_rate: 30,
  avg_usage_rate: 30,
  field_1_rate: 10,
  field_2_rate: 80,
  field_3_rate: 10,
  has_total: 1000,
} satisfies StygianTeam;

export const E2E_STYGIAN_OWNED_BASELINE = {
  team_key: "test-stygian-owned-baseline",
  version_number: 1,
  members: ["Yelan", "Zhongli", "Albedo", "Bennett"],
  members_names: ["Yelan", "Zhongli", "Albedo", "Bennett"],
  usage_total: 12,
  usage_rate: 12,
  avg_usage_rate: 12,
  field_1_rate: 50,
  field_2_rate: 25,
  field_3_rate: 25,
  has_total: 500,
} satisfies StygianTeam;

export const E2E_NEAR_MISS_SINGLE = {
  team_key: "test-near-miss-hutao",
  members: ["Hutao", "Yelan", "Zhongli", "Albedo"],
  members_names: ["Hu Tao", "Yelan", "Zhongli", "Albedo"],
  missing_character: "Hutao",
  missing_character_name: "Hu Tao",
  avg_usage_rate: 42,
  usage_rate: 42,
  usage_total: 42,
  field_1_rate: 70,
  field_2_rate: 15,
  field_3_rate: 15,
} satisfies NearMissStygianTeam;

export const E2E_EMPTY_ABYSS_ENEMIES: AbyssEnemies = {
  top: [],
  bottom: [],
  buffName: null,
  openTime: null,
};

export const E2E_EMPTY_STYGIAN_ENEMIES: StygianEnemies = {
  top: null,
  middle: null,
  bottom: null,
};

const E2E_ABYSS_VERSION: AbyssVersion = {
  version_number: 1,
  version_name: "test",
  created_at: "",
};

const E2E_STYGIAN_VERSION: StygianVersion = {
  version_number: 1,
  version_name: "test",
  created_at: "",
};

const E2E_CHAR_IDS = [
  ["Hutao", "Hu Tao", "Pyro", "Polearm"],
  ["Yelan", "Yelan", "Hydro", "Bow"],
  ["Zhongli", "Zhongli", "Geo", "Polearm"],
  ["Albedo", "Albedo", "Geo", "Sword"],
  ["RaidenShogun", "Raiden Shogun", "Electro", "Polearm"],
  ["Kazuha", "Kazuha", "Anemo", "Sword"],
  ["Bennett", "Bennett", "Pyro", "Sword"],
  ["Xiangling", "Xiangling", "Pyro", "Polearm"],
  ["Neuvillette", "Neuvillette", "Hydro", "Catalyst"],
  ["Furina", "Furina", "Hydro", "Sword"],
  ["Xingqiu", "Xingqiu", "Hydro", "Sword"],
  ["Nahida", "Nahida", "Dendro", "Catalyst"],
] as const;

function e2eCharacter(
  name_id: string,
  name: string,
  element: string,
  weapon_type: string,
  game_id: number,
): Character {
  return {
    name_id,
    name,
    element,
    weapon_type,
    game_id,
    rarity: 5,
    released_at: "2020-01-01T00:00:00Z",
    created_at: "",
  };
}

/** Roster used by SSR layout when PLAYWRIGHT_E2E is set. */
export function e2eCharacters(): Character[] {
  return E2E_CHAR_IDS.map(([name_id, name, element, weapon_type], i) =>
    e2eCharacter(name_id, name, element, weapon_type, i + 1),
  );
}

export type E2eStaticPayload = {
  latestAbyssVersion: AbyssVersion;
  latestStygianVersion: StygianVersion;
  allTeamsAbyss: AbyssTeam[];
  allTeamsStygian: StygianTeam[];
  stygianEnemies: StygianEnemies;
  abyssEnemies: AbyssEnemies;
  stygianSchedule: StygianSchedule;
};

/** Full /api/static body for Playwright SSR (no Supabase). */
export function e2eStaticPayload(): E2eStaticPayload {
  return {
    latestAbyssVersion: E2E_ABYSS_VERSION,
    latestStygianVersion: E2E_STYGIAN_VERSION,
    allTeamsAbyss: [E2E_ABYSS_TEAM_TOP, E2E_ABYSS_TEAM_BOTTOM],
    allTeamsStygian: [
      E2E_STYGIAN_TEAM_TOP,
      E2E_STYGIAN_TEAM_MIDDLE,
      E2E_STYGIAN_TEAM_BOTTOM,
    ],
    stygianEnemies: E2E_EMPTY_STYGIAN_ENEMIES,
    abyssEnemies: E2E_EMPTY_ABYSS_ENEMIES,
    stygianSchedule: null,
  };
}

/** Empty near-miss pair list typed for API mocks. */
export const E2E_NEAR_MISS_PAIRS: NearMissStygianPair[] = [];
