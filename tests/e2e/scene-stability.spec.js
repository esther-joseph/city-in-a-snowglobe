import { test, expect } from '@playwright/test'
import { gotoApp, openDrawer } from './support/app.js'

/**
 * The 3D scene must survive a re-render.
 *
 * `BaseScene` and `ShakeableScene` used to be declared inside `App`. A
 * component declared inside another is a new function on every render, so
 * React saw a different type each time and unmounted the whole tree to mount a
 * fresh one — every geometry, every material, the fluted base, every tree,
 * thrown away and rebuilt. Moving the time slider did it four times in a row.
 *
 * The scene's root keeps its uuid across a re-render and gets a new one across
 * a remount, so counting distinct roots counts rebuilds.
 */

const sceneRoot = (page) =>
  page.evaluate(() => window.__snowGlobeScene?.children[0]?.uuid)

test.describe('Scene stability', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
    await expect
      .poll(() => page.evaluate(() => Boolean(window.__snowGlobeScene)), { timeout: 20000 })
      .toBe(true)
    // Let the first weather and the first celestial pass settle.
    await page.waitForTimeout(3000)
  })

  test('survives the time slider', async ({ page }) => {
    await openDrawer(page)
    await page.waitForSelector('.time-slider')

    const roots = new Set([await sceneRoot(page)])
    for (const hour of [8, 13, 19, 23]) {
      await page.evaluate((value) => {
        const slider = document.querySelector('.time-slider')
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        ).set
        setter.call(slider, String(value))
        slider.dispatchEvent(new Event('input', { bubbles: true }))
        slider.dispatchEvent(new Event('change', { bubbles: true }))
      }, hour)
      await page.waitForTimeout(600)
      roots.add(await sceneRoot(page))
    }

    // Four moves rebuilt it four times before.
    expect(roots.size, `scene rebuilds across four slider moves: ${roots.size - 1}`).toBe(1)
  })

  test('survives sitting still', async ({ page }) => {
    const roots = new Set([await sceneRoot(page)])
    for (let sample = 0; sample < 8; sample += 1) {
      await page.waitForTimeout(1500)
      roots.add(await sceneRoot(page))
    }
    expect(roots.size, `scene rebuilds over twelve idle seconds: ${roots.size - 1}`).toBe(1)
  })

  test('survives opening and closing the panel', async ({ page }) => {
    const roots = new Set([await sceneRoot(page)])
    for (let round = 0; round < 3; round += 1) {
      await page.getByRole('button', { name: /Open Weather Info/i }).click()
      await page.waitForTimeout(400)
      roots.add(await sceneRoot(page))
      await page.getByRole('button', { name: /Close Weather Info/i }).click()
      await page.waitForTimeout(400)
      roots.add(await sceneRoot(page))
    }
    expect(roots.size).toBe(1)
  })
})
