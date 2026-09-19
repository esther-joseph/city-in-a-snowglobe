import { test, expect } from '@playwright/test'
import { gotoApp } from './support/app.js'

/**
 * Clouds and stars drift across the sky and wrap at the edges.
 *
 * The wrap used to clamp to the boundary — `if (x > limit) x = -limit` —
 * which threw away however far past the edge a body had travelled. That is
 * invisible frame to frame, and catastrophic after a long one: coming back to
 * a backgrounded tab delivers a single delta covering the whole absence, every
 * cloud clears the edge in that one step, and every one of them lands on
 * exactly the same coordinate. The whole sky ends up in a single clump.
 *
 * Reproducing it end to end needs a stall of about thirty seconds, which is
 * too slow for this suite. What is asserted here is the property that failed:
 * wrapping must preserve the distance between two bodies, however far they
 * have gone.
 */

/** Load the module under test out of the running dev server. */
const sky = (page) => page.evaluate(() => import('/src/components/WeatherEffects.jsx'))

test.describe('Sky drift', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('wrapping keeps a coordinate inside the span', async ({ page }) => {
    const results = await page.evaluate(async () => {
      const { wrapCoordinate } = await import('/src/components/WeatherEffects.jsx')
      // A minute away at speed puts a body hundreds of units past the edge.
      return [0, 51.9, 52.1, 300, -300, 5000, -5000].map((value) => ({
        value,
        wrapped: wrapCoordinate(value, 52)
      }))
    })

    for (const { value, wrapped } of results) {
      expect(Math.abs(wrapped), `wrapping ${value}`).toBeLessThanOrEqual(52)
    }
  })

  test('wrapping preserves the gap between two bodies', async ({ page }) => {
    const gaps = await page.evaluate(async () => {
      const { wrapCoordinate } = await import('/src/components/WeatherEffects.jsx')
      const limit = 52
      // Two bodies ten apart, carried past the edge together by one long
      // frame. Clamping put both on -52 and closed the gap to zero.
      return [60, 200, 1000, 9999].map((jump) => {
        const a = wrapCoordinate(10 + jump, limit)
        const b = wrapCoordinate(20 + jump, limit)
        const span = limit * 2
        // The gap is 10 either directly or the long way round the span.
        const raw = Math.abs(b - a)
        return Math.min(raw, span - raw)
      })
    })

    for (const gap of gaps) {
      expect(gap).toBeCloseTo(10, 5)
    }
  })

  test('a frame is clamped so an absence cannot teleport the sky', async ({ page }) => {
    const max = await page.evaluate(async () => {
      const { MAX_FRAME_SECONDS } = await import('/src/components/WeatherEffects.jsx')
      return MAX_FRAME_SECONDS
    })
    expect(max).toBeGreaterThan(0)
    // A backgrounded tab returns a delta of minutes; anything above a frame or
    // two defeats the purpose.
    expect(max).toBeLessThanOrEqual(0.1)
  })

  test('the sky does not reload the page on its own', async ({ page }) => {
    // StarLayer used to call window.location.reload() when the generated
    // spread looked degenerate — a workaround for this same pile-up, aimed at
    // the wrong cause.
    const source = await page.evaluate(async () => {
      const response = await fetch('/src/components/WeatherEffects.jsx')
      return response.text()
    })
    expect(source).not.toContain('location.reload')
  })
})
