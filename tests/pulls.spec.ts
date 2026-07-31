import { test, expect } from "@playwright/test";
import {
  installApiMocks,
  NEAR_MISS_SINGLE,
  STYGIAN_OWNED_BASELINE,
} from "./helpers";
import { attachBrowserDebug } from "./debug";

const CLIENT_API_TIMEOUT = 45_000;

test("pulls ranks a mocked near-miss suggestion", async ({ page }) => {
  attachBrowserDebug(page);
  const alternateHuTaoTeam = {
    ...NEAR_MISS_SINGLE,
    team_key: "test-near-miss-hutao-alternate",
    members: ["Hutao", "Xingqiu", "Kazuha", "Bennett"],
    members_names: ["Hu Tao", "Xingqiu", "Kazuha", "Bennett"],
    avg_usage_rate: 24,
    usage_rate: 24,
    usage_total: 24,
  };
  await installApiMocks(page, {
    stygianTeams: [STYGIAN_OWNED_BASELINE],
    nearMissTeams: [NEAR_MISS_SINGLE, alternateHuTaoTeam],
  });

  const nearmiss = page.waitForRequest(
    (req) => new URL(req.url()).pathname.endsWith("/api/nearmiss"),
    { timeout: CLIENT_API_TIMEOUT },
  );
  const tierlist = page.waitForRequest(
    (req) => new URL(req.url()).pathname.endsWith("/api/tierlist"),
    { timeout: CLIENT_API_TIMEOUT },
  );

  await page.goto("/pulls");
  await Promise.all([nearmiss, tierlist]);

  await expect(
    page.getByRole("heading", { name: "Pull Suggestions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Most used characters in Stygian" }),
  ).toBeVisible({ timeout: CLIENT_API_TIMEOUT });

  const bestNext = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Best next pulls" }) });

  await expect(bestNext).toBeVisible({ timeout: CLIENT_API_TIMEOUT });
  await expect(bestNext.getByRole("link", { name: "Hu Tao" })).toBeVisible();

  // A lone suggestion starts hidden: pull target plus three blank slots.
  await expect(
    bestNext.getByRole("button", { name: "Reveal team" }),
  ).toBeVisible();
  await expect(
    bestNext.getByRole("img", { name: "Unrevealed teammate" }),
  ).toHaveCount(3);
  await expect(bestNext.getByRole("link", { name: "Yelan" })).toHaveCount(0);

  // Revealing fills the blanks with the unlocked team.
  await bestNext.getByRole("button", { name: "Reveal team" }).click();
  await expect(bestNext.getByText(/42\.0%\s*usage/i)).toBeVisible();
  await expect(bestNext.getByRole("link", { name: "Yelan" })).toBeVisible();
  await expect(bestNext.getByRole("link", { name: "Zhongli" })).toBeVisible();
  await expect(bestNext.getByRole("link", { name: "Albedo" })).toBeVisible();
  await expect(
    bestNext.getByRole("img", { name: "Unrevealed teammate" }),
  ).toHaveCount(0);

  // Vertical pager cycles teams in place and exposes both directions.
  await expect(
    bestNext.getByRole("button", { name: "Previous unlocked team" }),
  ).toBeVisible();
  await bestNext.getByRole("button", { name: "Next unlocked team" }).click();
  await expect(bestNext.getByText(/24\.0%\s*usage/i)).toBeVisible();
  await expect(bestNext.getByRole("link", { name: "Xingqiu" })).toBeVisible();
  await expect(bestNext.getByRole("link", { name: "Yelan" })).toHaveCount(0);

  // Hiding restores blank teammate slots and keeps the pull target.
  await bestNext.getByRole("button", { name: "Hide team" }).click();
  await expect(bestNext.getByRole("link", { name: "Yelan" })).toHaveCount(0);
  await expect(bestNext.getByRole("link", { name: "Hu Tao" })).toBeVisible();
  await expect(
    bestNext.getByRole("img", { name: "Unrevealed teammate" }),
  ).toHaveCount(3);
});

test("pulls reveals suggestion rows independently", async ({ page }) => {
  attachBrowserDebug(page);
  // Second cream near-miss so the column renders two rows.
  const nearMissFurina = {
    ...NEAR_MISS_SINGLE,
    team_key: "test-near-miss-furina",
    members: ["Furina", "Neuvillette", "Kazuha", "Bennett"],
    members_names: ["Furina", "Neuvillette", "Kazuha", "Bennett"],
    missing_character: "Furina",
    missing_character_name: "Furina",
    avg_usage_rate: 30,
    usage_rate: 30,
    usage_total: 30,
  };
  await installApiMocks(page, {
    stygianTeams: [STYGIAN_OWNED_BASELINE],
    nearMissTeams: [NEAR_MISS_SINGLE, nearMissFurina],
  });

  const nearmiss = page.waitForRequest(
    (req) => new URL(req.url()).pathname.endsWith("/api/nearmiss"),
    { timeout: CLIENT_API_TIMEOUT },
  );

  await page.goto("/pulls");
  await nearmiss;

  const bestNext = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Best next pulls" }) });
  await expect(bestNext).toBeVisible({ timeout: CLIENT_API_TIMEOUT });

  // Every row starts hidden; each can still be revealed independently.
  await expect(bestNext.getByRole("button", { name: "Hide team" })).toHaveCount(
    0,
  );
  await expect(
    bestNext.getByRole("button", { name: "Reveal team" }),
  ).toHaveCount(2);

  await bestNext.getByRole("button", { name: "Reveal team" }).first().click();
  await expect(bestNext.getByRole("button", { name: "Hide team" })).toHaveCount(
    1,
  );
  await expect(
    bestNext.getByRole("button", { name: "Reveal team" }),
  ).toHaveCount(1);

  await bestNext.getByRole("button", { name: "Reveal team" }).click();
  await expect(bestNext.getByRole("button", { name: "Hide team" })).toHaveCount(
    2,
  );
  await expect(
    bestNext.getByRole("button", { name: "Reveal team" }),
  ).toHaveCount(0);
});

test("pulls shows stygian standouts without a roster", async ({ page }) => {
  attachBrowserDebug(page);
  await installApiMocks(page);

  // Empty array is treated as "no cache" fallback to all-owned — mark each
  // e2e character unowned explicitly so suggestions stay empty.
  await page.addInitScript(() => {
    const ids = [
      "Hutao",
      "Yelan",
      "Zhongli",
      "Albedo",
      "RaidenShogun",
      "Kazuha",
      "Bennett",
      "Xiangling",
      "Neuvillette",
      "Furina",
      "Xingqiu",
      "Nahida",
    ];
    localStorage.setItem(
      "charactersOwned",
      JSON.stringify(ids.map((name_id) => ({ name_id, isOwned: false }))),
    );
  });

  const tierlist = page.waitForRequest(
    (req) => new URL(req.url()).pathname.endsWith("/api/tierlist"),
    { timeout: CLIENT_API_TIMEOUT },
  );

  await page.goto("/pulls");
  await tierlist;

  await expect(
    page.getByRole("heading", { name: "Most used characters in Stygian" }),
  ).toBeVisible({ timeout: CLIENT_API_TIMEOUT });
  await expect(page.getByText("Most used limited characters")).toBeVisible();
  await expect(
    page.getByText("Most used non-limited characters"),
  ).toBeVisible();
  await expect(page.locator(".wish").first()).toBeVisible();
  await expect(page.getByRole("listitem", { name: /Hu Tao/i })).toBeVisible();
  await expect(page.getByText(/Set up your roster in Settings/i)).toBeVisible({
    timeout: CLIENT_API_TIMEOUT,
  });
  await expect(
    page.getByRole("heading", { name: "Best next pulls" }),
  ).toHaveCount(0);
});

test("pulls shows empty state when near-miss has nothing useful", async ({
  page,
}) => {
  attachBrowserDebug(page);
  await installApiMocks(page, {
    stygianTeams: [STYGIAN_OWNED_BASELINE],
    nearMissTeams: [],
  });

  const teamsReq = page.waitForRequest(
    (req) => new URL(req.url()).pathname.endsWith("/api/teams"),
    { timeout: CLIENT_API_TIMEOUT },
  );
  const nearMissReq = page.waitForRequest(
    (req) => new URL(req.url()).pathname.endsWith("/api/nearmiss"),
    { timeout: CLIENT_API_TIMEOUT },
  );

  await page.goto("/pulls");
  await Promise.all([teamsReq, nearMissReq]);

  await expect(
    page.getByText(/no single pull stands out|covers the high-usage/i),
  ).toBeVisible({ timeout: CLIENT_API_TIMEOUT });
  await expect(
    page.getByRole("heading", { name: "Most used characters in Stygian" }),
  ).toBeVisible({ timeout: CLIENT_API_TIMEOUT });
});
