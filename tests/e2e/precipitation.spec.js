import { test, expect } from '@playwright/test'
import { gotoApp } from './support/app.js'

/**
 * Nothing falls out of clear sky.
 *
 * Rain, snow and lightning each had their own patch of sky and their own
 * fixed height to fall from: rain over a disc of radius 32, snow over a
 * square of 80, bolts over another. The clouds sat in a ring out near the
 * glass, over nothing. So it rained everywhere except under a cloud.
 *
 * Now the clouds say where they are on every frame, because they drift and
 * wrap, and everything that falls asks for a cloud to fall out of.
 */

const field = (page, clouds) =>
  page.evaluate(async (clouds) => {
    const module = await import('/src/utils/cloudField.js')
    return { module: Object.keys(module), clouds }
  }, clouds)

test.describe('Falling out of a cloud', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('a drop starts under a cloud, inside its own footprint', async ({ page }) => {
    const sampled = await page.evaluate(async () => {
      const { sampleUnderCloud } = await import('/src/utils/cloudField.js')
      const cloud = { x: 12, y: 30, z: -7, radius: 6 }
      const field = { clouds: [cloud] }

      const points = Array.from({ length: 400 }, () => sampleUnderCloud(field))
      return {
        cloud,
        outside: points.filter(
          (point) => Math.hypot(point.x - cloud.x, point.z - cloud.z) > cloud.radius + 1e-9
        ).length,
        heights: new Set(points.map((point) => point.y)).size,
        // How far out they land on average, as a fraction of the footprint.
        meanReach:
          points.reduce(
            (total, point) => total + Math.hypot(point.x - cloud.x, point.z - cloud.z),
            0
          ) /
          points.length /
          cloud.radius
      }
    })

    expect(sampled.outside, 'none of them beside the cloud').toBe(0)
    // All at the cloud's underside: the fall starts there and goes down.
    expect(sampled.heights).toBe(1)
    // Two thirds out, which is what an even spread over a disc gives. A
    // straight random radius would pile them into the middle at a half.
    expect(sampled.meanReach).toBeGreaterThan(0.6)
    expect(sampled.meanReach).toBeLessThan(0.73)
  })

  test('a clear sky is answered honestly', async ({ page }) => {
    const answers = await page.evaluate(async () => {
      const { sampleUnderCloud, seedUnderClouds } = await import('/src/utils/cloudField.js')
      return {
        empty: sampleUnderCloud({ clouds: [] }),
        missing: sampleUnderCloud(undefined),
        seeded: seedUnderClouds({ clouds: [] }, new Float32Array(30), 10)
      }
    })

    // Null rather than a guess: forced rain with the clouds turned off still
    // has to rain, and the caller falls back to its own patch of sky.
    expect(answers.empty).toBeNull()
    expect(answers.missing).toBeNull()
    expect(answers.seeded).toBe(false)
  })

  test('every cloud gets its turn', async ({ page }) => {
    const spread = await page.evaluate(async () => {
      const { sampleUnderCloud } = await import('/src/utils/cloudField.js')
      const clouds = [
        { x: -30, y: 30, z: 0, radius: 2 },
        { x: 0, y: 32, z: 0, radius: 2 },
        { x: 30, y: 28, z: 0, radius: 2 }
      ]
      const used = new Set()
      for (let i = 0; i < 300; i += 1) {
        const point = sampleUnderCloud({ clouds })
        used.add(clouds.findIndex((cloud) => Math.abs(point.x - cloud.x) <= cloud.radius))
      }
      return [...used].sort()
    })

    expect(spread, 'the rain is not all coming out of one of them').toEqual([0, 1, 2])
  })

  test('the column under a cloud is filled, not left in the sky', async ({ page }) => {
    const seeded = await page.evaluate(async () => {
      const { seedUnderClouds } = await import('/src/utils/cloudField.js')
      const cloud = { x: 0, y: 40, z: 0, radius: 5 }
      const positions = new Float32Array(200 * 3)
      // As they start: scattered through the sky, above the clouds and all.
      for (let i = 0; i < 200; i += 1) positions[i * 3 + 1] = 60 + i

      const ok = seedUnderClouds({ clouds: [cloud] }, positions, 200)

      let above = 0
      let below = 0
      let lowest = Infinity
      let highest = -Infinity
      for (let i = 0; i < 200; i += 1) {
        const y = positions[i * 3 + 1]
        if (y > cloud.y) above += 1
        if (y < 0) below += 1
        lowest = Math.min(lowest, y)
        highest = Math.max(highest, y)
      }
      return { ok, above, below, lowest, highest, cloudY: cloud.y }
    })

    expect(seeded.ok).toBe(true)
    // Nothing left above the cloud it is supposed to be falling out of: a
    // bolt drifting down from eighty units up is most of a minute of
    // lightning in a clear sky before it recycles.
    expect(seeded.above).toBe(0)
    expect(seeded.below).toBe(0)
    // And spread down the column rather than stacked at the cloud, which is
    // the state a steady fall settles into.
    expect(seeded.lowest).toBeLessThan(seeded.cloudY * 0.25)
    expect(seeded.highest).toBeGreaterThan(seeded.cloudY * 0.75)
  })

  test('a cloud publishes where it is now, and how wide', async ({ page }) => {
    const published = await page.evaluate(async () => {
      const { createCloudField, publishCloud } = await import('/src/utils/cloudField.js')
      const field = createCloudField()

      // A cloud that has drifted and wrapped since it was placed.
      publishCloud(field, 0, { position: { x: 41, y: 33, z: -12 } }, 3)
      const first = { ...field.clouds[0] }
      publishCloud(field, 0, { position: { x: -50, y: 33, z: -12 } }, 3)

      return { first, second: field.clouds[0], count: field.clouds.length }
    })

    // The underside, not the middle: what falls out starts below it.
    expect(published.first.y).toBeLessThan(33)
    expect(published.first.radius).toBeGreaterThan(0)
    // One slot per cloud, overwritten in place: this runs every frame for
    // every cloud, and a list that grew would be a leak with a view.
    expect(published.count).toBe(1)
    expect(published.second.x).toBe(-50)
  })

  test('the clouds are spread over the sky, not ringed around it', async ({ page }) => {
    const source = await (await page.request.get('/src/components/WeatherEffects.jsx')).text()

    // They used to be placed at a radius of forty-odd with a little jitter,
    // which put every one of them out by the glass with nothing above the
    // city. Now that the rain comes out of them, that would have left the
    // city dry and rained on the dome.
    expect(source).not.toContain('baseRadius + Math.random() * radiusJitter')
    expect(source).toContain('Math.sqrt(Math.random()) * spread')
  })
})

/**
 * And none of it outside the glass.
 *
 * The dome is a ball sitting most of the way above the floor, so it is a good
 * deal narrower where the rain lands than where it starts: fifty-one units
 * across up among the clouds, thirty-eight down at the ground. Rain was
 * falling from as far out as forty-six, so whole columns of it came down
 * outside the ornament and ran past the rim and the wooden base.
 */
test.describe('Contained by the glass', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('the glass is narrower at the floor than at the clouds', async ({ page }) => {
    const glass = await page.evaluate(async () => {
      const { glassRadiusAt, FALL_RADIUS, GLASS } = await import('/src/utils/globeInterior.js')
      return {
        atFloor: glassRadiusAt(0),
        atClouds: glassRadiusAt(35),
        aboveTheTop: glassRadiusAt(GLASS.centreY + GLASS.radius + 1),
        fall: FALL_RADIUS
      }
    })

    expect(glass.atFloor).toBeGreaterThan(0)
    expect(glass.atClouds, 'wider up where the clouds are').toBeGreaterThan(glass.atFloor)
    expect(glass.aboveTheTop, 'nothing at all above the dome').toBe(0)

    // What falls is measured against the floor, because a drop falls straight
    // down: a column that fits where it starts but not where it lands still
    // ends up outside.
    expect(glass.fall).toBeLessThan(glass.atFloor)
    expect(glass.fall).toBeGreaterThan(glass.atFloor - 5)
  })

  test('a cloud that overhangs the glass rains on the city anyway', async ({ page }) => {
    const rained = await page.evaluate(async () => {
      const { sampleUnderCloud, createCloudField } = await import('/src/utils/cloudField.js')
      const { FALL_RADIUS } = await import('/src/utils/globeInterior.js')

      // A cloud sitting right out at the edge, where the dome is wide.
      const field = createCloudField(FALL_RADIUS)
      field.clouds = [{ x: FALL_RADIUS + 6, y: 34, z: 0, radius: 8 }]

      const points = Array.from({ length: 200 }, () => sampleUnderCloud(field))
      return {
        limit: FALL_RADIUS,
        furthest: Math.max(...points.map((point) => Math.hypot(point.x, point.z))),
        // Still under the cloud it came from, rather than dropped in the middle.
        nearest: Math.min(...points.map((point) => Math.hypot(point.x, point.z)))
      }
    })

    expect(rained.furthest).toBeLessThanOrEqual(rained.limit + 1e-9)
    expect(rained.nearest, 'pulled in, not moved to the middle').toBeGreaterThan(
      rained.limit * 0.5
    )
  })

  test('a point already inside is left where it is', async ({ page }) => {
    const held = await page.evaluate(async () => {
      const { containToFall, insideGlass, FALL_RADIUS, GLASS } = await import(
        '/src/utils/globeInterior.js'
      )
      const inside = { x: 3, y: 20, z: -4 }
      return {
        untouched: containToFall(inside),
        pulled: containToFall({ x: FALL_RADIUS * 3, y: 20, z: 0 }),
        middle: insideGlass(0, GLASS.centreY, 0),
        wayOut: insideGlass(GLASS.radius + 10, 0, 0),
        throughTheSide: insideGlass(glassSide(GLASS), 1, 0)
      }

      function glassSide(glassShape) {
        return glassShape.radius + 1
      }
    })

    expect(held.untouched).toEqual({ x: 3, y: 20, z: -4 })
    expect(Math.hypot(held.pulled.x, held.pulled.z)).toBeCloseTo(held.pulled.x, 5)
    // The height is not touched: only how far out it is.
    expect(held.pulled.y).toBe(20)
    expect(held.middle).toBe(true)
    expect(held.wayOut).toBe(false)
    expect(held.throughTheSide).toBe(false)
  })

  test('every drop in the scene is inside the glass', async ({ page }) => {
    // The forced condition, which is what the parameter is for.
    await gotoApp(page, '/?weather=rain')
    await expect
      .poll(() => page.evaluate(() => Boolean(window.__snowGlobeScene)), { timeout: 30000 })
      .toBe(true)
    await page.waitForTimeout(3000)

    const drops = await page.evaluate(async () => {
      const THREE = await import('/node_modules/.vite/deps/three.js')
      const { insideGlass } = await import('/src/utils/globeInterior.js')

      const matrix = new THREE.Matrix4()
      const place = new THREE.Vector3()
      let counted = 0
      let outside = 0
      let lowest = Infinity

      window.__snowGlobeScene.traverse((object) => {
        // A raindrop is an extruded teardrop, which nothing else in the
        // scene is.
        if (!object.isInstancedMesh || object.geometry?.type !== 'ExtrudeGeometry') return
        for (let i = 0; i < object.count; i += 1) {
          object.getMatrixAt(i, matrix)
          place.setFromMatrixPosition(matrix)
          counted += 1
          lowest = Math.min(lowest, place.y)
          if (!insideGlass(place.x, place.y, place.z)) outside += 1
        }
      })

      return { counted, outside, lowest }
    })

    expect(drops.counted, 'it is raining').toBeGreaterThan(100)
    expect(drops.outside, 'none of it outside the ornament').toBe(0)
    // And none of it below the floor it lands on, running down the base.
    expect(drops.lowest).toBeGreaterThan(-1)
  })
})
