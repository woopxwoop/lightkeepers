import { test, expect } from "@playwright/test";
import {
  installApiMocks,
  NEAR_MISS_SINGLE,
  STYGIAN_OWNED_BASELINE,
} from "./helpers";

test("pulls ranks a mocked near-miss suggestion", async ({ page }) => {
  await installApiMocks(page, {
    stygianTeams: [STYGIAN_OWNED_BASELINE],
    nearMissTeams: [NEAR_MISS_SINGLE],
  });

  const nearmiss = page.waitForRequest(
    (req) => new URL(req.url()).pathname.endsWith("/api/nearmiss"),
  );

  await page.goto("/pulls");
  await nearmiss;

  await expect(
    page.getByRole("heading", { name: "Pull Suggestions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Best next pulls" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".row-name", { hasText: "Hu Tao" })).toBeVisible();
});

test("pulls shows empty state when near-miss has nothing useful", async ({
  page,
}) => {
  await installApiMocks(page, {
    stygianTeams: [STYGIAN_OWNED_BASELINE],
    nearMissTeams: [],
  });

  await page.goto("/pulls");

  await expect(
    page.getByText(/no single pull stands out|covers the high-usage/i),
  ).toBeVisible({ timeout: 15_000 });
});
