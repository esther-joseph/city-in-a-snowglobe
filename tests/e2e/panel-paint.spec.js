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

  test('the aura is lit by gradients and moved by transform alone', async ({ page }) => {
    await openDrawer(page)

    const aura = await page.evaluate(() => {
      const pools = [...document.querySelectorAll('.drawer-aura__pool')]
      const frame = document.querySelector('[data-testid="drawer-aura"]')
      if (!pools.length || !frame) return null

      return {
        count: pools.length,
        // Not one of them blurred. A filter: blur() over a live canvas is
        // re-rendered every frame it moves, which is the cost this whole
        // panel was rebuilt once to avoid; a radial gradient is soft for
        // free.
        filters: pools.map((pool) => getComputedStyle(pool).filter),
        backdrops: pools.map((pool) => getComputedStyle(pool).backdropFilter),
        // Long, uneven periods, so three pools never line up into a pulse.
        durations: pools.map((pool) => getComputedStyle(pool).animationDuration),
        // Decorative: announced to nobody, and it swallows no taps meant for
        // the cards above it.
        hidden: frame.getAttribute('aria-hidden'),
        pointerEvents: getComputedStyle(frame).pointerEvents,
        // Behind the content, which sits on its own layer above it.
        auraZ: getComputedStyle(frame).zIndex
      }
    })

    expect(aura, 'the aura is in the panel').not.toBeNull()
    expect(aura.count).toBeGreaterThanOrEqual(2)
    for (const filter of aura.filters) expect(filter).toBe('none')
    for (const backdrop of aura.backdrops) expect(['none', '']).toContain(backdrop)

    const seconds = aura.durations.map((value) => parseFloat(value))
    // Slow enough to be noticed once and then forgotten.
    for (const duration of seconds) expect(duration).toBeGreaterThan(20)
    expect(new Set(seconds).size, 'no two share a period').toBe(seconds.length)

    expect(aura.hidden).toBe('true')
    expect(aura.pointerEvents).toBe('none')
    expect(Number(aura.auraZ)).toBe(0)
  })

  test('a reader who asked for stillness gets stillness', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await openDrawer(page)

    const animations = await page.evaluate(() =>
      [...document.querySelectorAll('.drawer-aura__pool')].map(
        (pool) => getComputedStyle(pool).animationName
      )
    )

    // The colour stays — the colour is not the animation.
    for (const name of animations) expect(name).toBe('none')
  })
})
