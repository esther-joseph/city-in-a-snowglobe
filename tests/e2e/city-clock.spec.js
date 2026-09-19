import { test, expect } from '@playwright/test'
import { gotoApp, openDrawer } from './support/app.js'
import { CURRENT_WEATHER } from './support/weatherFixture.js'

/**
 * The clock reads the city's time, not the reader's.
 *
 * A globe of Tokyo showing London's afternoon would be the same class of wrong
 * as a globe of Tokyo under London's weather. The weather payload carries a
 * timezone offset in seconds, and that is what the clock runs on.
 */

const overlay = (page) => page.getByTestId('city-clock-overlay')
const panel = (page) => page.getByTestId('city-clock-panel')

/** What the fixture's city should be reading right now. */
function expectedCityTime() {
  const shifted = new Date(Date.now() + CURRENT_WEATHER.timezone * 1000)
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC'
  }).format(shifted)
}

test.describe('City clock', () => {
  test('floats above the globe showing the city’s own time', async ({ page }) => {
    await gotoApp(page)
    await expect(overlay(page)).toBeVisible()
    // The fixture is UTC-4. If the clock were reading the browser's zone this
    // would only match by luck.
    await expect(overlay(page)).toContainText(expectedCityTime())
  })

  test('shows the date as well', async ({ page }) => {
    await gotoApp(page)
    const expectedDate = new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC'
    })
      .format(new Date(Date.now() + CURRENT_WEATHER.timezone * 1000))
      .toUpperCase()
    // Upper-cased in CSS, so the check is on what the element holds.
    await expect(overlay(page)).toContainText(new RegExp(expectedDate, 'i'))
  })

  test('sits above the weather in every view mode', async ({ page }) => {
    await gotoApp(page)
    await openDrawer(page)

    for (const mode of ['Minimal', 'Compact', 'Informational']) {
      await page.getByRole('button', { name: mode, exact: true }).click()
      await expect(panel(page)).toBeVisible()

      // Above the weather, not below it.
      const clockBox = await panel(page).boundingBox()
      const weatherBox = await page.locator('.weather-info, .weather-summary').first().boundingBox()
      expect(clockBox.y, `clock above the weather in ${mode}`).toBeLessThan(weatherBox.y)
    }
  })

  test('takes its hue from the season', async ({ page }) => {
    const seen = {}
    for (const season of ['spring', 'summer', 'autumn', 'winter']) {
      await gotoApp(page, `/?season=${season}`)
      await expect(overlay(page)).toHaveAttribute('data-season', season)
      seen[season] = await overlay(page)
        .locator('.city-clock__time')
        .evaluate((node) => getComputedStyle(node).backgroundImage)
    }

    // Four seasons, four different sheens.
    const distinct = new Set(Object.values(seen))
    expect(distinct.size).toBe(4)
    // Autumn is the amber one; summer the plain iridescence.
    expect(seen.autumn).toContain('240, 191, 85')
    expect(seen.summer).not.toBe(seen.autumn)
  })

  test('ticks without rebuilding the scene once a second', async ({ page }) => {
    await gotoApp(page)
    await expect(overlay(page)).toBeVisible()

    // BaseScene and ShakeableScene are declared inside App, so every App
    // render tears down and rebuilds the whole 3D subtree. A clock that
    // ticked in App state would do that once a second, which is why the
    // interval lives inside the clock instead.
    //
    // The scene already churns on its own every few seconds for other
    // reasons, so this is not "never rebuilds" — it is "not once per tick".
    const roots = []
    for (let sample = 0; sample < 8; sample += 1) {
      roots.push(await page.evaluate(() => window.__snowGlobeScene.children[0]?.uuid))
      await page.waitForTimeout(1000)
    }

    const rebuilds = new Set(roots).size
    expect(rebuilds, `scene roots over 8s: ${rebuilds}`).toBeLessThanOrEqual(3)
  })

  test('advances as time passes', async ({ page }) => {
    // A real minute is too long to wait for and too short to prove anything
    // about, so the page's clock is put under control and wound forward.
    await page.clock.install()
    await gotoApp(page)

    const time = overlay(page).locator('.city-clock__time')
    await expect(time).toBeVisible()
    const before = await time.innerText()
    expect(before).toMatch(/\d{1,2}:\d{2}/)

    await page.clock.fastForward('02:00')
    await expect(time).not.toHaveText(before)
  })
})
