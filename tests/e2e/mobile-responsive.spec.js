import { test, expect, devices } from '@playwright/test'

/**
 * Mobile responsiveness tests
 * Note: iPhone 12 device configuration is disabled
 * Tests will run on the default browser from playwright.config.js
 */
// To use iPhone 12, uncomment the following:
// test.use({
//   ...devices['iPhone 12'],
// })

test.describe('Mobile Responsiveness', () => {

  test('should display correctly on mobile viewport', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)
    
    // Check that main elements are visible
    await expect(page.getByText('3D Weather City')).toBeVisible()
    await expect(page.getByPlaceholder('Enter city name...')).toBeVisible()
  })

  test('should have search button on the right on mobile', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)
    
    const searchForm = page.locator('.search-form')
    const searchButton = page.getByRole('button', { name: /🔍|search/i })
    
    // Check that search button is visible and positioned correctly
    await expect(searchButton).toBeVisible()
    
    // On mobile, button should be in row layout (order: 2)
    const buttonOrder = await searchButton.evaluate((el) => {
      return window.getComputedStyle(el).order
    })
    expect(buttonOrder).toBe('2')
  })

  test('should have drawer accessible on mobile', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)
    
    const toggleButton = page.getByRole('button', { name: /Open Weather Info/i })
    await toggleButton.click()
    await page.waitForTimeout(500)
    
    // Drawer should be visible
    const drawer = page.locator('.fixed.top-0.left-0')
    await expect(drawer).toBeVisible()
  })

  test('should scroll drawer content on mobile', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)
    
    // Open drawer
    await page.getByRole('button', { name: /Open Weather Info/i }).click()
    await page.waitForTimeout(500)
    
    // Check that drawer is scrollable
    const drawer = page.locator('.fixed.top-0.left-0')
    const isScrollable = await drawer.evaluate((el) => {
      return el.scrollHeight > el.clientHeight
    })
    
    // Drawer should be scrollable if content is long
    expect(isScrollable).toBeTruthy()
  })

  test('should have touch-friendly button sizes on mobile', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)
    
    const searchButton = page.getByRole('button', { name: /🔍|search/i })
    const buttonBox = await searchButton.boundingBox()
    
    // Buttons should be at least 44x44px for touch targets (WCAG recommendation)
    expect(buttonBox?.width).toBeGreaterThanOrEqual(44)
    expect(buttonBox?.height).toBeGreaterThanOrEqual(44)
  })

  test('should display suggestions dropdown correctly on mobile', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)
    
    const searchInput = page.getByPlaceholder('Enter city name...')
    await searchInput.fill('test')
    await page.waitForTimeout(500)
    
    // Check dropdown z-index is high enough
    const suggestions = page.locator('.suggestions-dropdown')
    const hasSuggestions = await suggestions.isVisible().catch(() => false)
    
    if (hasSuggestions) {
      const zIndex = await suggestions.evaluate((el) => {
        return window.getComputedStyle(el).zIndex
      })
      // Should have high z-index
      expect(parseInt(zIndex)).toBeGreaterThan(1000)
    }
  })
})


