/**
 * One geometry, however many meshes want it.
 *
 * The companion to sharedMaterial, and for the same reason. A park of sixty
 * trees and eighty bushes builds a fresh sphere for every lobe of every
 * crown: a thousand buffers, all of them the same ball at different sizes.
 * Building them costs time on every scene build, and the scene is built again
 * whenever the city changes.
 *
 * A sphere of one radius scaled to size is the same sphere. So these hand out
 * unit shapes, and the meshes carry their size in their scale.
 *
 * The one rule, as with the materials: nothing may modify what it gets back.
 */
import * as THREE from 'three'

const cache = new Map()

const shared = (key, build) => {
  if (!cache.has(key)) cache.set(key, build())
  return cache.get(key)
}

/**
 * A ball of radius 1.
 *
 * @param {number} widthSegments
 * @param {number} heightSegments
 * @returns {THREE.SphereGeometry} Shared. Scale the mesh, not this.
 */
export function unitSphere(widthSegments, heightSegments) {
  return shared(
    `sphere:${widthSegments}:${heightSegments}`,
    () => new THREE.SphereGeometry(1, widthSegments, heightSegments)
  )
}

/**
 * A cylinder one unit tall and one unit across at the bottom, narrowing to
 * `taper` of that at the top.
 *
 * The taper has to be part of the shape rather than the scale, because
 * scaling cannot turn a tube into a cone. Everything else — how tall, how
 * thick — is scale.
 *
 * @param {number} taper - Top radius as a fraction of the bottom.
 * @param {number} segments
 * @returns {THREE.CylinderGeometry} Shared.
 */
export function unitColumn(taper, segments) {
  const rounded = Math.round(taper * 100) / 100
  return shared(
    `column:${rounded}:${segments}`,
    () => new THREE.CylinderGeometry(rounded, 1, 1, segments)
  )
}

/** For the tests, and for anything that needs to know how well this is doing. */
export function sharedGeometryCount() {
  return cache.size
}
