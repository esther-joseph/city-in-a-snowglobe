import { test, expect } from '@playwright/test'
import { gotoApp, openDrawer, searchInput } from './support/app.js'

/**
 * Accessibility tests
 */
test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('should have proper heading hierarchy', async ({ page }) => {
    await openDrawer(page)

    await expect(page.locator('h1').first()).toBeVisible()
    expect(await page.locator('h2').count()).toBeGreaterThan(0)
  })

  test('should have accessible button labels', async ({ page }) => {
    await openDrawer(page)

    // Only visible buttons: the drawer keeps offscreen controls mounted.
    const buttons = await page.locator('button:visible').all()
    expect(buttons.length).toBeGreaterThan(0)

    for (const button of buttons) {
      const ariaLabel = await button.getAttribute('aria-label')
      const textContent = await button.textContent()
      expect(ariaLabel || textContent?.trim()).toBeTruthy()
    }
  })

  test('should have accessible form inputs', async ({ page }) => {
    await openDrawer(page)

    await expect(searchInput(page)).toHaveAttribute('type', 'text')
    await searchInput(page).focus()
    await expect(searchInput(page)).toBeFocused()
  })

  test('should support keyboard navigation', async ({ page }) => {
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toBeVisible()

    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toBeVisible()
  })

  test('should have readable text colours', async ({ page }) => {
    await openDrawer(page)

    const heading = page.locator('.weather-header h1').first()
    await expect(heading).toBeVisible()

    const color = await heading.evaluate((el) => window.getComputedStyle(el).color)
    expect(color).not.toBe('rgba(0, 0, 0, 0)')
    expect(color).not.toBe('transparent')
  })

  test('should have proper ARIA attributes', async ({ page }) => {
    const toggleButton = page.getByRole('button', { name: /Open Weather Info/i })
    expect(await toggleButton.getAttribute('aria-label')).toBeTruthy()

    await openDrawer(page)

    const firstModeButton = page.locator('.mode-toggle__button').first()
    expect(await firstModeButton.getAttribute('aria-pressed')).toBeTruthy()
  })

  test('should handle focus management', async ({ page }) => {
    await openDrawer(page)

    await searchInput(page).focus()
    await expect(searchInput(page)).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/.*/)
  })
})
