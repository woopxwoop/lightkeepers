import { test, expect } from "@playwright/test";

// Verifies that all main routes render without SSR crashes or blank pages.

test("playwright E2E fixtures are active on /api/static", async ({
  request,
}) => {
  const res = await request.get("/api/static");
  expect(res.status()).toBe(200);
  expect(res.headers()["x-playwright-e2e"]).toBe("1");
  const body = await res.json();
  expect(body.allTeamsAbyss?.[0]?.team_key).toBe("test-abyss-top");
});

const routes: Array<
  | { path: string; kind: "nav" }
  | { path: string; kind: "heading"; name: string }
> = [
  { path: "/", kind: "nav" },
  { path: "/tools/abyss", kind: "heading", name: "Spiral Abyss" },
  { path: "/tools/stygian", kind: "heading", name: "Stygian Onslaught" },
  { path: "/tools/pulls", kind: "heading", name: "Pull Suggestions" },
  // Settings has a second <nav> for sections — assert the page title instead.
  { path: "/settings", kind: "heading", name: "Settings" },
];

const legacyRedirects = [
  { from: "/abyss", to: "/tools/abyss" },
  { from: "/stygian", to: "/tools/stygian" },
  { from: "/stygian/enemies", to: "/tools/stygian/enemies" },
  { from: "/stygian/enemies/42", to: "/tools/stygian/enemies/42" },
  { from: "/calculator", to: "/tools/planner" },
  { from: "/pulls", to: "/tools/pulls" },
] as const;

for (const { from, to } of legacyRedirects) {
  test(`${from} redirects to ${to}`, async ({ request }) => {
    const res = await request.get(from, { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    const location = res.headers()["location"] ?? "";
    expect(new URL(location, "http://127.0.0.1:5173").pathname).toBe(to);
  });
}

for (const route of routes) {
  test(`${route.path} loads`, async ({ page }) => {
    const response = await page.goto(route.path);
    expect(response?.status()).toBeLessThan(500);

    if (route.kind === "heading") {
      await expect(page.getByRole("heading", { name: route.name })).toBeVisible(
        { timeout: 15_000 },
      );
    } else {
      await expect(page.getByRole("navigation").first()).toBeVisible();
    }
  });
}
