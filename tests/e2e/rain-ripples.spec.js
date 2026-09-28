import { test, expect } from '@playwright/test'
import { gotoApp } from './support/app.js'

/**
 * A ring where each drop lands, on whatever it lands on.
 *
 * There were ten rings, taken in turn, for sixteen hundred drops — so almost
 * every drop landed without a mark — and they all appeared at the same height
 * whatever the drop had actually hit.
 *
 * Getting them onto the right surface meant using the map of the city that
 * snow already had, and that map turned out to be broken in three ways at
 * once. Each one is pinned here.
 */

const surfaceMap = (page) =>
  page.evaluate(() => {
    // The app's own map, rather than one built here: a map measures heights
    // in the space of whatever it was anchored to, so a second one built
    // from somewhere else is not the same map.
    const field = window.__surfaceField
    if (!field) return { error: 'no map' }

    const heights = []
    for (let x = -30; x <= 30; x += 5) {
      for (let z = -30; z <= 30; z += 5) heights.push(field.sample(x, z))
    }

    return {
      error: null,
      built: field.built,
      cells: field.cells,
      middle: field.sample(0, 0),
      highest: Math.max(...heights),
      lowest: Math.min(...heights),
      // How many different heights it holds. The bug made every cell the
      // same one.
      variety: new Set(heights.map((height) => Math.round(height))).size,
      // Where the glass would be, if it had been mapped: the dome's own
      // ceiling, in the city's units.
      glass: 24.5 / 0.28
    }
  })

test.describe('The map of what is underneath', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page, '/?weather=rain')
    await expect
      .poll(() => page.evaluate(() => Boolean(window.__snowGlobePlanted)), { timeout: 45000 })
      .toBe(true)
    // The map is built a moment after the park finishes arriving.
    await expect
      .poll(() => page.evaluate(() => Boolean(window.__surfaceField)), { timeout: 20000 })
      .toBe(true)
  })

  test('it can be built at all', async ({ page }) => {
    const map = await surfaceMap(page)
    expect(map.error).toBeNull()

    // It could not before. Raycasting the city wholesale walks into its
    // sprites — the lamp halos, the glow behind the lettering — and a sprite
    // works out where it is from the camera, which a raycaster used like this
    // does not have. It threw on the first one, the map came back unbuilt,
    // and snow had been falling through the city rather than settling on it.
    expect(map.error).toBeNull()
    expect(map.built).toBeGreaterThan(0)
  })

  test('it maps the city, not the glass over it', async ({ page }) => {
    const map = await surfaceMap(page)

    // Built from the export root, every ray cast down from above the city hit
    // the inside of the dome first, and the whole map came back as one flat
    // ceiling: every cell the same height, two dozen units up. Rain spawned
    // above that, landed on it, and did it again on the next frame for ever.
    expect(map.highest, 'nothing as high as the glass').toBeLessThan(map.glass * 0.7)
    // The towers are real, though, and taller than the park.
    expect(map.highest).toBeGreaterThan(3)
    expect(map.lowest, 'and the ground is the ground').toBeLessThan(2)
    // A city is not a ceiling: roofs, canopies, paths and grass, all at
    // different heights.
    expect(map.variety, 'a map with a city in it').toBeGreaterThan(5)
  })

  test('the weather is not a surface', async ({ page }) => {
    const weather = await page.evaluate(() => {
      let flagged = 0
      let rainInside = false

      window.__snowGlobeScene.traverse((object) => {
        if (object.userData?.transient) flagged += 1
        if (object.isInstancedMesh && object.geometry?.type === 'ExtrudeGeometry') {
          let parent = object.parent
          while (parent) {
            if (parent.userData?.transient) {
              rainInside = true
              break
            }
            parent = parent.parent
          }
        }
      })

      return { flagged, rainInside }
    })

    // Without this a drop finds another drop overhead, calls it the ground,
    // and lands on it; the next spawns above that, and the shower climbs the
    // sky until it is falling from eighty units up.
    expect(weather.flagged).toBeGreaterThan(0)
    expect(weather.rainInside, 'the rain is inside the part that is skipped').toBe(true)
  })
})

test.describe('Rings where the rain lands', () => {
  test('one mesh, hundreds of rings, each fading on its own', async ({ page }) => {
    await gotoApp(page, '/?weather=rain')
    await expect
      .poll(() => page.evaluate(() => Boolean(window.__snowGlobeScene)), { timeout: 30000 })
      .toBe(true)
    await page.waitForTimeout(4000)

    const rings = await page.evaluate(() => {
      const found = []
      window.__snowGlobeScene.traverse((object) => {
        const alpha = object.geometry?.attributes?.aAlpha
        if (!object.isInstancedMesh || !alpha) return
        let live = 0
        let brightest = 0
        for (let i = 0; i < alpha.count; i += 1) {
          if (alpha.array[i] > 0) live += 1
          brightest = Math.max(brightest, alpha.array[i])
        }
        found.push({ capacity: alpha.count, live, brightest })
      })
      return found
    })

    expect(rings, 'one instanced mesh for the lot').toHaveLength(1)
    // Room for hundreds at once. There were ten.
    expect(rings[0].capacity).toBeGreaterThan(100)
    // It is raining, so some of them are showing.
    expect(rings[0].live).toBeGreaterThan(0)
    // A ring carries its own transparency, because a material's opacity is
    // one number for every instance sharing it.
    expect(rings[0].brightest).toBeGreaterThan(0)
    expect(rings[0].brightest).toBeLessThanOrEqual(1)
  })

  test('a ring is the size of a splash, not a puddle', async ({ page }) => {
    await gotoApp(page, '/?weather=rain')
    const source = await (await page.request.get('/src/components/WeatherEffects.jsx')).text()

    // The spread is how far a ring opens over its life. At the metre and a
    // half it started out at, they read as puddles opening in the grass.
    const spread = source.match(/ripples\.spread\[slot\] = ([\d.]+) \+ Math\.random\(\) \* ([\d.]+)/)
    expect(spread, 'a ring opens by a stated amount').not.toBeNull()
    expect(Number(spread[1]) + Number(spread[2])).toBeLessThan(0.6)
  })
})
