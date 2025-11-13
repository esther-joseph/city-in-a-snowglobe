import { test, expect, devices } from '@playwright/test'

/**
 * Tablet responsiveness tests
 */
test.use({
  ...devices['iPad Pro'],
})

test.describe('Tablet Responsiveness', () => {
  test('should display correctly on tablet viewport', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)
    
    // Check that all UI elements are visible and properly sized
    await expect(page.getByText('3D Weather City')).toBeVisible()
    await expect(page.getByPlaceholder('Enter city name...')).toBeVisible()
  })
})

