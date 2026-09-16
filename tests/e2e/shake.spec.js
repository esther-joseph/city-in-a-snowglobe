import { test, expect } from '@playwright/test'
import { gotoApp, openDrawer } from './support/app.js'

/**
 * The shake must start when the button is pressed — and only then.
 *
 * BaseScene and ShakeableScene are declared inside App, so every App render
 * creates a new component type and React remounts the whole 3D subtree. The
 * effects that drive the spin then run again on a shakeTrigger that has not
 * changed, which used to restart the animation: the globe would lurch on its
 * own whenever anything re-rendered App, long after the button was pressed.
 */

const SHAKE_BUTTON = /Shake/i

/** Peak angular speed in the scene, in radians per second. */
async function peakSpin(page, windowMs = 500) {
  return page.evaluate(async (wait) => {
    const scene = window.__snowGlobeScene
    const before = new Map()
    scene.traverse((object) => before.set(object.uuid, object.rotation.y))
    await new Promise((resolve) => setTimeout(resolve, wait))
    let peak = 0
    scene.traverse((object) => {
      if (!before.has(object.uuid)) return
      const delta = Math.abs(object.rotation.y - before.get(object.uuid))
      if (delta > peak) peak = delta
    })
    return peak * (1000 / wait)
  }, windowMs)
}

/** Re-render App without touching the globe: the drawer's time slider. */
async function moveTimeSlider(page, hour) {
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
}

// The city lettering turns continuously at 0.15 rad/s, so idle is never zero.
const IDLE_CEILING = 1
const SPINNING_FLOOR = 3
// Long enough for both the 1.4s globe spin and the 3.2s snow tumble to finish.
const SHAKE_SETTLE_MS = 4500

test.describe('Shake snow globe', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
    await expect
      .poll(() => page.evaluate(() => Boolean(window.__snowGlobeScene)), {
        timeout: 20000
      })
      .toBe(true)
  })

  test('spins the globe when the button is pressed', async ({ page }) => {
    expect(await peakSpin(page)).toBeLessThan(IDLE_CEILING)

    await page.getByRole('button', { name: SHAKE_BUTTON }).click()
    expect(await peakSpin(page, 400)).toBeGreaterThan(SPINNING_FLOOR)

    await page.waitForTimeout(SHAKE_SETTLE_MS)
    expect(await peakSpin(page)).toBeLessThan(IDLE_CEILING)
  })

  test('does not spin again when something else re-renders the scene', async ({
    page
  }) => {
    await page.getByRole('button', { name: SHAKE_BUTTON }).click()
    await page.waitForTimeout(SHAKE_SETTLE_MS)
    expect(await peakSpin(page)).toBeLessThan(IDLE_CEILING)

    // Opened afterwards: on a phone the drawer covers the shake button.
    await openDrawer(page)

    for (const hour of [10, 14, 18]) {
      await moveTimeSlider(page, hour)
      await page.waitForTimeout(200)
      expect(await peakSpin(page, 400)).toBeLessThan(IDLE_CEILING)
    }
  })
})
