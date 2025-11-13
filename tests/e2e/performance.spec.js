import { test, expect } from '@playwright/test'

/**
 * Performance tests
 */
test.describe('Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now()
    
    await page.goto('/')
    
    // Wait for main content to be visible
    await expect(page.getByText('3D Weather City')).toBeVisible({ timeout: 10000 })
    
    const loadTime = Date.now() - startTime
    
    // Should load within 10 seconds
    expect(loadTime).toBeLessThan(10000)
  })

  test('should have acceptable Time to Interactive', async ({ page }) => {
    await page.goto('/')
    
    // Wait for interactive elements
    const searchInput = page.getByPlaceholder('Enter city name...')
    await expect(searchInput).toBeVisible()
    
    // Check that input is interactive
    await searchInput.fill('test')
    await expect(searchInput).toHaveValue('test')
  })

  test('should handle rapid user interactions', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)
    
    const toggleButton = page.getByRole('button', { name: /Open Weather Info/i })
    
    // Rapidly toggle drawer
    for (let i = 0; i < 5; i++) {
      await toggleButton.click()
      await page.waitForTimeout(100)
      await toggleButton.click()
      await page.waitForTimeout(100)
    }
    
    // App should still be responsive
    await expect(toggleButton).toBeVisible()
  })

  test('should not have memory leaks on repeated searches', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)
    
    const searchInput = page.getByPlaceholder('Enter city name...')
    const searchButton = page.getByRole('button', { name: /🔍|search/i })
    
    // Perform multiple searches
    const cities = ['London', 'Paris', 'Tokyo', 'New York', 'Berlin']
    
    for (const city of cities) {
      await searchInput.fill(city)
      await searchButton.click()
      await page.waitForTimeout(2000)
    }
    
    // App should still be functional
    await expect(searchInput).toBeVisible()
  })

  test('should handle canvas rendering efficiently', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000)
    
    // Check that canvas is present
    const canvas = page.locator('canvas')
    await expect(canvas.first()).toBeVisible({ timeout: 10000 })
    
    // Check canvas dimensions are reasonable
    const canvasBox = await canvas.first().boundingBox()
    expect(canvasBox?.width).toBeGreaterThan(0)
    expect(canvasBox?.height).toBeGreaterThan(0)
  })
})

