import { test, expect, devices } from '@playwright/test'
import { APP_TITLE, drawer, gotoApp, openDrawer, searchButton, searchInput } from './support/app.js'

/**
 * Mobile responsiveness tests.
 *
 * test.use has to sit at file scope: inside a describe it would change
 * defaultBrowserType and force a new worker, which is the error this suite
 * used to fail with.
 */
test.use({ ...devices['Pixel 5'] })

test.describe('Mobile Responsiveness', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('should display correctly on mobile viewport', async ({ page }) => {
    await openDrawer(page)

    await expect(page.getByRole('heading', { name: APP_TITLE })).toBeVisible()
    await expect(searchInput(page)).toBeVisible()
  })

  test('should keep the search button beside the input on mobile', async ({ page }) => {
    await openDrawer(page)

    const inputBox = await searchInput(page).boundingBox()
    const buttonBox = await searchButton(page).boundingBox()

    expect(buttonBox?.x).toBeGreaterThan(inputBox?.x ?? 0)
    // Same row, not stacked.
    expect(Math.abs((buttonBox?.y ?? 0) - (inputBox?.y ?? 0))).toBeLessThan(20)
  })

  test('should have drawer accessible on mobile', async ({ page }) => {
    await openDrawer(page)
    await expect(drawer(page)).toBeVisible()
  })

  test('should scroll drawer content on mobile', async ({ page }) => {
    await openDrawer(page)

    const isScrollable = await drawer(page).evaluate((el) => el.scrollHeight > el.clientHeight)
    expect(isScrollable).toBeTruthy()
  })

  test('should have touch-friendly button sizes on mobile', async ({ page }) => {
    await openDrawer(page)

    const buttonBox = await searchButton(page).boundingBox()
    expect(buttonBox?.width).toBeGreaterThanOrEqual(44)
    expect(buttonBox?.height).toBeGreaterThanOrEqual(44)
  })

  test('should display suggestions dropdown above the scene on mobile', async ({ page }) => {
    await openDrawer(page)
    await searchInput(page).fill('London')

    const suggestions = page.locator('.suggestions-dropdown')
    await expect(suggestions).toBeVisible()

    const zIndex = await suggestions.evaluate((el) => window.getComputedStyle(el).zIndex)
    expect(parseInt(zIndex, 10)).toBeGreaterThan(10)
  })
})
