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

  test('the whole park of them costs three draw calls', async ({ page }) => {
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

    // Petals, eye and leaves: three meshes however many are planted, across
    // however many beds.
    expect(found).toHaveLength(3)
    expect(new Set(found.map((mesh) => mesh.count)).size, 'all three agree').toBe(1)
    expect(found[0].count, 'a park full of flowers').toBeGreaterThan(40)
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

/**
 * The beds themselves.
 *
 * A park's formal planting goes where everyone passes it, which here is the
 * first band of grass outside the fountain's paving: a ring of cut plots,
 * edged in iron, each planted in rings of one colour at a time. Further out
 * the park is informal and the flowers are clumps on the grass.
 */
test.describe('Flower beds', () => {
  const layout = (page) =>
    page.evaluate(async () => {
      const { placeBedPlots, plantBeds } = await import('/src/utils/flowerBeds.js')
      const { SEASON_PALETTES, SEASONS } = await import('/src/utils/seasons.js')

      // Placement without obstacles: what the plots are before the park gets
      // in the way.
      const plots = placeBedPlots({
        place: (angle, distance, radius) => [
          Math.cos(angle) * distance,
          Math.sin(angle) * distance
        ]
      })

      return plantBeds(plots, SEASON_PALETTES[SEASONS.SUMMER].flowers)
    })

  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('the beds ring the fountain, on the grass', async ({ page }) => {
    const { beds, fountain, grass } = await page.evaluate(async () => {
      const { placeBedPlots } = await import('/src/utils/flowerBeds.js')
      const { FOUNTAIN_RING, GRASS_BAND, fitsOnGrass } = await import(
        '/src/utils/parkLayout.js'
      )

      const plots = placeBedPlots({
        place: (angle, distance, radius) =>
          fitsOnGrass(Math.cos(angle) * distance, Math.sin(angle) * distance, radius)
            ? [Math.cos(angle) * distance, Math.sin(angle) * distance]
            : null
      })

      return {
        fountain: FOUNTAIN_RING,
        grass: GRASS_BAND,
        beds: plots.map((plot) => ({
          radius: plot.radius,
          distance: Math.hypot(plot.at[0], plot.at[1])
        }))
      }
    })

    expect(beds.length, 'a ring of them').toBeGreaterThanOrEqual(6)

    for (const bed of beds) {
      // Off the paving around the water, and not out among the trees: the
      // whole plot sits in the first band of grass.
      expect(bed.distance - bed.radius, 'clear of the fountain paving').toBeGreaterThan(
        fountain.outer
      )
      expect(bed.distance - bed.radius, 'and close to it').toBeLessThan(fountain.outer + 0.8)
      expect(bed.distance + bed.radius, 'inside the grass').toBeLessThan(grass.outer)
    }

    // All at the same distance: it is a ring, not a scattering.
    const distances = beds.map((bed) => bed.distance)
    expect(Math.max(...distances) - Math.min(...distances)).toBeLessThan(0.001)
  })

  test('a bed is a plot with its planting inside it', async ({ page }) => {
    const beds = await layout(page)

    expect(beds.length, 'beds around the park').toBeGreaterThanOrEqual(6)

    for (const bed of beds) {
      expect(bed.flowers.length, 'a bed is planted, not decorated').toBeGreaterThan(10)

      for (const flower of bed.flowers) {
        const reach = Math.hypot(flower.position[0] - bed.at[0], flower.position[2] - bed.at[1])
        // Inside the edging, with a margin of bare earth: a flower growing
        // through the fence is a weed.
        expect(reach + flower.scale * 0.5).toBeLessThan(bed.radius)
      }
    }
  })

  test('the planting is in blocks of colour, not a mixture', async ({ page }) => {
    const beds = await layout(page)

    for (const bed of beds) {
      const colours = new Set(bed.flowers.map((flower) => flower.color))
      // Two: a heart and a ring around it. Bedding is planted in blocks.
      expect(colours.size, 'one or two colours to a bed').toBeLessThanOrEqual(2)
    }

    // And variety across the park rather than within a bed.
    const across = new Set(beds.flatMap((bed) => bed.flowers.map((flower) => flower.color)))
    expect(across.size, 'the beds are not all the same').toBeGreaterThan(2)
  })

  test('every bed is edged, all the way round', async ({ page }) => {
    await expect
      .poll(() => page.evaluate(() => Boolean(window.__snowGlobeScene)), { timeout: 30000 })
      .toBe(true)

    const edging = await page.evaluate(async () => {
      const THREE = await import('/node_modules/.vite/deps/three.js')
      const matrix = new THREE.Matrix4()
      const place = new THREE.Vector3()
      const scale = new THREE.Vector3()

      let hoops = null
      const plots = []

      window.__snowGlobeScene.traverse((object) => {
        if (!object.isInstancedMesh) return
        const parameters = object.geometry?.parameters

        // The edging: half loops of iron.
        if (parameters?.arc !== undefined && parameters.arc < Math.PI * 1.01) {
          const found = []
          for (let i = 0; i < object.count; i += 1) {
            object.getMatrixAt(i, matrix)
            place.setFromMatrixPosition(matrix)
            found.push({ x: place.x, y: place.y, z: place.z })
          }
          hoops = { count: object.count, radius: parameters.radius, at: found }
          return
        }

        // The plots: low discs of turned earth.
        if (parameters?.height === 0.06 && parameters.radialSegments === 20) {
          for (let i = 0; i < object.count; i += 1) {
            object.getMatrixAt(i, matrix)
            place.setFromMatrixPosition(matrix)
            scale.setFromMatrixScale(matrix)
            plots.push({ x: place.x, z: place.z, radius: scale.x })
          }
        }
      })

      return { hoops, plots }
    })

    expect(edging.plots.length, 'plots of earth').toBeGreaterThanOrEqual(6)
    expect(edging.hoops, 'iron hoops').not.toBeNull()

    for (const plot of edging.plots) {
      const mine = edging.hoops.at.filter(
        (hoop) => Math.hypot(hoop.x - plot.x, hoop.z - plot.z) < plot.radius + 0.2
      )

      // Enough loops to close the circle: they are set side by side, so the
      // count follows from the plot's circumference.
      const expected = Math.round((Math.PI * 2 * plot.radius) / (edging.hoops.radius * 2))
      expect(mine.length, 'a run of loops around the plot').toBeGreaterThanOrEqual(expected - 1)

      // All of them standing on the edge, none out in the middle.
      for (const hoop of mine) {
        const reach = Math.hypot(hoop.x - plot.x, hoop.z - plot.z)
        expect(Math.abs(reach - plot.radius)).toBeLessThan(0.05)
        // Low. It is there to say where the bed ends, not to keep anyone out.
        expect(hoop.y).toBeLessThan(0.2)
      }
    }
  })
})

/**
 * And the flowers that are not in a bed.
 *
 * Out past the beds the park is informal. It used to be single daisies evenly
 * spaced around three rings, which reads as a pattern rather than as
 * planting. They come up in clumps now: one here, three there, all of a
 * clump the same colour, because a clump is one plant that has spread.
 */
test.describe('Clumps on the grass', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('a clump is one, two or three flowers of one colour', async ({ page }) => {
    const clumps = await page.evaluate(async () => {
      const { clumpAt } = await import('/src/utils/flowerClusters.js')

      // A fixed sequence rather than chance, so the sizes are all covered.
      const sizes = []
      for (let seed = 0; seed < 40; seed += 1) {
        let step = 0
        const random = () => {
          step += 1
          return ((seed * 7 + step * 13) % 100) / 100
        }
        const clump = clumpAt({ at: [3, 4], radius: 0.28, color: '#ff6b8a', random })
        sizes.push({
          count: clump.length,
          colours: new Set(clump.map((flower) => flower.color)).size,
          // How far the furthest flower's own circle reaches from the middle
          // of the spot that was cleared for it.
          reach: Math.max(
            ...clump.map(
              (flower) =>
                Math.hypot(flower.position[0] - 3, flower.position[2] - 4) + flower.scale * 0.5
            )
          ),
          turns: new Set(clump.map((flower) => flower.yaw)).size,
          heights: new Set(clump.map((flower) => flower.position[1])).size
        })
      }
      return sizes
    })

    const counts = new Set(clumps.map((clump) => clump.count))
    expect([...counts].sort(), 'ones, twos and threes').toEqual([1, 2, 3])

    for (const clump of clumps) {
      expect(clump.colours, 'a clump is one plant').toBe(1)
      // It has to fit in the spot the planting cleared for it, or a clump of
      // three overhangs a path the single flower did not.
      expect(clump.reach, 'inside the spot it was given').toBeLessThanOrEqual(0.28)
      expect(clump.turns, 'each one faces its own way').toBe(clump.count)
      expect(clump.heights, 'all of them on the ground').toBe(1)
    }
  })

  test('the clumps are scattered clear of the beds', async ({ page }) => {
    const rings = await page.evaluate(async () => {
      const { scatterFlowers } = await import('/src/utils/flowerClusters.js')

      const flowers = scatterFlowers({
        palette: ['#ff6b8a', '#ffcd3c', '#c084fc'],
        place: (angle, distance) => [Math.cos(angle) * distance, Math.sin(angle) * distance]
      })

      return flowers.map((flower) => Math.hypot(flower.position[0], flower.position[2]))
    })

    expect(rings.length, 'a park full of them').toBeGreaterThan(80)
    // The beds reach to about eight; nothing scattered starts inside that.
    expect(Math.min(...rings), 'clear of the beds').toBeGreaterThan(8.2)
    expect(Math.max(...rings), 'and inside the park').toBeLessThan(16)
  })
})
