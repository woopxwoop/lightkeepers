import type { Page, Route } from "@playwright/test";
import type {
  AbyssTeam,
  NearMissStygianPair,
  NearMissStygianTeam,
  StygianTeam,
} from "../src/lib/definitions";
import type { TierListPayload } from "../src/lib/tierlist";
import {
  E2E_ABYSS_TEAM_BOTTOM,
  E2E_ABYSS_TEAM_TOP,
  E2E_EMPTY_ABYSS_ENEMIES,
  E2E_EMPTY_STYGIAN_ENEMIES,
  E2E_NEAR_MISS_SINGLE,
  E2E_STYGIAN_ENEMIES,
  E2E_STYGIAN_OWNED_BASELINE,
  E2E_STYGIAN_TEAM_BOTTOM,
  E2E_STYGIAN_TEAM_MIDDLE,
  E2E_STYGIAN_TEAM_TOP,
  e2eStaticPayload,
  e2eTierListPayload,
} from "../src/lib/e2e/fixtures";

/** Abyss teams with no shared members — solver can fill both halves. */
export const ABYSS_TEAM_TOP = E2E_ABYSS_TEAM_TOP;
export const ABYSS_TEAM_BOTTOM = E2E_ABYSS_TEAM_BOTTOM;

/** Stygian teams covering three fields without member collisions. */
export const STYGIAN_TEAM_TOP = E2E_STYGIAN_TEAM_TOP;
export const STYGIAN_TEAM_MIDDLE = E2E_STYGIAN_TEAM_MIDDLE;
export const STYGIAN_TEAM_BOTTOM = E2E_STYGIAN_TEAM_BOTTOM;

/** Owned Stygian team for /api/teams mocks on the Pulls page. */
export const STYGIAN_OWNED_BASELINE = E2E_STYGIAN_OWNED_BASELINE;

/**
 * Near-miss: Hu Tao missing from a high-usage team the roster almost fields.
 * avg_usage_rate clears MIN_PULL_TEAM_USAGE (10).
 */
export const NEAR_MISS_SINGLE = E2E_NEAR_MISS_SINGLE;

export const emptyAbyssEnemies = E2E_EMPTY_ABYSS_ENEMIES;
export const emptyStygianEnemies = E2E_EMPTY_STYGIAN_ENEMIES;
export const stygianEnemies = E2E_STYGIAN_ENEMIES;

type ApiMockOptions = {
  abyssTeams?: AbyssTeam[];
  stygianTeams?: StygianTeam[];
  allTeamsAbyss?: AbyssTeam[];
  allTeamsStygian?: StygianTeam[];
  nearMissTeams?: NearMissStygianTeam[];
  nearMissPairs?: NearMissStygianPair[];
  tierList?: TierListPayload;
};

/**
 * Mocks browser-side APIs after hydration.
 * SSR `/api/static` and layout characters are served from e2e fixtures when
 * the Playwright webServer sets PLAYWRIGHT_E2E=1 (see playwright.config.ts).
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
  const tierList = options.tierList ?? e2eTierListPayload();

  await page.route("**/api/roster", async (route: Route) => {
    await route.fulfill({ status: 401, body: "Unauthorized" });
  });

  await page.route("**/api/teams", async (route: Route) => {
    if (process.env.PLAYWRIGHT_DEBUG_NET === "1" || process.env.CI) {
      // eslint-disable-next-line no-console
      console.log("[mock] /api/teams intercepted", route.request().method());
    }
    await route.fulfill({
      json: { abyssTeams, stygianTeams },
    });
  });

  await page.route("**/api/nearmiss", async (route: Route) => {
    if (process.env.PLAYWRIGHT_DEBUG_NET === "1" || process.env.CI) {
      // eslint-disable-next-line no-console
      console.log("[mock] /api/nearmiss intercepted", route.request().method());
    }
    await route.fulfill({
      json: { nearMissTeams, nearMissPairs },
    });
  });

  await page.route("**/api/tierlist", async (route: Route) => {
    await route.fulfill({ json: tierList });
  });

  // Hybrid waits on this; empty rows still seats via usage × affinity.
  await page.route("**/api/stygian-cheap-clears", async (route: Route) => {
    await route.fulfill({ json: { rows: [] } });
  });

  await page.route("**/api/stygian-clear-videos", async (route: Route) => {
    await route.fulfill({ json: { clears: [] } });
  });

  const staticBase = e2eStaticPayload();
  await page.route("**/api/static", async (route: Route) => {
    await route.fulfill({
      json: {
        ...staticBase,
        allTeamsAbyss,
        allTeamsStygian,
        abyssEnemies: emptyAbyssEnemies,
        // Hybrid (default) needs boss ids; empty board never seats.
        stygianEnemies,
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
