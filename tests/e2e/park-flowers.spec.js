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
  test('flowers are lighter than the trees they stand under', async ({ page }) => {
    await gotoApp(page)

    const seasons = await page.evaluate(async () => {
      const { SEASON_PALETTES } = await import('/src/utils/seasons.js')
      const { hexToHsl } = await import('/src/utils/colorHarmony.js')
      return Object.entries(SEASON_PALETTES).map(([name, palette]) => ({
        name,
        showFlowers: palette.showFlowers,
        flowers: palette.flowers.map((colour) => ({ colour, ...hexToHsl(colour) })),
        canopy: palette.canopy.map((colour) => hexToHsl(colour)),
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

      for (const flower of season.flowers) {
        // Pale, but still a colour rather than white.
        expect(flower.l, `${season.name} ${flower.colour} is light`).toBeGreaterThan(0.65)
        expect(flower.s, `${season.name} ${flower.colour} keeps its hue`).toBeGreaterThan(0.2)

        // Lighter than the grass it sits on, or it is not a flower, it is
        // a patch of lawn.
        expect(flower.l, `${season.name} ${flower.colour} reads against the grass`).toBeGreaterThan(
          season.grass.l + 0.15
        )
      }

      // At least one of them sits across the wheel from the canopy. Same
      // family throughout would vanish into the planting.
      const canopyHue = season.canopy[0].h
      const distance = (hue) => {
        const gap = Math.abs(hue - canopyHue) % 1
        return Math.min(gap, 1 - gap)
      }
      const furthest = Math.max(...season.flowers.map((flower) => distance(flower.h)))
      expect(furthest, `${season.name} has a complementary note`).toBeGreaterThan(0.2)
    }
  })

  test('the helpers do what the palettes assume', async ({ page }) => {
    await gotoApp(page)

    const result = await page.evaluate(async () => {
      const { hexToHsl, hslToHex, pastel, deepen, complementOf } = await import(
        '/src/utils/colorHarmony.js'
      )
      const samples = ['#2d7a2f', '#c9682a', '#ffc2da', '#123456', '#ffffff', '#000000']
      return samples.map((colour) => ({
        colour,
        roundTrip: hslToHex(hexToHsl(colour)),
        pastel: hexToHsl(pastel(colour)),
        deepened: hexToHsl(deepen(colour, 0.34)),
        original: hexToHsl(colour),
        // Hue is a circle: a colour at 0.9 turned by 0.42 lands at 0.32, and
        // a plain subtraction calls that a turn of 0.58.
        complementGap: ((hexToHsl(complementOf(colour)).h - hexToHsl(colour).h) % 1 + 1) % 1
      }))
    })

    for (const sample of result) {
      expect(sample.roundTrip, `${sample.colour} survives the round trip`).toBe(sample.colour)
      // Every pastel lands in the same register whatever it started as.
      expect(sample.pastel.l).toBeCloseTo(0.79, 2)
      expect(sample.deepened.l).toBeLessThanOrEqual(sample.original.l)
      // Hex is only so precise; the hue lands where it was asked to within a
      // step of the eight-bit grid it has to be written into.
      // White and black have no hue to turn, and turning them returns them.
      if (sample.original.s > 0.05) {
        expect(sample.complementGap, `${sample.colour} turns`).toBeCloseTo(0.42, 2)
      } else {
        expect(sample.complementGap, `${sample.colour} has no hue to turn`).toBe(0)
      }
    }
  })
})
