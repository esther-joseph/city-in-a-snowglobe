import { test, expect } from '@playwright/test'
import { drawer, gotoApp, openDrawer } from './support/app.js'

/**
 * UI Components tests
 */
test.describe('UI Components', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
    await openDrawer(page)
  })

  test('should toggle weather drawer open and close', async ({ page }) => {
    await expect(drawer(page)).toBeVisible()

    const closeButton = page.getByRole('button', { name: /Close Weather Info/i })
    await closeButton.click()

    await expect(page.getByRole('button', { name: /Open Weather Info/i })).toBeVisible()
    // Closed means translated off-screen rather than removed.
    const transform = await drawer(page).evaluate((el) => window.getComputedStyle(el).transform)
    expect(transform).not.toBe('none')
  })

  test('should display view mode toggle buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Minimal/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Compact/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Informational/i })).toBeVisible()
  })

  test('should switch between view modes', async ({ page }) => {
    for (const name of [/Minimal/i, /Compact/i, /Informational/i]) {
      const button = page.getByRole('button', { name })
      await button.click()
      await expect(button).toHaveClass(/active/)
    }
  })

  test('should display weather information in minimal view', async ({ page }) => {
    await page.getByRole('button', { name: /Minimal/i }).click()
    await expect(page.locator('.weather-summary')).toBeVisible()
  })

  test('should display the hourly forecast strip in informational view', async ({ page }) => {
    // This asserted the 12-hour line chart, which the 48-hour card strip
    // replaced. The strip carries the same reading in more detail.
    await page.getByRole('button', { name: /Informational/i }).click()
    await expect(page.getByTestId('hourly-forecast')).toBeVisible()
    await expect(page.getByTestId('hourly-scroller').locator('.forecast-tile').first()).toBeVisible()
  })

  test('should display sun position diagram in informational view', async ({ page }) => {
    await page.getByRole('button', { name: /Informational/i }).click()
    await expect(page.locator('.sun-position-diagram').first()).toBeVisible()
  })

  test('should display time slider', async ({ page }) => {
    await page.getByRole('button', { name: /Informational/i }).click()
    await expect(page.locator('.time-card')).toBeVisible()
    await expect(page.locator('input[type="range"]').first()).toBeVisible()
  })

  test('should have translucent backgrounds on UI components', async ({ page }) => {
    const backgroundColor = await page
      .locator('.weather-header')
      .evaluate((el) => window.getComputedStyle(el).backgroundColor)

    expect(backgroundColor).toContain('rgba')
  })

  test('should display mode toggle (3D/AR)', async ({ page }) => {
    await expect(page.locator('.mode-toggle')).toBeVisible()
    await expect(page.getByRole('button', { name: /3D Mode/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /AR Mode/i })).toBeVisible()
  })
})
