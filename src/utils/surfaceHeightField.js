/**
 * A coarse "what is the highest surface here" map of the scene.
 *
 * Snow needs to land on whatever is underneath it — a rooftop, a tree canopy,
 * a bush, the grass — and raycasting per flake per frame would be far too
 * expensive with thousands of them. Instead the scene is sampled once into a
 * grid of heights, and each flake looks up the cell it is falling through.
 *
 * Heights are stored in the local space of the reference object, so the map
 * stays valid when the whole globe is rotated or shaken.
 */
import * as THREE from 'three'

const DOWN = new THREE.Vector3(0, -1, 0)

/**
 * @param {THREE.Object3D} reference - object whose local space the grid uses
 * @param {THREE.Object3D} target - subtree to raycast against (the city)
 * @param {Object} [options]
 * @param {number} [options.span] - width of the sampled square, in local units
 * @param {number} [options.resolution] - cells per side
 * @param {number} [options.rayHeight] - how high above the scene rays start
 * @param {number} [options.floor] - height used where nothing is hit
 * @returns {{ sample: (x: number, z: number) => number, cells: number, built: number }}
 */
export function buildHeightField(reference, target, options = {}) {
  const { span = 80, resolution = 40, rayHeight = 90, floor = 0.25 } = options

  const heights = new Float32Array(resolution * resolution).fill(floor)
  const raycaster = new THREE.Raycaster()
  const origin = new THREE.Vector3()
  const hit = new THREE.Vector3()
  const half = span / 2
  const step = span / (resolution - 1)

  reference.updateWorldMatrix(true, false)
  target.updateWorldMatrix(true, true)

  let built = 0
  for (let ix = 0; ix < resolution; ix += 1) {
    for (let iz = 0; iz < resolution; iz += 1) {
      origin.set(-half + ix * step, rayHeight, -half + iz * step)
      reference.localToWorld(origin)
      raycaster.set(origin, DOWN)

      const intersections = raycaster.intersectObject(target, true)
      if (intersections.length > 0) {
        hit.copy(intersections[0].point)
        reference.worldToLocal(hit)
        heights[ix * resolution + iz] = hit.y
        built += 1
      }
    }
  }

  // Cells where the surface jumps — a roof edge, a wall, the lip of the park.
  // Nearest-neighbour lookup is unreliable exactly there, so callers can spend
  // a confirming raycast on these and trust the grid everywhere else.
  const edges = new Uint8Array(resolution * resolution)
  const EDGE_DROP = 1
  for (let ix = 0; ix < resolution; ix += 1) {
    for (let iz = 0; iz < resolution; iz += 1) {
      const here = heights[ix * resolution + iz]
      let edge = 0
      for (let dx = -1; dx <= 1 && !edge; dx += 1) {
        for (let dz = -1; dz <= 1 && !edge; dz += 1) {
          const nx = ix + dx
          const nz = iz + dz
          if (nx < 0 || nz < 0 || nx >= resolution || nz >= resolution) continue
          if (Math.abs(heights[nx * resolution + nz] - here) > EDGE_DROP) edge = 1
        }
      }
      edges[ix * resolution + iz] = edge
    }
  }

  const indexFor = (x, z) => {
    const ix = Math.round((x + half) / step)
    const iz = Math.round((z + half) / step)
    if (ix < 0 || iz < 0 || ix >= resolution || iz >= resolution) return -1
    return ix * resolution + iz
  }

  const sample = (x, z) => {
    const index = indexFor(x, z)
    return index === -1 ? floor : heights[index]
  }

  /** True where the grid is least trustworthy and a raycast is worth it. */
  const isEdge = (x, z) => {
    const index = indexFor(x, z)
    return index === -1 ? false : edges[index] === 1
  }

  return { sample, isEdge, cells: resolution * resolution, built }
}
