import { test, expect, devices } from '@playwright/test'
import { APP_TITLE, gotoApp, openDrawer, searchInput } from './support/app.js'

/**
 * Tablet responsiveness tests.
 * Uses a chromium-based tablet profile so the suite runs without extra
 * browser downloads; iPad Pro would pull in webkit.
 */
test.use({ ...devices['Galaxy Tab S4 landscape'] })

test.describe('Tablet Responsiveness', () => {
  test('should display correctly on tablet viewport', async ({ page }) => {
    await gotoApp(page)
    await openDrawer(page)

    await expect(page.getByRole('heading', { name: APP_TITLE })).toBeVisible()
    await expect(searchInput(page)).toBeVisible()
  })
})
