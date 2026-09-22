import { test, expect } from '@playwright/test'
import { gotoApp, openDrawer } from './support/app.js'

/**
 * What the panel asks the compositor for while it scrolls.
 *
 * A backdrop-filter has to re-sample whatever sits behind it whenever that
 * changes, and behind this panel is a WebGL canvas repainting continuously.
 * Ten blurred surfaces stacked over a live scene, re-blurred on every frame of
 * a scroll, was the most expensive thing on the page.
 *
 * Frame rate cannot be asserted here: this harness pins requestAnimationFrame
 * to about ten a second whether the page is idle or scrolling, so there is no
 * signal to measure against. What is asserted instead is the cause, which is
 * countable and is what would come back if someone reached for blur again.
 */

test.describe('Panel paint cost', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
    await openDrawer(page)
  })

  test('nothing inside the panel blurs what is behind it', async ({ page }) => {
    const blurred = await page.evaluate(() => {
      const panel = document.querySelector('.overflow-y-auto')
      return Array.from(panel.querySelectorAll('*'))
        .filter((element) => {
          const style = getComputedStyle(element)
          return style.backdropFilter && style.backdropFilter !== 'none'
        })
        .map((element) => element.className.toString().slice(0, 40))
    })

    expect(blurred, 'blurred surfaces over the live canvas').toEqual([])
  })

  test('the cards are still dark enough to read against the scene', async ({ page }) => {
    // Losing the blur only works if the backgrounds carry the contrast on
    // their own, so this is the other half of that change.
    const alpha = await page.evaluate(() => {
      const card = document.querySelector('.weather-info')
      const match = getComputedStyle(card).backgroundColor.match(/[\d.]+/g)
      return match.length === 4 ? Number(match[3]) : 1
    })
    expect(alpha).toBeGreaterThanOrEqual(0.75)
  })
})
