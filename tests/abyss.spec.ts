import { test, expect } from "@playwright/test";
import { installApiMocks } from "./helpers";

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
});

test("abyss solver fills both slots", async ({ page }) => {
  await page.goto("/abyss");

  await expect(page.getByText("Solution 1")).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByText("No team available for this side"),
  ).not.toBeVisible();
});

test("abyss shows meta teams section", async ({ page }) => {
  await page.goto("/abyss");

  await expect(page.getByRole("heading", { name: "Meta teams" })).toBeVisible({
    timeout: 15_000,
  });
  expect(await page.title()).toBeTruthy();
});

test("abyss enemies toggle works", async ({ page }) => {
  await page.goto("/abyss");
  await expect(page.getByText("Solution 1")).toBeVisible({ timeout: 15_000 });

  const toggle = page.getByRole("button", { name: /enemies/i });
  await expect(toggle).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
});
