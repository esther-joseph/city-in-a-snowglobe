import { test, expect } from '@playwright/test'
import { gotoApp } from './support/app.js'

/**
 * The water.
 *
 * The pools are displaced in a vertex shader now rather than being flat discs
 * with rings of geometry sliding across them, which is what makes them read as
 * water from standing height. A shader cannot be asserted on from here, but
 * the arithmetic around it can, and the arithmetic is where the bugs were: a
 * pool whose troughs reach its own floor shows the floor, and a ripple that
 * starts somewhere other than where a jet lands is decoration.
 */

const fountain = (page) => page.evaluate(() => import('/src/components/city/Fountain.jsx'))

test.describe('Fountain water', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('no pool can trough through its own floor', async ({ page }) => {
    const { POOLS, POOL_CLEARANCE } = await fountain(page)

    for (const [name, pool] of Object.entries(POOLS)) {
      const clearance = pool.water - pool.floor
      expect(clearance, `${name} sits above what it stands on`).toBeGreaterThan(0)
      // The basin spent a while with brown patches drifting across it, which
      // was the floor coming up through the troughs.
      expect(
        clearance,
        `${name} has room for its own swell`
      ).toBeGreaterThanOrEqual(pool.amplitude * POOL_CLEARANCE)
    }
  })

  test('the swell is small enough to be water and big enough to see', async ({ page }) => {
    const { POOLS } = await fountain(page)

    for (const [name, pool] of Object.entries(POOLS)) {
      // In park units, which read as metres: a few centimetres of chop.
      expect(pool.amplitude, `${name} is not an ocean`).toBeLessThan(0.06)
      expect(pool.amplitude, `${name} is not glass`).toBeGreaterThan(0.005)
      // A wave taller than the pool is wide is not a wave.
      expect(pool.amplitude).toBeLessThan(pool.radius * 0.05)
    }
  })

  test('the height field is one description, shared by both shaders', async ({ page }) => {
    const source = await page.evaluate(async () => {
      const { WATER_HEIGHT_GLSL } = await import('/src/utils/waterSurface.js')
      return WATER_HEIGHT_GLSL
    })

    // Crossing swells and a ring train, all driven by the same clock.
    expect(source).toContain('float waterHeight(vec2 p)')
    expect(source).toContain('RIPPLE_COUNT')
    expect((source.match(/sin\(/g) || []).length).toBeGreaterThan(3)
  })

  test('a jet lands where the ripples start', async ({ page }) => {
    const landings = await page.evaluate(async () => {
      const { jetArc } = await import('/src/utils/waterSurface.js')
      // The crown's arc: up from the finial, down into the top pool.
      const arc = jetArc({ speed: 0.95, rise: 1.15, landingY: -0.46 })
      return {
        start: arc[0].toArray(),
        end: arc[arc.length - 1].toArray(),
        peak: Math.max(...arc.map((point) => point.y))
      }
    })

    expect(landings.start).toEqual([0, 0, 0])
    // Out, over the top, and down to the water it feeds.
    expect(landings.end[0]).toBeGreaterThan(0.1)
    expect(landings.end[1]).toBeCloseTo(-0.46, 2)
    expect(landings.peak).toBeGreaterThan(0.05)
  })

  test('the jets are tapered, not pipes', async ({ page }) => {
    const shape = await page.evaluate(async () => {
      const THREE = await import('/node_modules/.vite/deps/three.js')
      const { jetArc, taperTube } = await import('/src/utils/waterSurface.js')

      const curve = new THREE.CatmullRomCurve3(jetArc({ speed: 1, rise: 1, landingY: -0.5 }))
      const plain = new THREE.TubeGeometry(curve, 24, 0.04, 8, false)
      const tapered = taperTube(
        new THREE.TubeGeometry(curve, 24, 0.04, 8, false),
        curve,
        { tip: 0.42, beat: 0.16 }
      )

      // How far the ring at each end sits from the centre of the tube there.
      const spread = (geometry, t) => {
        const position = geometry.attributes.position
        const uv = geometry.attributes.uv
        const point = curve.getPointAt(t)
        let widest = 0
        for (let i = 0; i < position.count; i += 1) {
          if (Math.abs(uv.getX(i) - t) > 0.01) continue
          const vertex = new THREE.Vector3().fromBufferAttribute(position, i)
          widest = Math.max(widest, vertex.distanceTo(point))
        }
        return widest
      }

      return {
        plainStart: spread(plain, 0),
        plainEnd: spread(plain, 1),
        taperedStart: spread(tapered, 0),
        taperedEnd: spread(tapered, 1)
      }
    })

    // A TubeGeometry is one width from end to end, which is the thing being
    // fixed.
    expect(shape.plainEnd).toBeCloseTo(shape.plainStart, 3)
    // The jet leaves the nozzle at its fullest and is coming apart by the
    // time it lands.
    expect(shape.taperedEnd).toBeLessThan(shape.taperedStart * 0.7)
    expect(shape.taperedEnd).toBeGreaterThan(0)
  })
})
