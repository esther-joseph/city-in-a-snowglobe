import { test, expect } from '@playwright/test'
import { gotoApp } from './support/app.js'

/**
 * A city shrunk to sit on a table is still lit for a city.
 *
 * Three works out how hard a point or spot light lands on a surface from the
 * distance between them in world space, and that distance shrinks with
 * everything else. Scaling the globe down to half a metre puts every lamp in
 * the park a hand's breadth from what it was lighting from across the grass,
 * and the whole thing blows out: in AR the globe came back gold and white
 * with no city visible inside it.
 *
 * What is measured here is the pixel, not the arithmetic: the same plate,
 * under the same lamp, rendered at full size and at a twentieth of it.
 */

/** Build a plate with a lamp over it, render it, and read the middle pixel. */
const litPlate = (page, { scale, compensate }) =>
  page.evaluate(
    async ({ scale, compensate }) => {
      const THREE = await import('/node_modules/.vite/deps/three.js')
      const { compensateLights } = await import('/src/components/ar/FitToMeters.jsx')

      const canvas = document.createElement('canvas')
      canvas.width = 32
      canvas.height = 32
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        preserveDrawingBuffer: true
      })
      renderer.setSize(32, 32, false)

      const scene = new THREE.Scene()
      const outer = new THREE.Group()
      const inner = new THREE.Group()
      outer.add(inner)
      scene.add(outer)
      outer.scale.setScalar(scale)

      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.MeshStandardMaterial({ color: '#888888', roughness: 1 })
      )
      plate.rotation.x = -Math.PI / 2
      inner.add(plate)

      // A park lamp: the same intensity, reach and falloff the real ones have.
      const lamp = new THREE.PointLight('#ffffff', 2, 9, 2)
      lamp.position.set(0, 3, 0)
      inner.add(lamp)

      if (compensate) compensateLights(inner, scale)

      const camera = new THREE.PerspectiveCamera(50, 1, 0.001, 100)
      camera.position.set(0, 4 * scale, 4 * scale)
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)

      const gl = renderer.getContext()
      const pixels = new Uint8Array(4)
      gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      renderer.dispose()
      return pixels[0]
    },
    { scale, compensate }
  )

test.describe('Lighting a scene that has been shrunk', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('the same plate reads the same, at any size', async ({ page }) => {
    const full = await litPlate(page, { scale: 1, compensate: false })
    const shrunkRaw = await litPlate(page, { scale: 0.05, compensate: false })
    const shrunkFixed = await litPlate(page, { scale: 0.05, compensate: true })

    // Lit, but not blown out, at full size.
    expect(full).toBeGreaterThan(10)
    expect(full).toBeLessThan(200)

    // This is the bug: shrink the scene and the lamp is on top of the plate.
    expect(shrunkRaw, 'uncompensated, it saturates').toBeGreaterThan(240)

    // And this is the fix: the same reading as full size, within rounding.
    expect(Math.abs(shrunkFixed - full), 'compensated, it matches').toBeLessThanOrEqual(2)
  })

  test('only the lights that fall off with distance are touched', async ({ page }) => {
    const after = await page.evaluate(async () => {
      const THREE = await import('/node_modules/.vite/deps/three.js')
      const { compensateLights } = await import('/src/components/ar/FitToMeters.jsx')

      const root = new THREE.Group()
      const point = new THREE.PointLight('#fff', 2, 9, 2)
      const spot = new THREE.SpotLight('#fff', 3, 12)
      // No falloff on these: how bright they land does not depend on how far
      // away they are, so scaling the world does not change them.
      const sun = new THREE.DirectionalLight('#fff', 1.5)
      const ambient = new THREE.AmbientLight('#fff', 0.8)
      root.add(point, spot, sun, ambient)

      compensateLights(root, 0.1)

      return {
        point: { intensity: +point.intensity.toFixed(4), distance: +point.distance.toFixed(4) },
        spot: { intensity: +spot.intensity.toFixed(4), distance: +spot.distance.toFixed(4) },
        sun: sun.intensity,
        ambient: ambient.intensity
      }
    })

    // Intensity by the square of the scale, reach by the scale itself.
    expect(after.point.intensity).toBeCloseTo(2 * 0.01, 4)
    expect(after.point.distance).toBeCloseTo(0.9, 4)
    expect(after.spot.intensity).toBeCloseTo(3 * 0.01, 4)
    expect(after.spot.distance).toBeCloseTo(1.2, 4)
    expect(after.sun, 'the sun is left alone').toBe(1.5)
    expect(after.ambient, 'and so is the ambient').toBe(0.8)
  })

  test('a light whose brightness changes is followed, not fought', async ({ page }) => {
    const readings = await page.evaluate(async () => {
      const THREE = await import('/node_modules/.vite/deps/three.js')
      const { compensateLights } = await import('/src/components/ar/FitToMeters.jsx')

      const root = new THREE.Group()
      const lamp = new THREE.PointLight('#fff', 2, 9, 2)
      root.add(lamp)

      compensateLights(root, 0.1)
      const first = lamp.intensity

      // Nothing changed it in between: running again must not compound.
      compensateLights(root, 0.1)
      const again = lamp.intensity

      // Now the hour turns and React writes a new value onto the light, the
      // way it does when night falls.
      lamp.intensity = 4
      compensateLights(root, 0.1)
      const afterDusk = lamp.intensity

      return { first, again, afterDusk }
    })

    expect(readings.first).toBeCloseTo(0.02, 5)
    // Applied once, however many times it runs.
    expect(readings.again).toBeCloseTo(0.02, 5)
    // And it works from the new value rather than from its own last one.
    expect(readings.afterDusk).toBeCloseTo(0.04, 5)
  })

  test('scaling the park up is corrected the same way', async ({ page }) => {
    const readings = await page.evaluate(async () => {
      const THREE = await import('/node_modules/.vite/deps/three.js')
      const { compensateLights } = await import('/src/components/ar/FitToMeters.jsx')
      const { SNOW_GLOBE_CONTENT_SCALE } = await import('/src/components/SnowGlobe.jsx')

      // Immersive AR undoes the shrink the globe applies, so the park stands
      // at its own size. That is a scale of more than three, and a lamp whose
      // subject has moved further off is as wrong as one whose subject has
      // come closer.
      const factor = 1 / SNOW_GLOBE_CONTENT_SCALE
      const root = new THREE.Group()
      const lamp = new THREE.PointLight('#fff', 2, 9, 2)
      root.add(lamp)
      compensateLights(root, factor)

      return { factor, intensity: lamp.intensity, distance: lamp.distance }
    })

    expect(readings.factor).toBeGreaterThan(3)
    // Brighter, not dimmer, because everything it lights is now further away.
    expect(readings.intensity).toBeCloseTo(2 * readings.factor * readings.factor, 4)
    expect(readings.distance).toBeCloseTo(9 * readings.factor, 4)
  })
})
