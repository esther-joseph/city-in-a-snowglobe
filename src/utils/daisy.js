/**
 * One daisy, built once and handed to an InstancedMesh.
 *
 * The beds used to be hexagonal discs of colour lying on the grass, which
 * reads from the orbiting camera and falls apart the moment anyone stands in
 * the park in AR. A flower at eye level has to be a flower.
 *
 * It is built in three pieces rather than one because they are three colours:
 * the petals take the season's colour per bed, the eye is the same warm cream
 * everywhere, and the leaves follow the grass. Three merged geometries mean
 * three draw calls for the whole park however many flowers are planted.
 *
 * Everything is modelled around a head of radius 1 and scaled by whoever
 * plants it.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** A daisy has a lot of petals. Twelve is enough to read as one. */
export const PETAL_COUNT = 12
const LEAF_COUNT = 3

/**
 * A petal, lying flat and pointing away from the middle.
 *
 * Two curves out and back rather than an ellipse: a petal is wider past its
 * middle and comes to a rounded point, and an ellipse does neither.
 */
function bladeGeometry({ length, width, thickness = 0.05, segments = 5 }) {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(width, length * 0.22, width * 0.85, length * 0.82, 0, length)
  shape.bezierCurveTo(-width * 0.85, length * 0.82, -width, length * 0.22, 0, 0)

  // Extruded rather than flat. A petal with no thickness disappears the
  // moment it is seen edge on, which at standing height in the park is most
  // of them; a slab this thin costs a few more vertices and reads from any
  // angle.
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: segments
  })
  // Shapes are drawn in XY, facing the camera. Laying one flat sends it down
  // the -Z axis, so it is turned to point along +Z: everything below tilts
  // and places blades as though they grow outward from the middle, and a
  // blade pointing backwards tilts into the ground instead of out of it.
  geometry.rotateX(-Math.PI / 2)
  geometry.rotateY(Math.PI)
  return geometry
}

/**
 * The petals: a ring of blades, each tipped up so the head is a shallow bowl
 * rather than a sticker on the ground.
 */
function buildPetals() {
  const blades = []
  for (let i = 0; i < PETAL_COUNT; i += 1) {
    const blade = bladeGeometry({ length: 0.72, width: 0.16, thickness: 0.045 })
    // Enough of a bowl that the far petals stand above the near ones from
    // eye level, instead of the whole head reading as a disc.
    const tilt = 0.42 + (i % 3) * 0.06
    // A real head is not stamped: every third petal is a little shorter.
    blade.scale(1, 1, i % 3 === 0 ? 0.92 : 1)
    blade.rotateX(-tilt)
    blade.translate(0, 0.1, 0.19)
    blade.rotateY((i / PETAL_COUNT) * Math.PI * 2)
    blades.push(blade)
  }
  return mergeGeometries(blades)
}

/** The eye in the middle: a low dome, flat-shaded like everything else here. */
function buildEye() {
  const eye = new THREE.SphereGeometry(0.26, 10, 6)
  eye.scale(1, 0.55, 1)
  eye.translate(0, 0.15, 0)
  return eye
}

/**
 * Three leaves at the foot, turned off the petals' axis so they read as
 * leaves rather than as more petals seen from above.
 */
function buildLeaves() {
  const leaves = []
  for (let i = 0; i < LEAF_COUNT; i += 1) {
    const leaf = bladeGeometry({ length: 1.05, width: 0.42, thickness: 0.04 })
    // Out past the petals and nearly flat on the grass, so they read as
    // leaves under the head rather than as three more petals.
    // Lifted off the ground at the tip: flat on the grass they read as a
    // dark patch of it rather than as leaves.
    leaf.rotateX(-0.3)
    leaf.translate(0, 0.02, 0.32)
    leaf.rotateY((i / LEAF_COUNT) * Math.PI * 2 + Math.PI / PETAL_COUNT)
    leaves.push(leaf)
  }
  return mergeGeometries(leaves)
}

let cached = null

/**
 * @returns {{ petals: THREE.BufferGeometry, eye: THREE.BufferGeometry,
 *   leaves: THREE.BufferGeometry }} Shared. Built on first use.
 */
export function getDaisyGeometry() {
  if (!cached) {
    cached = { petals: buildPetals(), eye: buildEye(), leaves: buildLeaves() }
  }
  return cached
}
