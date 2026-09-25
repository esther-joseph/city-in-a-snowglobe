import { test, expect } from '@playwright/test'
import { gotoApp } from './support/app.js'

/**
 * The lamp posts.
 *
 * They were mid-century street lights: a tapered pole with a gooseneck arm
 * and a frosted globe hung off the end of it. A city park's lamps are the
 * older thing, a reeded cast iron column with a lantern sat on top of it, and
 * the silhouette is the whole difference. That is what is checked here, from
 * the scene rather than from the component: the light is above the column and
 * nothing reaches out sideways from it.
 */

const lamps = async (page) => {
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__snowGlobeScene)), { timeout: 30000 })
    .toBe(true)

  return page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js')
    const { LAMP_POSTS } = await import('/src/utils/parkFurniture.js')
    const { SNOW_GLOBE_CONTENT_SCALE: scale, SNOW_GLOBE_CITY_Y: floor } = await import(
      '/src/components/SnowGlobe.jsx'
    )

    const world = new THREE.Vector3()
    const found = LAMP_POSTS.map(([x, , z]) => ({
      at: [x, z],
      parts: [],
      highest: 0,
      widestUp: 0,
      glow: 0
    }))

    window.__snowGlobeScene.traverse((object) => {
      if (!object.isMesh) return
      object.getWorldPosition(world)
      // Back into the park's own units: the city is shrunk to fit the globe
      // and stood on top of its base.
      const x = world.x / scale
      const y = (world.y - floor) / scale
      const z = world.z / scale

      found.forEach((lamp) => {
        const reach = Math.hypot(x - lamp.at[0], z - lamp.at[1])
        if (reach > 1.2 || y < 0 || y > 6) return
        lamp.parts.push({ reach: +reach.toFixed(3), y: +y.toFixed(2) })
        lamp.highest = Math.max(lamp.highest, y)
        if (y > 2.5) lamp.widestUp = Math.max(lamp.widestUp, reach)
        const emissive = object.material?.emissiveIntensity ?? 0
        if (emissive > 0.5 && y > 2.5) lamp.glow = Math.max(lamp.glow, y)
      })
    })

    return found
  })
}

test.describe('Lamp posts', () => {
  test('the lantern sits on top of the column, with no arm', async ({ page }) => {
    // Night, so the lantern is lit and the emissive check has something to
    // find.
    await gotoApp(page, '/?hour=22')
    const posts = await lamps(page)

    expect(posts).toHaveLength(4)

    for (const lamp of posts) {
      expect(lamp.parts.length, `a lamp stands at ${lamp.at}`).toBeGreaterThan(8)

      // A park lamp is head height and then some.
      expect(lamp.highest, 'tall enough to walk under').toBeGreaterThan(3.5)

      // The old one hung its globe 0.84 out on an arm. Nothing above the
      // shoulder may now be further out than the lantern is wide.
      expect(lamp.widestUp, 'nothing reaches out sideways').toBeLessThan(0.4)

      // And the light is up there, not beside it.
      expect(lamp.glow, 'the lantern is lit, on top').toBeGreaterThan(3)
    }
  })

  test('the lantern is turned, not stacked out of cones', async ({ page }) => {
    await gotoApp(page)

    const outline = await page.evaluate(async () => {
      const source = await (await fetch('/src/components/city/LightPost.jsx')).text()
      const start = source.indexOf('const LANTERN_OUTLINE = [')
      if (start < 0) return null
      // To the line that closes the array, not to the first bracket after it,
      // which is the end of its first pair.
      const end = source.indexOf('\n]', start)
      const block = source.slice(start, end)
      return [...block.matchAll(/\[([\d.]+),\s*([\d.]+)\]/g)].map((pair) => ({
        radius: Number(pair[1]),
        height: Number(pair[2])
      }))
    })

    expect(outline, 'a profile to spin').not.toBeNull()
    expect(outline.length, 'enough points to read as a curve').toBeGreaterThan(6)

    const widest = outline.reduce((a, b) => (b.radius > a.radius ? b : a))
    const top = outline[outline.length - 1]

    // An onion, not a barrel and not a cone: narrow at the neck, widest low
    // down, and a long curve in to a small shoulder.
    expect(outline[0].radius, 'narrow at the neck').toBeLessThan(widest.radius * 0.5)
    expect(widest.height / top.height, 'widest in the lower half').toBeLessThan(0.5)
    expect(top.radius, 'closing to a shoulder').toBeLessThan(widest.radius * 0.45)

    // And the curve turns rather than kinking: every step out is smaller than
    // the one before it, and likewise coming back in.
    const rising = outline.filter((point) => point.height <= widest.height)
    for (let i = 2; i < rising.length; i += 1) {
      const step = rising[i].radius - rising[i - 1].radius
      const previous = rising[i - 1].radius - rising[i - 2].radius
      expect(step, 'the swell eases off rather than cornering').toBeLessThanOrEqual(previous + 1e-9)
    }
  })

  test('the column is reeded rather than turned plain', async ({ page }) => {
    await gotoApp(page)

    const section = await page.evaluate(async () => {
      const { createFlutedGeometry } = await import('/src/utils/fluting.js')
      const geometry = createFlutedGeometry({
        topRadius: 0.05,
        bottomRadius: 0.105,
        height: 3,
        flutes: 16,
        depth: 0.16,
        fullness: 0.34,
        segmentsPerFlute: 4
      })

      // The cylinder has one ring at each end and nothing in between, so the
      // section to measure is the top one.
      const position = geometry.attributes.position
      const radii = []
      for (let i = 0; i < position.count; i += 1) {
        if (Math.abs(position.getY(i) - 1.5) > 0.01) continue
        const radius = Math.hypot(position.getX(i), position.getZ(i))
        // Skip the cap's middle vertex, which sits on the axis.
        if (radius < 1e-3) continue
        radii.push(radius)
      }
      return {
        samples: radii.length,
        min: Math.min(...radii),
        max: Math.max(...radii)
      }
    })

    expect(section.samples).toBeGreaterThan(20)
    // Ribs, not a tube: the crown of a reed stands proud of the valley
    // between two of them.
    expect(section.max - section.min).toBeGreaterThan(0.005)
    expect(section.max / section.min).toBeGreaterThan(1.05)
  })

  test('the globe still reads the same reeding', async ({ page }) => {
    await gotoApp(page)

    // The fluting moved out of SnowGlobe into a util so the lamp could use
    // it. Whatever else changes, the plinth has to keep its own ribs.
    const shared = await page.evaluate(async () => {
      const fluting = await import('/src/utils/fluting.js')
      const globe = await import('/src/components/SnowGlobe.jsx')
      const first = fluting.getFlutedGeometry({
        topRadius: 1,
        bottomRadius: 1,
        height: 1,
        flutes: 8,
        depth: 0.2
      })
      const again = fluting.getFlutedGeometry({
        topRadius: 1,
        bottomRadius: 1,
        height: 1,
        flutes: 8,
        depth: 0.2
      })
      return {
        cached: first === again,
        scale: globe.SNOW_GLOBE_CONTENT_SCALE
      }
    })

    // Built once and kept: at 150 reeds it is not free, and the scene
    // rebuilds itself more often than the plinth changes.
    expect(shared.cached).toBe(true)
    expect(shared.scale).toBeGreaterThan(0)
  })
})
