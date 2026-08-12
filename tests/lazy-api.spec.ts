import { test, expect } from "@playwright/test";
import { installApiMocks, trackApiPaths } from "./helpers";
import { attachBrowserDebug } from "./debug";

const CLIENT_API_TIMEOUT = 45_000;

test("home and settings do not fetch owned teams or near-miss", async ({
  page,
}) => {
  attachBrowserDebug(page);
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
  attachBrowserDebug(page);
  await installApiMocks(page);
  const hits = trackApiPaths(page, ["/api/teams", "/api/nearmiss"]);

  const teamsReq = page.waitForRequest(
    (req) => new URL(req.url()).pathname.endsWith("/api/teams"),
    { timeout: CLIENT_API_TIMEOUT },
  );

  await page.goto("/tools/abyss");
  await expect(page.getByText("Solution 1")).toBeVisible({ timeout: 15_000 });
  await teamsReq;

  expect(hits.some((p) => p.endsWith("/api/teams"))).toBe(true);
  expect(hits.some((p) => p.endsWith("/api/nearmiss"))).toBe(false);
});

test("pulls fetches /api/teams, /api/nearmiss, and /api/tierlist", async ({
  page,
}) => {
  attachBrowserDebug(page);
  await installApiMocks(page);
  const hits = trackApiPaths(page, [
    "/api/teams",
    "/api/nearmiss",
    "/api/tierlist",
  ]);

  const teamsReq = page.waitForRequest(
    (req) => new URL(req.url()).pathname.endsWith("/api/teams"),
    { timeout: CLIENT_API_TIMEOUT },
  );
  const nearMissReq = page.waitForRequest(
    (req) => new URL(req.url()).pathname.endsWith("/api/nearmiss"),
    { timeout: CLIENT_API_TIMEOUT },
  );
  const tierListReq = page.waitForRequest(
    (req) => new URL(req.url()).pathname.endsWith("/api/tierlist"),
    { timeout: CLIENT_API_TIMEOUT },
  );

  await page.goto("/tools/pulls");
  await expect(
    page.getByRole("heading", { name: "Pull Suggestions" }),
  ).toBeVisible();
  await Promise.all([teamsReq, nearMissReq, tierListReq]);

  await expect(
    page.getByText("Matching your roster against Stygian usage…"),
  ).toHaveCount(0, { timeout: CLIENT_API_TIMEOUT });

  expect(hits.some((p) => p.endsWith("/api/teams"))).toBe(true);
  expect(hits.some((p) => p.endsWith("/api/nearmiss"))).toBe(true);
  expect(hits.some((p) => p.endsWith("/api/tierlist"))).toBe(true);
});
