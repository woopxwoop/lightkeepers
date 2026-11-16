import { test, expect, type Page, type Route } from "@playwright/test";
import { installApiMocks } from "./helpers";
import { attachBrowserDebug } from "./debug";

// Layout sheets mount through LoadOnFirstOpen: the chunk is imported on the
// first open request, and a failed import resets the open store for a retry.

async function gotoHydratedHome(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("navigation").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
}

function accountButton(page: Page) {
  return page.getByRole("button", { name: "Account", exact: true });
}

function accountDialog(page: Page) {
  return page.getByRole("dialog", { name: "Account" });
}

test("account button opens the account sheet", async ({ page }) => {
  attachBrowserDebug(page);
  await installApiMocks(page);
  await gotoHydratedHome(page);

  await accountButton(page).click();

  const dialog = accountDialog(page);
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Account", exact: true }),
  ).toBeVisible();
  await expect(accountButton(page)).toHaveAttribute("aria-expanded", "true");
});

test("account sheet retries after its chunk fails to load", async ({
  page,
}) => {
  attachBrowserDebug(page);
  await installApiMocks(page);
  await gotoHydratedHome(page);

  // Dev serves `/src/…/*.svelte?…`, the build serves hashed `/_app/…/*.js`;
  // once hydrated and idle, every script request is a lazy chunk.
  let blocked = true;
  const abortWhileBlocked = async (route: Route) => {
    if (blocked) await route.abort("failed");
    else await route.fallback();
  };
  await page.route("**/*.js*", abortWhileBlocked);
  await page.route("**/*.svelte*", abortWhileBlocked);

  let navigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations += 1;
  });

  const chunkFailed = page.waitForEvent("requestfailed");
  await accountButton(page).click();
  await chunkFailed;

  await expect
    .poll(() => accountButton(page).getAttribute("aria-expanded"))
    .toBe("false");
  await expect(accountDialog(page)).toHaveCount(0);
  expect(navigations).toBe(0);

  blocked = false;
  await accountButton(page).click();

  await expect(accountDialog(page)).toBeVisible();
  await expect(accountButton(page)).toHaveAttribute("aria-expanded", "true");
});
