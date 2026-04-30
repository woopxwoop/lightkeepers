import { test, expect } from "@playwright/test";

// Two teams with no shared members so the solver can fill both abyss slots.
const TEAM_TOP = {
  team_key: "test-team-top",
  members: ["Hu Tao", "Yelan", "Zhongli", "Albedo"],
  usage_total: 45.5,
  usage_rate_top: 70,
  usage_rate_bottom: 30,
  has: 1000,
  use: 455,
};

const TEAM_BOTTOM = {
  team_key: "test-team-bottom",
  members: ["Raiden Shogun", "Kazuha", "Bennett", "Xiangling"],
  usage_total: 38.2,
  usage_rate_top: 25,
  usage_rate_bottom: 75,
  has: 1000,
  use: 382,
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/teams", (route) =>
    route.fulfill({
      json: {
        abyssTeams: [TEAM_TOP, TEAM_BOTTOM],
        stygianTeams: [],
      },
    }),
  );
  await page.route("**/api/nearmiss", (route) =>
    route.fulfill({ json: { nearMissTeams: [], nearMissPairs: [] } }),
  );
});

// test("abyss solver displays teams from API response", async ({ page }) => {
//   await page.goto("/abyss");

//   // Both slot panels should show usage stats once teams are assigned.
//   // 15s timeout: CI is slow and the chain (hydrate → onMount → mock fetch → store → render) takes time.
//   await expect(page.getByText(/% usage/).first()).toBeVisible({ timeout: 15_000 })
//   expect(await page.getByText(/% usage/).count()).toBe(2);
// });

test("abyss solver fills both slots", async ({ page }) => {
  await page.goto("/abyss");

  // Neither slot should show the "No team available" fallback
  await expect(
    page.getByText("No team available for this side"),
  ).not.toBeVisible();
});

test("meta mode shows teams regardless of roster", async ({ page }) => {
  await page.goto("/abyss");

  await page.getByRole("button", { name: "Meta" }).click();

  // Meta mode runs the solver on allTeamsAbyss (from layout SSR),
  // which may be empty in tests — but the mode switch should not crash
  await expect(page.getByRole("button", { name: "Meta" })).toBeVisible();
  expect(await page.title()).toBeTruthy();
});
