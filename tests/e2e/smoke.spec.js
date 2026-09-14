import { test, expect } from '@playwright/test'
import { APP_TITLE, gotoApp, openDrawer, searchInput, temperature } from './support/app.js'

/**
 * Smoke tests - Basic functionality checks
 */
test.describe('Smoke Tests', () => {
  test('should load the application', async ({ page }) => {
    await gotoApp(page)

    await expect(page.getByRole('heading', { name: APP_TITLE })).toBeVisible()
    await expect(searchInput(page)).toBeVisible()
    await expect(page.getByRole('button', { name: /Open Weather Info/i })).toBeVisible()
  })

  test('should display initial weather data', async ({ page }) => {
    await gotoApp(page)
    await openDrawer(page)

    await expect(temperature(page)).toBeVisible()
    await expect(page.getByText('New York, US')).toBeVisible()
  })

  test('should have accessible navigation', async ({ page }) => {
    await gotoApp(page)

    await searchInput(page).focus()
    await expect(searchInput(page)).toBeFocused()

    const toggleButton = page.getByRole('button', { name: /Open Weather Info/i })
    await toggleButton.focus()
    await expect(toggleButton).toBeFocused()
  })
})
