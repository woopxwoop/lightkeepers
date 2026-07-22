import type { Page, Route } from "@playwright/test";

/** Abyss teams with no shared members — solver can fill both halves. */
export const ABYSS_TEAM_TOP = {
  team_key: "test-abyss-top",
  version_number: 1,
  members: ["Hutao", "Yelan", "Zhongli", "Albedo"],
  members_names: ["Hu Tao", "Yelan", "Zhongli", "Albedo"],
  usage_total: 45.5,
  usage_rate: 45.5,
  field_1_rate: 70,
  field_2_rate: 30,
  has_total: 1000,
};

export const ABYSS_TEAM_BOTTOM = {
  team_key: "test-abyss-bottom",
  version_number: 1,
  members: ["RaidenShogun", "Kazuha", "Bennett", "Xiangling"],
  members_names: ["Raiden Shogun", "Kazuha", "Bennett", "Xiangling"],
  usage_total: 38.2,
  usage_rate: 38.2,
  field_1_rate: 25,
  field_2_rate: 75,
  has_total: 1000,
};

/** Stygian teams covering three fields without member collisions. */
export const STYGIAN_TEAM_TOP = {
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
};

export const STYGIAN_TEAM_MIDDLE = {
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
};

export const STYGIAN_TEAM_BOTTOM = {
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
};

/** Owned Stygian team used as the weak baseline for pull improvement. */
export const STYGIAN_OWNED_BASELINE = {
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
};

/**
 * Near-miss: same 3 as baseline + missing Hutao at much higher usage →
 * computePullSuggestions yields improvement > 0.
 */
export const NEAR_MISS_SINGLE = {
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
};

export const emptyAbyssEnemies = {
  top: [],
  bottom: [],
  buffName: null,
  openTime: null,
};

export const emptyStygianEnemies = {
  top: null,
  middle: null,
  bottom: null,
};

type ApiMockOptions = {
  abyssTeams?: unknown[];
  stygianTeams?: unknown[];
  allTeamsAbyss?: unknown[];
  allTeamsStygian?: unknown[];
  nearMissTeams?: unknown[];
  nearMissPairs?: unknown[];
};

/**
 * Mocks the client APIs used after hydration. SSR `/api/static` on first
 * document request may still hit the real handler; client navigations and
 * `/api/teams` / `/api/nearmiss` are fully covered.
 */
export async function installApiMocks(
  page: Page,
  options: ApiMockOptions = {},
): Promise<void> {
  const abyssTeams = options.abyssTeams ?? [ABYSS_TEAM_TOP, ABYSS_TEAM_BOTTOM];
  const stygianTeams = options.stygianTeams ?? [
    STYGIAN_TEAM_TOP,
    STYGIAN_TEAM_MIDDLE,
    STYGIAN_TEAM_BOTTOM,
  ];
  const allTeamsAbyss = options.allTeamsAbyss ?? [
    ABYSS_TEAM_TOP,
    ABYSS_TEAM_BOTTOM,
  ];
  const allTeamsStygian = options.allTeamsStygian ?? [
    STYGIAN_TEAM_TOP,
    STYGIAN_TEAM_MIDDLE,
    STYGIAN_TEAM_BOTTOM,
  ];
  const nearMissTeams = options.nearMissTeams ?? [];
  const nearMissPairs = options.nearMissPairs ?? [];

  await page.route("**/api/roster", async (route: Route) => {
    await route.fulfill({ status: 401, body: "Unauthorized" });
  });

  await page.route("**/api/teams", async (route: Route) => {
    await route.fulfill({
      json: { abyssTeams, stygianTeams },
    });
  });

  await page.route("**/api/nearmiss", async (route: Route) => {
    await route.fulfill({
      json: { nearMissTeams, nearMissPairs },
    });
  });

  await page.route("**/api/static", async (route: Route) => {
    await route.fulfill({
      json: {
        allTeamsAbyss,
        allTeamsStygian,
        abyssEnemies: emptyAbyssEnemies,
        stygianEnemies: emptyStygianEnemies,
        stygianSchedule: null,
        latestAbyssVersion: {
          version_number: 1,
          version_name: "test",
          created_at: "",
        },
        latestStygianVersion: {
          version_number: 1,
          version_name: "test",
          created_at: "",
        },
      },
    });
  });
}

/** Collect matching request URLs (path only) for lazy-load assertions. */
export function trackApiPaths(page: Page, paths: string[]): string[] {
  const hits: string[] = [];
  page.on("request", (req) => {
    try {
      const pathname = new URL(req.url()).pathname;
      if (paths.some((p) => pathname === p || pathname.endsWith(p))) {
        hits.push(pathname);
      }
    } catch {
      /* ignore */
    }
  });
  return hits;
}
