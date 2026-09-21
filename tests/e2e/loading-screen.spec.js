import { test, expect } from '@playwright/test'
import { stubWeatherApi } from './support/weatherFixture.js'
import { gotoApp, temperature } from './support/app.js'

/**
 * The cover over the scene while it is still being assembled.
 *
 * Its job is not decoration. Until the weather arrives the app knows no place
 * and no timezone, so the globe would sit under a default sky showing the
 * machine's clock rather than the city's — wrong rather than merely early. The
 * cover hides that, and must then get out of the way, including when the
 * weather never comes.
 */

const cover = (page) => page.getByTestId('loading-screen')

/** Open the app with the weather held back, so the cover can be observed. */
async function gotoSlow(page, { delayMs = 3000, fail = false } = {}) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('app-has-reloaded', 'true')
  })
  if (fail) {
    await page.route('**/api/openweather**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      await route.abort()
    })
  } else {
    await stubWeatherApi(page)
    await page.route('**/api/openweather**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      await route.fallback()
    })
  }
  await page.goto('/?ads=off')
}

test.describe('Loading screen', () => {
  test('is held even when the weather answers at once', async ({ page }) => {
    // A cached city answers in well under a second. Without a floor the cover
    // would flash past, which is the thing the hold exists to prevent.
    await gotoSlow(page, { delayMs: 0 })
    await expect(cover(page)).toBeVisible()

    await page.waitForTimeout(4000)
    await expect(cover(page)).toBeVisible()

    await expect(cover(page)).toBeHidden({ timeout: 25000 })
    await expect(temperature(page)).toBeVisible()
  })

  test('covers the scene until the weather is in', async ({ page }) => {
    await gotoSlow(page, { delayMs: 3000 })

    await expect(cover(page)).toBeVisible()

    // Covering means covering: the whole viewport, and on top.
    const box = await cover(page).boundingBox()
    const viewport = page.viewportSize()
    expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1)
    expect(box.height).toBeGreaterThanOrEqual(viewport.height - 1)

    await expect(cover(page)).toBeHidden({ timeout: 25000 })
    await expect(temperature(page)).toBeVisible()
  })

  test('reports progress while it waits', async ({ page }) => {
    await gotoSlow(page, { delayMs: 4000 })

    const bar = page.getByRole('progressbar')
    await expect(bar).toBeVisible()

    const early = Number(await bar.getAttribute('aria-valuenow'))
    expect(early).toBeGreaterThan(0)
    expect(early).toBeLessThan(100)

    await expect(cover(page)).toBeHidden({ timeout: 25000 })
  })

  test('names the city it is waiting on', async ({ page }) => {
    await gotoSlow(page, { delayMs: 4000 })
    await expect(cover(page)).toContainText(/Reading the sky over|Waking the globe/)
    await expect(cover(page)).toBeHidden({ timeout: 25000 })
  })

  test('gets out of the way when the weather never comes', async ({ page }) => {
    await gotoSlow(page, { delayMs: 200, fail: true })

    await expect(cover(page)).toBeVisible()
    // The app's own error state says more than a bar that never fills, so the
    // cover must not hold the reader there.
    await expect(cover(page)).toBeHidden({ timeout: 25000 })
  })
})

test.describe('Loading screen, skipped', () => {
  test('?cover=off mounts no cover and no second canvas', async ({ page }) => {
    await gotoApp(page)

    await expect(cover(page)).toHaveCount(0)
    // The cover carries its own WebGL canvas. Browsers keep only a handful of
    // live contexts and drop the oldest when that runs out, so a canvas that
    // exists for half a second on every page load is worth not creating.
    await expect(page.locator('canvas')).toHaveCount(1)
  })
})
