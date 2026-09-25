import { test, expect } from '@playwright/test'
import { gotoApp } from './support/app.js'

/**
 * The flowers.
 *
 * They used to be hexagonal discs of colour lying on the grass, which read
 * from an orbiting camera and fell apart the moment anyone stood in the park
 * in AR. What is checked here is that they are daisies: twelve petals, three
 * leaves, nothing below the ground, and colours that belong to the season
 * without disappearing into it.
 */

const daisy = (page) =>
  page.evaluate(async () => {
    const { getDaisyGeometry, PETAL_COUNT } = await import('/src/utils/daisy.js')
    const parts = getDaisyGeometry()
    const measure = (geometry) => {
      geometry.computeBoundingBox()
      return {
        vertices: geometry.attributes.position.count,
        min: geometry.boundingBox.min.toArray(),
        max: geometry.boundingBox.max.toArray()
      }
    }
    return {
      petalCount: PETAL_COUNT,
      petals: measure(parts.petals),
      eye: measure(parts.eye),
      leaves: measure(parts.leaves)
    }
  })

test.describe('Daisies', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page, '/?season=summer')
  })

  test('twelve petals and three leaves, all of them above the ground', async ({ page }) => {
    const parts = await daisy(page)

    expect(parts.petalCount).toBe(12)
    // Every petal is the same blade, so the merged head divides evenly by it.
    expect(parts.petals.vertices % parts.petalCount).toBe(0)
    expect(parts.leaves.vertices % 3).toBe(0)
    // The blade a leaf is cut from is the same one, at a different size.
    expect(parts.petals.vertices / parts.petalCount).toBe(parts.leaves.vertices / 3)

    // Nothing may hang below the grass it is planted in.
    for (const [name, part] of Object.entries(parts)) {
      if (name === 'petalCount') continue
      expect(part.min[1], `${name} sits on the ground`).toBeGreaterThanOrEqual(-0.001)
    }

    // The head is a bowl: the petals rise away from the middle rather than
    // lying flat, which is what makes them read from standing height.
    expect(parts.petals.max[1]).toBeGreaterThan(parts.petals.min[1] + 0.15)

    // Leaves reach past the petals, and stay below them.
    expect(parts.leaves.max[0]).toBeGreaterThan(parts.petals.max[0])
    expect(parts.leaves.max[1]).toBeLessThan(parts.petals.max[1])
  })

  test('one flower per bed, in three draw calls', async ({ page }) => {
    await expect
      .poll(() => page.evaluate(() => Boolean(window.__snowGlobeScene)), { timeout: 30000 })
      .toBe(true)

    const found = await page.evaluate(async () => {
      const { getDaisyGeometry } = await import('/src/utils/daisy.js')
      // By shape rather than by identity: a module imported from a test is
      // not guaranteed to be the same instance the app is holding.
      const sizes = new Set(
        Object.values(getDaisyGeometry()).map((geometry) => geometry.attributes.position.count)
      )
      const meshes = []
      window.__snowGlobeScene.traverse((object) => {
        if (object.isInstancedMesh && sizes.has(object.geometry.attributes.position.count)) {
          meshes.push({ count: object.count, coloured: Boolean(object.instanceColor) })
        }
      })
      return meshes
    })

    // Petals, eye and leaves: three meshes however many flowers are planted.
    expect(found).toHaveLength(3)
    expect(new Set(found.map((mesh) => mesh.count)).size, 'all three agree').toBe(1)
    expect(found[0].count).toBeGreaterThan(40)
    // The petals take a colour each; the other two do not need one.
    expect(found.filter((mesh) => mesh.coloured)).toHaveLength(1)
  })
})

test.describe('Seasonal colour', () => {
  test('flowers are painted like the rest of the park', async ({ page }) => {
    await gotoApp(page)

    const seasons = await page.evaluate(async () => {
      const { SEASON_PALETTES } = await import('/src/utils/seasons.js')
      const { hexToHsl } = await import('/src/utils/colorHarmony.js')
      return Object.entries(SEASON_PALETTES).map(([name, palette]) => ({
        name,
        showFlowers: palette.showFlowers,
        flowers: palette.flowers.map((colour) => ({ colour, ...hexToHsl(colour) })),
        canopy: palette.canopy.map((colour) => hexToHsl(colour)),
        bush: palette.bush.map((colour) => hexToHsl(colour)),
        grass: hexToHsl(palette.grass)
      }))
    })

    for (const season of seasons) {
      if (!season.showFlowers) {
        expect(season.flowers, `${season.name} has no flowers`).toEqual([])
        continue
      }

      expect(season.flowers.length, `${season.name} has a few to choose from`).toBeGreaterThan(3)
      const unique = new Set(season.flowers.map((flower) => flower.colour))
      expect(unique.size, `${season.name}'s flowers differ from each other`).toBe(
        season.flowers.length
      )

      // The trees and the bushes are painted in strong, flat colour. The beds
      // belong to the same park, so they are painted the same way: this is
      // what the derived pastels got wrong, and they read as something
      // dropped in from another scene.
      const strongest = Math.max(...season.canopy.concat(season.bush).map((tone) => tone.s))

      for (const flower of season.flowers) {
        const white = flower.s < 0.12
        if (!white) {
          expect(
            flower.s,
            `${season.name} ${flower.colour} is as saturated as the planting`
          ).toBeGreaterThan(strongest * 0.45)
        }

        // And it still has to be separable from the grass it stands in, by
        // hue or by light. The bar is low on purpose: spring's beds include a
        // lime that is deliberately close to new grass, and a rule strict
        // enough to reject it would reject half of what a real bed holds.
        const hueGap = Math.abs(flower.h - season.grass.h) % 1
        const distance = Math.min(hueGap, 1 - hueGap)
        expect(
          distance > 0.05 || flower.l > season.grass.l + 0.05,
          `${season.name} ${flower.colour} is not the grass`
        ).toBe(true)
      }
    }
  })

  test('the colour helpers do what the flowers assume', async ({ page }) => {
    await gotoApp(page)

    const result = await page.evaluate(async () => {
      const { hexToHsl, hslToHex, deepen } = await import('/src/utils/colorHarmony.js')
      const samples = ['#2d7a2f', '#c9682a', '#ffc2da', '#123456', '#ffffff', '#000000']
      return samples.map((colour) => ({
        colour,
        roundTrip: hslToHex(hexToHsl(colour)),
        deepened: hexToHsl(deepen(colour, 0.34)),
        original: hexToHsl(colour)
      }))
    })

    for (const sample of result) {
      expect(sample.roundTrip, `${sample.colour} survives the round trip`).toBe(sample.colour)
      // A leaf lying on the grass has to be darker than the grass, or it is
      // a patch of grass.
      expect(sample.deepened.l).toBeLessThanOrEqual(sample.original.l)
      expect(sample.deepened.h).toBeCloseTo(sample.original.h, 2)
    }
  })
})
