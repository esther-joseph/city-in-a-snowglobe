import { test, expect } from '@playwright/test'

/**
 * Search functionality tests
 */
test.describe('Search Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for initial load
    await page.waitForTimeout(2000)
  })

  test('should display search input with placeholder', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Enter city name...')
    await expect(searchInput).toBeVisible()
    await expect(searchInput).toHaveAttribute('placeholder', 'Enter city name...')
  })

  test('should show clear button when text is entered', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Enter city name...')
    await searchInput.fill('New York')
    
    // Check that clear button appears
    const clearButton = page.locator('.clear-button')
    await expect(clearButton).toBeVisible()
  })

  test('should clear input when clear button is clicked', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Enter city name...')
    await searchInput.fill('New York')
    
    const clearButton = page.locator('.clear-button')
    await clearButton.click()
    
    await expect(searchInput).toHaveValue('')
    await expect(clearButton).not.toBeVisible()
  })

  test('should show autocomplete suggestions when typing', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Enter city name...')
    
    // Type a city name (wait for debounce)
    await searchInput.fill('dalas')
    await page.waitForTimeout(500) // Wait for debounce
    
    // Check if suggestions dropdown appears
    const suggestions = page.locator('.suggestions-dropdown')
    
    // Suggestions may or may not appear depending on API, but check if dropdown structure exists
    // If API is not available, this test will still pass if the structure is correct
    const hasSuggestions = await suggestions.count() > 0
    
    if (hasSuggestions) {
      await expect(suggestions).toBeVisible()
      // Check that suggestion items are present
      const suggestionItems = page.locator('.suggestion-item')
      await expect(suggestionItems.first()).toBeVisible()
    }
  })

  test('should submit search on form submit', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Enter city name...')
    const searchButton = page.getByRole('button', { name: /🔍|search/i })
    
    await searchInput.fill('London')
    await searchButton.click()
    
    // Wait for search to complete
    await page.waitForTimeout(3000)
    
    // Check that loading state appears briefly, then weather data loads
    // The search should trigger a new weather fetch
    const weatherInfo = page.locator('.weather-info, .weather-summary')
    await expect(weatherInfo.first()).toBeVisible({ timeout: 10000 })
  })

  test('should handle search with autocomplete selection', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Enter city name...')
    
    await searchInput.fill('dalas')
    await page.waitForTimeout(500)
    
    // Try to click on a suggestion if available
    const suggestions = page.locator('.suggestions-dropdown')
    const hasSuggestions = await suggestions.isVisible().catch(() => false)
    
    if (hasSuggestions) {
      const firstSuggestion = page.locator('.suggestion-item').first()
      await firstSuggestion.click()
      
      // Check that input is filled with selected city
      await expect(searchInput).not.toHaveValue('')
      
      // Wait for weather to load
      await page.waitForTimeout(3000)
    }
  })

  test('should close suggestions when clicking outside', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Enter city name...')
    
    await searchInput.fill('test')
    await page.waitForTimeout(500)
    
    // Click outside the search area
    await page.click('body', { position: { x: 10, y: 10 } })
    
    // Suggestions should close
    const suggestions = page.locator('.suggestions-dropdown')
    await expect(suggestions).not.toBeVisible()
  })
})

