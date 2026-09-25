/**
 * Three rocks, built once and shared.
 *
 * A park has stones in it: something at the foot of a tree, something by the
 * edge of a path. They are the cheapest thing that can be added to make the
 * grass read as ground rather than as a green floor, and at low poly they are
 * a handful of triangles each.
 *
 * Three shapes rather than one scaled differently, because a rock repeated at
 * three sizes reads as the same rock three times. Each is a solid pushed
 * about by a fixed pattern, so they are the same every run: a boulder to sit
 * beside, a flatter slab, and a small knot of stone.
 */
import * as THREE from 'three'

/**
 * Push every vertex out or in by an amount that depends on where it is, then
 * flatten the whole thing a little. Deterministic: the same vertex always
 * moves the same way, so the rock does not change shape between runs.
 */
function weather(geometry, { amount, squash, seed }) {
  const position = geometry.attributes.position
  const vertex = new THREE.Vector3()

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i)
    const noise =
      Math.sin(vertex.x * 3.1 + seed) * 0.5 +
      Math.sin(vertex.y * 4.7 + seed * 1.7) * 0.3 +
      Math.sin(vertex.z * 3.9 + seed * 2.3) * 0.2
    vertex.multiplyScalar(1 + noise * amount)
    vertex.y *= squash
    position.setXYZ(i, vertex.x, vertex.y, vertex.z)
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  // Sat on the ground rather than half sunk into it.
  geometry.translate(0, -geometry.boundingBox.min.y, 0)
  geometry.computeBoundingBox()
  return geometry
}

let cached = null

/**
 * @returns {Array<{ id: string, geometry: THREE.BufferGeometry, radius: number }>}
 *   Radius is the footprint on the grass, which is what the planting needs.
 */
export function getRockGeometries() {
  if (cached) return cached

  const shapes = [
    // A boulder: eight sided, barely flattened, the one you would sit on.
    { id: 'boulder', geometry: new THREE.IcosahedronGeometry(0.62, 0), amount: 0.22, squash: 0.78, seed: 1.3 },
    // A slab: wider than it is tall, the one that looks half buried.
    { id: 'slab', geometry: new THREE.DodecahedronGeometry(0.52, 0), amount: 0.3, squash: 0.45, seed: 4.1 },
    // A knot: small, angular, in twos and threes.
    { id: 'knot', geometry: new THREE.OctahedronGeometry(0.34, 0), amount: 0.34, squash: 0.85, seed: 7.9 }
  ]

  cached = shapes.map(({ id, geometry, amount, squash, seed }) => {
    weather(geometry, { amount, squash, seed })
    const box = geometry.boundingBox
    return {
      id,
      geometry,
      radius: Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2
    }
  })

  return cached
}
