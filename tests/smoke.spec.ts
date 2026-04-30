import { test, expect } from '@playwright/test'

// Verifies that all main routes render without SSR crashes or blank pages.
// Each check looks for a stable landmark that won't survive a broken build.

const routes = [
  { path: '/', landmark: 'navigation' },
  { path: '/abyss', landmark: 'navigation' },
  { path: '/stygian', landmark: 'navigation' },
  { path: '/settings', landmark: 'navigation' },
  { path: '/pulls', landmark: 'navigation' },
]

for (const { path, landmark } of routes) {
  test(`${path} loads`, async ({ page }) => {
    const response = await page.goto(path)
    expect(response?.status()).toBeLessThan(500)
    await expect(page.getByRole(landmark as 'navigation')).toBeVisible()
  })
}
