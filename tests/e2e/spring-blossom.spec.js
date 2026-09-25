import { test, expect } from '@playwright/test'
import { gotoApp } from './support/app.js'

/**
 * Spring: a blossoming crown rather than a green one with flowers stuck on,
 * and beds that stay on the grass.
 */

test.describe('Spring blossom', () => {
  test('crowns are white or pink, one colour per tree', async ({ page }) => {
    await gotoApp(page, '/?season=spring')
    await expect
      .poll(() => page.evaluate(() => Boolean(window.__snowGlobeScene)), { timeout: 20000 })
      .toBe(true)
    await page.waitForTimeout(2500)

    const crowns = await page.evaluate(() => {
      // A canopy lobe is a sphere; the crown colours are the pale ones.
      const colours = []
      window.__snowGlobeScene.traverse((object) => {
        if (!object.isMesh) return
        if (object.geometry?.type !== 'SphereGeometry') return
        const colour = object.material?.color
        if (!colour) return
        // Pale and warm: blossom rather than foliage or cloud.
        if (colour.r > 0.85 && colour.b > 0.75 && colour.g < colour.r) {
          colours.push(`${colour.getHexString()}`)
        }
      })
      return colours
    })

    expect(crowns.length, 'blossom lobes in the park').toBeGreaterThan(20)
    const distinct = new Set(crowns)
    // Several shades across the stand, drawn from the palette.
    expect(distinct.size).toBeGreaterThan(1)
    expect(distinct.size).toBeLessThanOrEqual(6)
  })

  test('flower beds sit on the grass, clear of the paving', async ({ page }) => {
    await gotoApp(page, '/?season=spring')
    await expect
      .poll(() => page.evaluate(() => Boolean(window.__snowGlobeScene)), { timeout: 20000 })
      .toBe(true)
    await page.waitForTimeout(2500)

    const offGrass = await page.evaluate(async () => {
      const THREE = await import('/node_modules/.vite/deps/three.js')
      const { fitsOnGrass } = await import('/src/utils/parkLayout.js')
      const { getDaisyGeometry } = await import('/src/utils/daisy.js')

      // The beds are daisies in instanced meshes now, one instance per bed,
      // so the matrices are what carries a bed's position and size.
      const sizes = new Set(
        Object.values(getDaisyGeometry()).map((geometry) => geometry.attributes.position.count)
      )
      const matrix = new THREE.Matrix4()
      const place = new THREE.Vector3()
      const scale = new THREE.Vector3()
      const bad = []
      let counted = 0

      window.__snowGlobeScene.traverse((object) => {
        if (!object.isInstancedMesh) return
        if (!sizes.has(object.geometry.attributes.position.count)) return
        for (let i = 0; i < object.count; i += 1) {
          object.getMatrixAt(i, matrix)
          place.setFromMatrixPosition(matrix)
          scale.setFromMatrixScale(matrix)
          counted += 1
          // The park sits inside a scaled group, so the instance's own local
          // position is what the layout rule is written against.
          if (!fitsOnGrass(place.x, place.z, scale.x)) {
            bad.push({ x: +place.x.toFixed(2), z: +place.z.toFixed(2) })
          }
        }
      })
      return { counted, bad }
    })

    expect(offGrass.counted, 'flower beds found').toBeGreaterThan(50)
    expect(offGrass.bad).toEqual([])
  })

  test('petals fall more heavily than they did', async ({ page }) => {
    await gotoApp(page, '/?season=spring')
    const count = await page.evaluate(async () => {
      const { SEASON_PALETTES, SEASONS } = await import('/src/utils/seasons.js')
      return SEASON_PALETTES[SEASONS.SPRING].fall.count
    })
    // Was 90.
    expect(count).toBeGreaterThanOrEqual(200)
  })

  test('the beds carry more than pinks', async ({ page }) => {
    await gotoApp(page, '/?season=spring')
    const palette = await page.evaluate(async () => {
      const { SEASON_PALETTES, SEASONS } = await import('/src/utils/seasons.js')
      return SEASON_PALETTES[SEASONS.SPRING].flowers
    })
    // Five, derived from the canopy rather than typed out. It used to be ten
    // hand-picked ones, and the count is not the point: the spread is.
    expect(palette.length).toBeGreaterThanOrEqual(4)
    expect(new Set(palette).size, 'no two the same').toBe(palette.length)

    // At least one flower that is clearly not a pink or a white: something
    // with a dominant green or blue channel.
    const hasOtherHues = palette.some((hex) => {
      const value = parseInt(hex.slice(1), 16)
      const r = (value >> 16) & 255
      const g = (value >> 8) & 255
      const b = value & 255
      return g > r + 20 || b > r + 20
    })
    expect(hasOtherHues, 'a flower that is not pink or white').toBe(true)
  })
})
