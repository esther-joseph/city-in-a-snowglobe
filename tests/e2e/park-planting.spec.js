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

/**
 * Nothing may be planted in anything else, either.
 *
 * The planting knew about the paving and nothing else, so bushes grew through
 * bench arms and, once there were stones, they were dropped at the foot of
 * lamp posts. The park is planted in one pass now, and everything put down
 * joins the list the next thing has to clear.
 */
test.describe('Park furniture', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('a spot is refused when something is already standing there', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { placeOnGrass, clearOfObstacles } = await import('/src/utils/parkLayout.js')
      const { furnitureObstacles, BENCHES } = await import('/src/utils/parkFurniture.js')

      const obstacles = furnitureObstacles()
      const failures = []
      let placed = 0
      let movedAside = 0

      // Aim squarely at each bench and each lamp, at the radius they stand at,
      // which is exactly what the old planting did by accident.
      for (const [x, z] of obstacles.map(([ox, oz]) => [ox, oz])) {
        const angle = Math.atan2(z, x)
        const distance = Math.hypot(x, z)
        for (let i = 0; i < 12; i += 1) {
          const radius = 0.3 + i * 0.1
          const spot = placeOnGrass(angle, distance, radius, obstacles)
          if (!spot) continue
          placed += 1
          if (!clearOfObstacles(spot[0], spot[1], radius, obstacles)) {
            failures.push({ angle, radius, spot })
          }
          if (Math.hypot(spot[0] - x, spot[1] - z) > 0.5) movedAside += 1
        }
      }

      return { placed, failures, movedAside, obstacles: obstacles.length, benches: BENCHES.length }
    })

    expect(result.benches).toBe(4)
    expect(result.obstacles).toBeGreaterThanOrEqual(8)
    expect(result.placed).toBeGreaterThan(50)
    expect(result.failures).toEqual([])
    // Every one of them had to be moved: they were aimed at the furniture.
    expect(result.movedAside).toBe(result.placed)
  })

  test('the stones are clear of the benches and the lamps', async ({ page }) => {
    await expect
      .poll(() => page.evaluate(() => Boolean(window.__snowGlobeScene)), { timeout: 30000 })
      .toBe(true)

    const report = await page.evaluate(async () => {
      const THREE = await import('/node_modules/.vite/deps/three.js')
      const { getRockGeometries } = await import('/src/utils/rocks.js')
      const { furnitureObstacles } = await import('/src/utils/parkFurniture.js')
      const { getViewpoints } = await import('/src/utils/arViewpoints.js')

      const sizes = new Set(
        getRockGeometries().map((rock) => rock.geometry.attributes.position.count)
      )
      const matrix = new THREE.Matrix4()
      const place = new THREE.Vector3()
      const scale = new THREE.Vector3()

      const stones = []
      window.__snowGlobeScene.traverse((object) => {
        if (!object.isInstancedMesh) return
        if (!sizes.has(object.geometry.attributes.position.count)) return
        object.geometry.computeBoundingBox()
        const box = object.geometry.boundingBox
        const spread = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2
        for (let i = 0; i < object.count; i += 1) {
          object.getMatrixAt(i, matrix)
          place.setFromMatrixPosition(matrix)
          scale.setFromMatrixScale(matrix)
          stones.push({
            x: place.x,
            z: place.z,
            radius: spread * Math.max(scale.x, scale.z)
          })
        }
      })

      const obstacles = furnitureObstacles()
      const viewpoints = getViewpoints().map((spot) => [spot.position[0], spot.position[2], 0.5])

      const inFurniture = stones.filter((stone) =>
        obstacles.some(([x, z, radius]) => Math.hypot(stone.x - x, stone.z - z) < radius + stone.radius)
      )
      const underfoot = stones.filter((stone) =>
        viewpoints.some(([x, z, radius]) => Math.hypot(stone.x - x, stone.z - z) < radius + stone.radius)
      )

      // And not in each other.
      const overlapping = []
      for (let i = 0; i < stones.length; i += 1) {
        for (let j = i + 1; j < stones.length; j += 1) {
          const gap = Math.hypot(stones[i].x - stones[j].x, stones[i].z - stones[j].z)
          if (gap < stones[i].radius + stones[j].radius) overlapping.push([i, j])
        }
      }

      return { count: stones.length, inFurniture, underfoot, overlapping }
    })

    // Three shapes, scattered: enough of them to be worth the draw calls.
    expect(report.count).toBeGreaterThan(8)
    expect(report.inFurniture, 'no stone inside a bench or a lamp').toEqual([])
    expect(report.underfoot, 'no stone where an AR viewer is put down').toEqual([])
    expect(report.overlapping, 'no stone inside another').toEqual([])
  })

  test('the park is fuller than it was', async ({ page }) => {
    await expect
      .poll(() => page.evaluate(() => Boolean(window.__snowGlobeScene)), { timeout: 30000 })
      .toBe(true)

    const counts = await page.evaluate(async () => {
      const { getRockGeometries } = await import('/src/utils/rocks.js')
      const rockSizes = new Set(
        getRockGeometries().map((rock) => rock.geometry.attributes.position.count)
      )

      let trunks = 0
      let rocks = 0
      window.__snowGlobeScene.traverse((object) => {
        if (object.isInstancedMesh && rockSizes.has(object.geometry.attributes.position.count)) {
          rocks += object.count
          return
        }
        // A trunk is a tapered cylinder standing on the grass. Counting them
        // counts trees without reaching into the component.
        const parameters = object.geometry?.parameters
        if (!object.isMesh || !parameters) return
        if (parameters.radiusTop === undefined || parameters.height === undefined) return
        if (parameters.height < 1 || parameters.height > 5) return
        if (parameters.radiusTop > 0.6 || parameters.radiusTop <= 0) return
        trunks += 1
      })

      return { trunks, rocks }
    })

    // Was 28 outer and 12 inner before a middle ring was added.
    expect(counts.trunks).toBeGreaterThan(40)
    expect(counts.rocks).toBeGreaterThan(8)
  })
})
