import { test, expect } from "@playwright/test";
import { installApiMocks } from "./helpers";

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
});

test("stygian page shows board", async ({ page }) => {
  await page.goto("/tools/stygian");

  await expect(
    page.getByRole("heading", { name: "Stygian Onslaught" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Solution 1")).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByText("No team available for this field"),
  ).not.toBeVisible();
});
