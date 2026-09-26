import { test, expect } from '@playwright/test'
import { gotoApp, waitForPark } from './support/app.js'

/**
 * What the scene shares.
 *
 * This city is built mesh by mesh, and every `<meshStandardMaterial>` in a
 * component makes a material while every `<sphereGeometry>` makes a buffer.
 * A park of sixty trees and eighty bushes was a thousand balls that differ
 * only in size, and four thousand materials that are the same half dozen
 * browns and greens.
 *
 * What is asserted here is the rule that makes the sharing safe, and that it
 * is actually happening: the same request comes back as the same object, and
 * the built scene has far fewer materials than meshes.
 */

test.describe('Shared materials and geometry', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('the same request comes back as the same object', async ({ page }) => {
    const same = await page.evaluate(async () => {
      const { standardMaterial } = await import('/src/utils/sharedMaterial.js')
      const { unitSphere, unitColumn, unitPlane } = await import(
        '/src/utils/sharedGeometry.js'
      )

      const brown = standardMaterial({ color: '#7a4f28', roughness: 0.85, metalness: 0 })
      const againInAnotherOrder = standardMaterial({
        metalness: 0,
        roughness: 0.85,
        color: '#7a4f28'
      })
      const green = standardMaterial({ color: '#2d7a2f', roughness: 0.85, metalness: 0 })

      return {
        material: brown === againInAnotherOrder,
        // The order the parameters are written in is not part of what they
        // are.
        different: brown !== green,
        sphere: unitSphere(7, 6) === unitSphere(7, 6),
        sphereDiffers: unitSphere(7, 6) !== unitSphere(6, 5),
        column: unitColumn(0.6, 7) === unitColumn(0.6, 7),
        plane: unitPlane() === unitPlane(),
        // A unit shape is a unit shape: the size lives in the mesh's scale.
        radius: unitSphere(7, 6).parameters.radius
      }
    })

    expect(same.material).toBe(true)
    expect(same.different).toBe(true)
    expect(same.sphere).toBe(true)
    expect(same.sphereDiffers).toBe(true)
    expect(same.column).toBe(true)
    expect(same.plane).toBe(true)
    expect(same.radius).toBe(1)
  })

  test('the park draws thousands of meshes from a handful of each', async ({ page }) => {
    await waitForPark(page)

    const counted = await page.evaluate(() => {
      const materials = new Set()
      const geometries = new Set()
      let meshes = 0

      window.__snowGlobeScene.traverse((object) => {
        if (!object.isMesh && !object.isInstancedMesh) return
        meshes += 1
        if (object.material) materials.add(object.material.uuid)
        if (object.geometry) geometries.add(object.geometry.uuid)
      })

      return { meshes, materials: materials.size, geometries: geometries.size }
    })

    expect(counted.meshes, 'a city').toBeGreaterThan(2000)
    // It used to be one material and one buffer per mesh, near enough
    // exactly. Anything close to that ratio means the sharing has been
    // undone somewhere.
    expect(counted.materials / counted.meshes, 'materials per mesh').toBeLessThan(0.5)
    expect(counted.geometries / counted.meshes, 'geometries per mesh').toBeLessThan(0.5)
  })
})
