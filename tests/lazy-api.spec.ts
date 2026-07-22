import { test, expect } from "@playwright/test";
import { installApiMocks, trackApiPaths } from "./helpers";

test("home and settings do not fetch owned teams or near-miss", async ({
  page,
}) => {
  await installApiMocks(page);
  const hits = trackApiPaths(page, ["/api/teams", "/api/nearmiss"]);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("navigation").first()).toBeVisible();

  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForLoadState("networkidle");

  expect(hits.filter((p) => p.endsWith("/api/teams"))).toEqual([]);
  expect(hits.filter((p) => p.endsWith("/api/nearmiss"))).toEqual([]);
});

test("abyss fetches /api/teams but not /api/nearmiss", async ({ page }) => {
  await installApiMocks(page);
  const hits = trackApiPaths(page, ["/api/teams", "/api/nearmiss"]);

  await page.goto("/abyss");
  await expect(page.getByText("Solution 1")).toBeVisible({ timeout: 15_000 });

  expect(hits.some((p) => p.endsWith("/api/teams"))).toBe(true);
  expect(hits.some((p) => p.endsWith("/api/nearmiss"))).toBe(false);
});

test("pulls fetches /api/teams and /api/nearmiss", async ({ page }) => {
  await installApiMocks(page);
  const hits = trackApiPaths(page, ["/api/teams", "/api/nearmiss"]);

  await page.goto("/pulls");
  await expect(
    page.getByRole("heading", { name: "Pull Suggestions" }),
  ).toBeVisible();
  await expect(
    page
      .getByText(/Matching your roster|no single pull|Best next pulls|Set up your roster/i)
      .first(),
  ).toBeVisible({ timeout: 15_000 });

  // Wait until waiting state has resolved (loaded flags set)
  await expect(
    page.getByText("Matching your roster against Stygian usage…"),
  ).toHaveCount(0, { timeout: 15_000 });

  expect(hits.some((p) => p.endsWith("/api/teams"))).toBe(true);
  expect(hits.some((p) => p.endsWith("/api/nearmiss"))).toBe(true);
});
