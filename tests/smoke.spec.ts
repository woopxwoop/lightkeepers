import { test, expect } from "@playwright/test";

// Verifies that all main routes render without SSR crashes or blank pages.

const routes: Array<
  | { path: string; kind: "nav" }
  | { path: string; kind: "heading"; name: string }
> = [
  { path: "/", kind: "nav" },
  { path: "/abyss", kind: "heading", name: "Spiral Abyss" },
  { path: "/stygian", kind: "heading", name: "Stygian Onslaught" },
  { path: "/pulls", kind: "heading", name: "Pull Suggestions" },
  // Settings has a second <nav> for sections — assert the page title instead.
  { path: "/settings", kind: "heading", name: "Settings" },
];

for (const route of routes) {
  test(`${route.path} loads`, async ({ page }) => {
    const response = await page.goto(route.path);
    expect(response?.status()).toBeLessThan(500);

    if (route.kind === "heading") {
      await expect(
        page.getByRole("heading", { name: route.name }),
      ).toBeVisible({ timeout: 15_000 });
    } else {
      await expect(page.getByRole("navigation").first()).toBeVisible();
    }
  });
}
