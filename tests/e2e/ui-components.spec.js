import { test, expect } from '@playwright/test'

/**
 * UI Components tests
 */
test.describe('UI Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)
    
    // Open the weather drawer
    await page.getByRole('button', { name: /Open Weather Info/i }).click()
    await page.waitForTimeout(500)
  })

  test('should toggle weather drawer open and close', async ({ page }) => {
    const toggleButton = page.getByRole('button', { name: /Open Weather Info|Close Weather Info/i })
    
    // Drawer should be open
    const drawer = page.locator('.fixed.top-0.left-0')
    await expect(drawer).toBeVisible()
    
    // Button text should say "Close Weather Info"
    await expect(toggleButton).toContainText('Close Weather Info')
    
    // Close the drawer
    await toggleButton.click()
    await page.waitForTimeout(300)
    
    // Drawer should be closed (not visible or translated out)
    const drawerTransform = await drawer.evaluate((el) => {
      return window.getComputedStyle(el).transform
    })
    // Drawer should be translated out when closed
    expect(drawerTransform).not.toBe('none')
  })

  test('should display view mode toggle buttons', async ({ page }) => {
    const minimalButton = page.getByRole('button', { name: /Minimal/i })
    const compactButton = page.getByRole('button', { name: /Compact/i })
    const informationalButton = page.getByRole('button', { name: /Informational/i })
    
    await expect(minimalButton).toBeVisible()
    await expect(compactButton).toBeVisible()
    await expect(informationalButton).toBeVisible()
  })

  test('should switch between view modes', async ({ page }) => {
    const minimalButton = page.getByRole('button', { name: /Minimal/i })
    const compactButton = page.getByRole('button', { name: /Compact/i })
    const informationalButton = page.getByRole('button', { name: /Informational/i })
    
    // Click minimal view
    await minimalButton.click()
    await page.waitForTimeout(300)
    await expect(minimalButton).toHaveClass(/active/)
    
    // Click compact view
    await compactButton.click()
    await page.waitForTimeout(300)
    await expect(compactButton).toHaveClass(/active/)
    
    // Click informational view
    await informationalButton.click()
    await page.waitForTimeout(300)
    await expect(informationalButton).toHaveClass(/active/)
  })

  test('should display weather information in minimal view', async ({ page }) => {
    const minimalButton = page.getByRole('button', { name: /Minimal/i })
    await minimalButton.click()
    await page.waitForTimeout(500)
    
    // Check for minimal view elements
    const weatherSummary = page.locator('.weather-summary')
    await expect(weatherSummary).toBeVisible({ timeout: 10000 })
  })

  test('should display temperature graph in informational view', async ({ page }) => {
    const informationalButton = page.getByRole('button', { name: /Informational/i })
    await informationalButton.click()
    await page.waitForTimeout(500)
    
    // Check for temperature graph
    const temperatureGraph = page.locator('.temperature-graph, .temperature-chart')
    await expect(temperatureGraph).toBeVisible({ timeout: 10000 })
  })

  test('should display sun position diagram in informational view', async ({ page }) => {
    const informationalButton = page.getByRole('button', { name: /Informational/i })
    await informationalButton.click()
    await page.waitForTimeout(500)
    
    // Check for sun position diagram
    const sunDiagram = page.locator('.sun-position-diagram')
    await expect(sunDiagram).toBeVisible({ timeout: 10000 })
  })

  test('should display time slider', async ({ page }) => {
    const timeCard = page.locator('.time-card')
    await expect(timeCard).toBeVisible({ timeout: 10000 })
    
    // Check for time slider input
    const timeSlider = page.locator('input[type="range"]')
    await expect(timeSlider).toBeVisible()
  })

  test('should have translucent backgrounds on UI components', async ({ page }) => {
    const weatherHeader = page.locator('.weather-header')
    const backgroundColor = await weatherHeader.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    
    // Should have rgba background (translucent)
    expect(backgroundColor).toContain('rgba')
  })

  test('should display mode toggle (3D/AR)', async ({ page }) => {
    const modeToggle = page.locator('.mode-toggle')
    await expect(modeToggle).toBeVisible()
    
    // Check for 3D and AR mode buttons
    const mode3D = page.getByRole('button', { name: /3D Mode/i })
    const modeAR = page.getByRole('button', { name: /AR Mode/i })
    
    await expect(mode3D).toBeVisible()
    await expect(modeAR).toBeVisible()
  })
})

