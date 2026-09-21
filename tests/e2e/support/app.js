import { expect } from '@playwright/test'
import { stubWeatherApi } from './weatherFixture.js'

export const APP_TITLE = 'City In A Snowglobe'

/**
 * Open the app in a state the tests can rely on.
 *
 * Two things would otherwise make every spec flaky: the app reloads itself
 * once per session on first launch (which races any interaction started right
 * after goto), and the weather comes from a live API. Both are neutralised
 * here rather than papered over with sleeps.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} [path] - Where to land, for the launch-parameter specs.
 */
export async function gotoApp(page, path = '/') {
  // Skip the loading cover. Every spec that clicks would otherwise wait out its
  // hold first, since the cover sits over the whole app and takes pointer
  // events while it is there, and it would spend a second WebGL context per
  // page load on a screen no assertion looks at.
  const target = path.includes('cover=')
    ? path
    : `${path}${path.includes('?') ? '&' : '?'}cover=off`
  await page.addInitScript(() => {
    window.sessionStorage.setItem('app-has-reloaded', 'true')
  })
  await stubWeatherApi(page)
  await page.goto(target)
  await expect(page.locator('canvas').first()).toBeAttached()
  // A cold first paint on a loaded machine can take a while: the scene has to
  // compile its shaders before anything renders.
  await expect(temperature(page)).toBeVisible({ timeout: 45000 })
}

/** Slide the weather drawer open and wait for it to settle. */
export async function openDrawer(page) {
  await page.getByRole('button', { name: /Open Weather Info/i }).click()
  await expect(page.getByRole('button', { name: /Close Weather Info/i })).toBeVisible()
}

export const drawer = (page) => page.locator('.overflow-y-auto').first()
export const searchInput = (page) => page.getByPlaceholder('Enter city name...')
// Not getByRole(/search/i): the clear button is labelled "Clear search".
export const searchButton = (page) => page.locator('.search-button')
export const clearButton = (page) => page.locator('.clear-button')
export const temperature = (page) => page.locator('.summary-temp, .temperature').first()
