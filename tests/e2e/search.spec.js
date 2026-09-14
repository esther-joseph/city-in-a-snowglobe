import { test, expect } from '@playwright/test'
import {
  clearButton,
  gotoApp,
  openDrawer,
  searchButton,
  searchInput
} from './support/app.js'

/**
 * Search functionality tests. Geocoding is stubbed, so the autocomplete
 * assertions are deterministic instead of conditional on the live API.
 */
test.describe('Search Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
    await openDrawer(page)
  })

  test('should display search input with placeholder', async ({ page }) => {
    await expect(searchInput(page)).toBeVisible()
    await expect(searchInput(page)).toHaveAttribute('placeholder', 'Enter city name...')
  })

  test('should show clear button when text is entered', async ({ page }) => {
    await searchInput(page).fill('New York')
    await expect(clearButton(page)).toBeVisible()
  })

  test('should clear input when clear button is clicked', async ({ page }) => {
    await searchInput(page).fill('New York')
    await clearButton(page).click()

    await expect(searchInput(page)).toHaveValue('')
    await expect(clearButton(page)).toHaveCount(0)
  })

  test('should show autocomplete suggestions when typing', async ({ page }) => {
    await searchInput(page).fill('London')

    const suggestions = page.locator('.suggestions-dropdown')
    await expect(suggestions).toBeVisible()
    await expect(page.locator('.suggestion-item').first()).toBeVisible()
  })

  test('should submit search on form submit', async ({ page }) => {
    await searchInput(page).fill('London')
    await searchButton(page).click()

    await expect(page.locator('.weather-info, .weather-summary').first()).toBeVisible()
  })

  test('should handle search with autocomplete selection', async ({ page }) => {
    await searchInput(page).fill('London')

    await page.locator('.suggestion-item').first().click()

    await expect(searchInput(page)).not.toHaveValue('')
    await expect(page.locator('.suggestions-dropdown')).toHaveCount(0)
  })

  test('should close suggestions when clicking outside', async ({ page }) => {
    await searchInput(page).fill('London')
    await expect(page.locator('.suggestions-dropdown')).toBeVisible()

    // Somewhere clearly outside the search box and not covered by the
    // dropdown on a narrow viewport.
    await page.locator('.mode-toggle__header').click()

    await expect(page.locator('.suggestions-dropdown')).toHaveCount(0)
  })
})
