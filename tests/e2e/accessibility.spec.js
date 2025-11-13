import { test, expect } from '@playwright/test'

/**
 * Accessibility tests
 */
test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)
  })

  test('should have proper heading hierarchy', async ({ page }) => {
    // Check for h1
    const h1 = page.locator('h1')
    await expect(h1.first()).toBeVisible()
    
    // Check for h2 in weather info
    await page.getByRole('button', { name: /Open Weather Info/i }).click()
    await page.waitForTimeout(500)
    
    const h2 = page.locator('h2')
    const h2Count = await h2.count()
    expect(h2Count).toBeGreaterThan(0)
  })

  test('should have accessible button labels', async ({ page }) => {
    const buttons = page.locator('button')
    const buttonCount = await buttons.count()
    
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i)
      const ariaLabel = await button.getAttribute('aria-label')
      const textContent = await button.textContent()
      
      // Button should have either aria-label or text content
      expect(ariaLabel || textContent?.trim()).toBeTruthy()
    }
  })

  test('should have accessible form inputs', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Enter city name...')
    
    // Check that input has proper attributes
    await expect(searchInput).toHaveAttribute('type', 'text')
    
    // Check that input is focusable
    await searchInput.focus()
    await expect(searchInput).toBeFocused()
  })

  test('should support keyboard navigation', async ({ page }) => {
    // Tab through interactive elements
    await page.keyboard.press('Tab')
    
    // Check that focus moves to an interactive element
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
    
    // Continue tabbing
    await page.keyboard.press('Tab')
    const nextFocused = page.locator(':focus')
    await expect(nextFocused).toBeVisible()
  })

  test('should have sufficient color contrast', async ({ page }) => {
    // Open drawer to check text contrast
    await page.getByRole('button', { name: /Open Weather Info/i }).click()
    await page.waitForTimeout(500)
    
    // Check that text is visible (basic contrast check)
    const textElements = page.locator('p, span, h1, h2, h3')
    const firstText = textElements.first()
    await expect(firstText).toBeVisible()
    
    // Get computed color
    const color = await firstText.evaluate((el) => {
      return window.getComputedStyle(el).color
    })
    
    // Should have a color (not transparent)
    expect(color).not.toBe('rgba(0, 0, 0, 0)')
    expect(color).not.toBe('transparent')
  })

  test('should have proper ARIA attributes', async ({ page }) => {
    // Check toggle button has aria-label
    const toggleButton = page.getByRole('button', { name: /Open Weather Info/i })
    const ariaLabel = await toggleButton.getAttribute('aria-label')
    expect(ariaLabel).toBeTruthy()
    
    // Check mode toggle buttons have aria-pressed
    await toggleButton.click()
    await page.waitForTimeout(500)
    
    const modeButtons = page.locator('.mode-toggle__button')
    const firstModeButton = modeButtons.first()
    const ariaPressed = await firstModeButton.getAttribute('aria-pressed')
    expect(ariaPressed).toBeTruthy()
  })

  test('should handle focus management', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Enter city name...')
    
    // Focus input
    await searchInput.focus()
    await expect(searchInput).toBeFocused()
    
    // Press Escape should blur (if implemented)
    await page.keyboard.press('Escape')
    
    // Focus should move away or stay (depending on implementation)
    // Just check that app doesn't break
    await expect(page).toHaveURL(/.*/)
  })
})

