import { test, expect } from '@playwright/test'
import { gotoApp } from './support/app.js'

/**
 * Nothing may be planted on a path.
 *
 * The old test measured the trunk against a fixed margin of 1.1 and knew
 * nothing about how wide a crown is. A full-size tree reaches about two units,
 * so trees cleared the centre line by a metre and overhung the paving by one —
 * and the outer ring sat at a radius that put its canopies over the perimeter
 * walkway entirely.
 *
 * What is asserted is the contract the planting relies on: whatever
 * placeOnGrass returns, fitsOnGrass must accept.
 */

const park = (page) =>
  page.evaluate(() => import('/src/utils/parkLayout.js'))

test.describe('Park planting', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('every placement it returns is clear of the paths and on the grass', async ({
    page
  }) => {
    const result = await page.evaluate(async () => {
      const { placeOnGrass, fitsOnGrass, canopyRadius } = await import(
        '/src/utils/parkLayout.js'
      )

      let placed = 0
      const failures = []
      // The whole range the park plants across: accent trees at 1.3 through
      // full-size ones at 2.9, at every angle.
      for (let step = 0; step < 720; step += 1) {
        const angle = (step / 720) * Math.PI * 2
        const foliageScale = 1.3 + (step % 17) * 0.1
        const radius = canopyRadius(foliageScale)
        const distance = 8 + (step % 11)
        const spot = placeOnGrass(angle, distance, radius)
        if (!spot) continue
        placed += 1
        if (!fitsOnGrass(spot[0], spot[1], radius)) {
          failures.push({ angle, foliageScale, spot })
        }
      }
      return { placed, failures }
    })

    expect(result.placed).toBeGreaterThan(500)
    expect(result.failures).toEqual([])
  })

  test('the old placement would not have passed', async ({ page }) => {
    const fits = await page.evaluate(async () => {
      const { fitsOnGrass, canopyRadius } = await import('/src/utils/parkLayout.js')
      // Where the outer ring used to sit: radius 16, full-size canopy.
      return fitsOnGrass(16, 0.2, canopyRadius(2.9))
    })
    expect(fits).toBe(false)
  })

  test('a crown too wide for the band is refused rather than squeezed', async ({
    page
  }) => {
    const spot = await page.evaluate(async () => {
      const { placeOnGrass } = await import('/src/utils/parkLayout.js')
      // The grass band is about eleven units across; nothing this wide fits.
      return placeOnGrass(0.4, 12, 9)
    })
    expect(spot).toBeNull()
  })

  test('the drawn paths and the planting rule read the same numbers', async ({
    page
  }) => {
    const layout = await park(page)
    expect(layout.GRASS_BAND.inner).toBe(layout.FOUNTAIN_RING.outer)
    expect(layout.GRASS_BAND.outer).toBe(layout.PERIMETER_WALK.inner)
    expect(layout.RADIAL_PATH.start).toBe(layout.FOUNTAIN_RING.inner)
    expect(layout.RADIAL_PATH.end).toBe(layout.PERIMETER_WALK.outer)
  })
})
