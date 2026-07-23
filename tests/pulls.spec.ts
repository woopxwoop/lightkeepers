import { test, expect } from "@playwright/test";
import {
  installApiMocks,
  NEAR_MISS_SINGLE,
  STYGIAN_OWNED_BASELINE,
} from "./helpers";

const CLIENT_API_TIMEOUT = 45_000;

test("pulls ranks a mocked near-miss suggestion", async ({ page }) => {
  await installApiMocks(page, {
    stygianTeams: [STYGIAN_OWNED_BASELINE],
    nearMissTeams: [NEAR_MISS_SINGLE],
  });

  const nearmiss = page.waitForRequest(
    (req) => new URL(req.url()).pathname.endsWith("/api/nearmiss"),
    { timeout: CLIENT_API_TIMEOUT },
  );

  await page.goto("/pulls");
  await nearmiss;

  await expect(
    page.getByRole("heading", { name: "Pull Suggestions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Best next pulls" }),
  ).toBeVisible({ timeout: CLIENT_API_TIMEOUT });
  await expect(page.locator(".row-name", { hasText: "Hu Tao" })).toBeVisible();
});

test("pulls shows empty state when near-miss has nothing useful", async ({
  page,
}) => {
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
});
