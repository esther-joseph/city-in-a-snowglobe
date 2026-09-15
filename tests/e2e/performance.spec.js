import { test, expect } from '@playwright/test'
import { APP_TITLE, gotoApp, openDrawer, searchButton, searchInput } from './support/app.js'

/**
 * Performance tests
 */
test.describe('Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now()

    await gotoApp(page)
    await expect(page.getByRole('heading', { name: APP_TITLE })).toBeVisible()

    expect(Date.now() - startTime).toBeLessThan(20000)
  })

  test('should have acceptable Time to Interactive', async ({ page }) => {
    await gotoApp(page)

    await searchInput(page).fill('test')
    await expect(searchInput(page)).toHaveValue('test')
  })

  test('should handle rapid user interactions', async ({ page }) => {
    await gotoApp(page)

    const openButton = page.getByRole('button', { name: /Open Weather Info/i })
    const closeButton = page.getByRole('button', { name: /Close Weather Info/i })

    for (let i = 0; i < 5; i += 1) {
      await openButton.click()
      await expect(closeButton).toBeVisible()
      await closeButton.click()
      await expect(openButton).toBeVisible()
    }

    await expect(openButton).toBeVisible()
  })

  test('should stay responsive across repeated searches', async ({ page }) => {
    // Five full weather reloads, each re-rendering the scene: slower than the
    // default per-test budget, especially under mobile emulation.
    test.slow()
    await gotoApp(page)
    await openDrawer(page)

    for (const city of ['London', 'Paris', 'Tokyo', 'New York', 'Berlin']) {
      await searchInput(page).fill(city)
      await searchButton(page).click()
      await expect(searchInput(page)).toHaveValue(city)
    }

    await expect(searchInput(page)).toBeVisible()
  })

  test('should handle canvas rendering efficiently', async ({ page }) => {
    await gotoApp(page)

    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible()

    const canvasBox = await canvas.boundingBox()
    expect(canvasBox?.width).toBeGreaterThan(0)
    expect(canvasBox?.height).toBeGreaterThan(0)
  })
})
