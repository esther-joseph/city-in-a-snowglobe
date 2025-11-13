import { test, expect } from '@playwright/test'

/**
 * Smoke tests - Basic functionality checks
 */
test.describe('Smoke Tests', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/')
    
    // Check that the main title is visible
    await expect(page.getByText('3D Weather City')).toBeVisible()
    
    // Check that the search form is present
    await expect(page.getByPlaceholder('Enter city name...')).toBeVisible()
    
    // Check that the toggle button is visible
    await expect(page.getByRole('button', { name: /Open Weather Info/i })).toBeVisible()
  })

  test('should display initial weather data', async ({ page }) => {
    await page.goto('/')
    
    // Wait for the app to load (check for weather data)
    await page.waitForTimeout(2000)
    
    // Open the weather drawer
    await page.getByRole('button', { name: /Open Weather Info/i }).click()
    
    // Check that weather information is displayed (temperature should be visible)
    const temperature = page.locator('.temperature, .summary-temp, .temperature-label')
    await expect(temperature.first()).toBeVisible({ timeout: 10000 })
  })

  test('should have accessible navigation', async ({ page }) => {
    await page.goto('/')
    
    // Check that all interactive elements are keyboard accessible
    const searchInput = page.getByPlaceholder('Enter city name...')
    await searchInput.focus()
    await expect(searchInput).toBeFocused()
    
    // Check toggle button is accessible
    const toggleButton = page.getByRole('button', { name: /Open Weather Info/i })
    await toggleButton.focus()
    await expect(toggleButton).toBeFocused()
  })
})

