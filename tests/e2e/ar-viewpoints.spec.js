import { test, expect } from '@playwright/test'
import { gotoApp, openDrawer } from './support/app.js'

/**
 * The three places to stand.
 *
 * Immersive AR drops the viewer into a park that was modelled for a camera
 * orbiting it from outside, so where they land is not a detail: a spot half a
 * metre out lands them in the fountain basin or on a path with a tree growing
 * through them. The positions are derived from the park's own dimensions so
 * that moving a path moves them too, and what is asserted here is that the
 * derivation still lands somewhere a person could stand.
 *
 * A real immersive session cannot be driven from a test browser, so the scene
 * side is covered through the module and the panel through the camera
 * fallback, which is the one AR route a phone profile can actually take.
 */

const viewpoints = (page) =>
  page.evaluate(async () => {
    const { getViewpoints, originFor, headingTowards, pitchTowards } = await import(
      '/src/utils/arViewpoints.js'
    )
    const { fitsOnGrass, clearOfRadialPaths } = await import('/src/utils/parkLayout.js')
    return getViewpoints().map((viewpoint) => ({
      ...viewpoint,
      origin: originFor(viewpoint),
      heading: headingTowards(viewpoint.position, viewpoint.lookAt),
      pitch: pitchTowards(viewpoint.position, viewpoint.lookAt),
      distance: Math.hypot(viewpoint.position[0], viewpoint.position[2]),
      // A standing person is about this wide through the shoulders.
      clearOfPaths: clearOfRadialPaths(viewpoint.position[0], viewpoint.position[2], 0.3),
      onGrass: fitsOnGrass(viewpoint.position[0], viewpoint.position[2], 0.3)
    }))
  })

test.describe('AR viewpoints', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('three spots, one of each, inside the park', async ({ page }) => {
    const spots = await viewpoints(page)

    expect(spots.map((spot) => spot.id)).toEqual(['fountain', 'bench', 'trees'])

    const { PERIMETER_WALK, FOUNTAIN_RING } = await page.evaluate(() =>
      import('/src/utils/parkLayout.js').then((module) => ({
        PERIMETER_WALK: module.PERIMETER_WALK,
        FOUNTAIN_RING: module.FOUNTAIN_RING
      }))
    )

    for (const spot of spots) {
      // Outside the water, inside the park.
      expect(spot.distance, `${spot.id} is clear of the basin`).toBeGreaterThan(
        FOUNTAIN_RING.outer
      )
      expect(spot.distance, `${spot.id} is inside the park`).toBeLessThan(
        PERIMETER_WALK.outer
      )
      expect(spot.clearOfPaths, `${spot.id} is not standing in a radial path`).toBe(true)
    }
  })

  test('each one faces what it is there for', async ({ page }) => {
    const [fountain, bench, trees] = await viewpoints(page)

    // The two ground-level spots look across at the water and the skyline, so
    // their gaze is near level. A few degrees either way is the fountain being
    // shorter than a person.
    expect(Math.abs(fountain.pitch)).toBeLessThan(0.2)
    expect(Math.abs(bench.pitch)).toBeLessThan(0.2)

    // The tree spot is the one that looks up. The whole point of standing
    // under a canopy is seeing the city and the sky through it, which a level
    // gaze would miss entirely.
    expect(trees.pitch).toBeGreaterThan(0.6)

    // Everyone faces the middle: turn by the heading and the vector to the
    // centre should be straight ahead, which is -Z.
    for (const spot of [fountain, bench, trees]) {
      const [x, , z] = spot.position
      const forwardX = -Math.sin(spot.heading)
      const forwardZ = -Math.cos(spot.heading)
      const length = Math.hypot(x, z)
      const towardsCentre = [-x / length, -z / length]
      const alignment = forwardX * towardsCentre[0] + forwardZ * towardsCentre[1]
      expect(alignment, `${spot.id} faces the middle`).toBeGreaterThan(0.99)
    }
  })

  test('the origin stands the viewer on the floor, and sits them on the bench', async ({
    page
  }) => {
    const [fountain, bench, trees] = await viewpoints(page)

    // An XR origin is the viewer's feet and the reference space puts the real
    // floor at zero, so a standing spot must not offset it at all.
    expect(fountain.origin.position[1]).toBeCloseTo(0, 5)
    expect(trees.origin.position[1]).toBeCloseTo(0, 5)

    // The bench puts them on the seat, which is lower than standing.
    expect(bench.origin.position[1]).toBeLessThan(fountain.origin.position[1])

    for (const spot of [fountain, bench, trees]) {
      // Only yaw. Pitching an origin would fight the neck of whoever is
      // wearing the headset, which is why it is returned separately.
      expect(spot.origin.rotation[0]).toBe(0)
      expect(spot.origin.rotation[2]).toBe(0)
      expect(spot.origin.rotation[1]).toBeCloseTo(spot.heading, 5)
    }
  })

  test('the park floor is not the room floor, and the origin knows it', async ({
    page
  }) => {
    const heights = await page.evaluate(async () => {
      const { getViewpoint, originFor } = await import('/src/utils/arViewpoints.js')
      const { SNOW_GLOBE_CONTENT_SCALE, SNOW_GLOBE_CITY_Y } = await import(
        '/src/components/SnowGlobe.jsx'
      )
      const floor = (SNOW_GLOBE_CITY_Y / SNOW_GLOBE_CONTENT_SCALE)
      return {
        floor,
        standing: originFor(getViewpoint('fountain'), { floor }).position[1],
        plain: originFor(getViewpoint('fountain')).position[1]
      }
    })

    // The city is parked above the globe's base, so at life size its ground is
    // most of a metre up. Standing a viewer at zero would bury them to the
    // waist in the paving.
    expect(heights.floor).toBeGreaterThan(0.5)
    expect(heights.standing).toBeCloseTo(heights.floor, 5)
    expect(heights.plain).toBeCloseTo(0, 5)
  })

  test('an unknown spot falls back rather than stranding the viewer', async ({ page }) => {
    const id = await page.evaluate(async () => {
      const { getViewpoint } = await import('/src/utils/arViewpoints.js')
      return getViewpoint('somewhere-that-was-removed').id
    })
    expect(id).toBe('fountain')
  })
})

test.describe('AR viewpoints, against the park as it is built', () => {
  /**
   * The positions are derived from the park's dimensions, but the park is
   * planted at run time and some of it is random. These read the scene that
   * actually got built.
   */
  const measure = async (page) => {
    await expect
      .poll(() => page.evaluate(() => Boolean(window.__snowGlobeScene)), { timeout: 30000 })
      .toBe(true)
    return page.evaluate(async () => {
      const THREE = await import('/node_modules/.vite/deps/three.js')
      const { getViewpoints } = await import('/src/utils/arViewpoints.js')
      const { SNOW_GLOBE_CONTENT_SCALE, SNOW_GLOBE_CITY_Y } = await import(
        '/src/components/SnowGlobe.jsx'
      )
      const scene = window.__snowGlobeScene
      const spots = getViewpoints()
      const found = spots.map((spot) => ({ id: spot.id, through: 0, overhead: 0, under: 0 }))
      const box = new THREE.Box3()

      scene.traverse((object) => {
        if (!object.isMesh) return
        try {
          box.setFromObject(object)
        } catch {
          return
        }
        if (box.isEmpty()) return
        // Back into the park's own units: the city is shrunk to fit inside the
        // globe and stood on top of its base, so both have to come off.
        const scale = SNOW_GLOBE_CONTENT_SCALE
        const toPark = (vector) => ({
          x: vector.x / scale,
          y: (vector.y - SNOW_GLOBE_CITY_Y) / scale,
          z: vector.z / scale
        })
        const min = toPark(box.min)
        const max = toPark(box.max)
        const span = Math.max(max.x - min.x, max.z - min.z)
        // Ignore the ground, the dome and the rest of the scenery.
        if (span > 12) return

        spots.forEach((spot, index) => {
          const [x, , z] = spot.position
          if (x < min.x || x > max.x || z < min.z || z > max.z) return
          const solid = span >= 0.8 && max.y - min.y > 0.25
          // Something with height standing where a person would be.
          if (solid && min.y < 1.4 && max.y > 0.4) found[index].through += 1
          // Something overhead: leaves, not paving.
          if (min.y > 2) found[index].overhead += 1
          // Something to sit on.
          if (max.y < 1.4) found[index].under += 1
        })
      })

      return found
    })
  }

  test('nobody is standing inside the scenery, and the trees are overhead', async ({
    page
  }) => {
    await gotoApp(page)
    const [fountain, bench, trees] = await measure(page)

    // The two standing spots are on open ground. The bench is exempt: sitting
    // on a bench means the bench is where your legs are.
    expect(fountain.through, 'the fountain spot is clear').toBe(0)
    expect(trees.through, 'the tree spot is clear of trunks').toBe(0)

    // What each of the other two is for.
    expect(bench.under, 'there is a bench under the bench spot').toBeGreaterThan(0)
    expect(trees.overhead, 'there is a canopy over the tree spot').toBeGreaterThan(0)

    // And the point of the tree spot: the canopy is above, not beside.
    expect(fountain.overhead, 'the fountain spot is open to the sky').toBe(0)
  })
})

test.describe('AR viewpoint panel', () => {
  test.skip(({ isMobile }) => !isMobile, 'the panel only appears once AR is running')

  test('the spots appear in the drawer once AR is on', async ({ page, context }) => {
    await context.grantPermissions(['camera'])
    await page.addInitScript(() => {

      const canvas = document.createElement('canvas')
      canvas.width = 320
      canvas.height = 240
      const context2d = canvas.getContext('2d')
      context2d.fillStyle = '#123'
      context2d.fillRect(0, 0, canvas.width, canvas.height)
      const stream = canvas.captureStream(15)
      navigator.mediaDevices = navigator.mediaDevices || {}
      navigator.mediaDevices.getUserMedia = async () => stream
    })
    await gotoApp(page)
    await openDrawer(page)

    // In 3D there is nothing to have a point of view on.
    await expect(page.getByTestId('ar-viewpoints')).toHaveCount(0)

    await page.getByRole('button', { name: /AR Mode/i }).click()
    await openDrawer(page)

    const panel = page.getByTestId('ar-viewpoints')
    await expect(panel).toBeVisible()

    // Observational is where it starts, and the spots belong to the other
    // mode, so they are not there yet.
    await expect(page.getByTestId('ar-view-observational')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(page.getByTestId('ar-viewpoint-spots')).toHaveCount(0)

    // Dispatched rather than clicked: the WebXR emulator this browser runs
    // with lays its own session overlay over the whole page, so a click at
    // coordinates lands on that instead. On a device the drawer is inside the
    // session's dom-overlay and takes taps normally.
    await page.getByTestId('ar-view-immersive').dispatchEvent('click')
    await expect(page.getByTestId('ar-viewpoint-spots')).toBeVisible()

    for (const id of ['fountain', 'bench', 'trees']) {
      await expect(page.getByTestId(`ar-spot-${id}`)).toBeVisible()
    }

    await page.getByTestId('ar-spot-trees').dispatchEvent('click')
    await expect(page.getByTestId('ar-spot-trees')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('ar-spot-fountain')).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })
})
