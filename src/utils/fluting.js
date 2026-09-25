/**
 * Reeded columns.
 *
 * A cylinder with ribs standing proud around it, which is how the globe's
 * plinth is turned and how a cast iron lamp post is cast. Built by pushing
 * each vertex in or out along its own radius by a function of its angle, so
 * the ribs follow the taper, and recomputing the normals so they catch light
 * as rounded reeds rather than facets.
 *
 * Shared because two quite different things want it, and because the geometry
 * is worth building once and keeping: at 150 reeds it is not free, and the
 * scene rebuilds itself more often than the plinth changes.
 */
import * as THREE from 'three'

const flutedGeometryCache = new Map()

/**
 * @param {Object} params - Passed straight to createFlutedGeometry.
 * @returns {THREE.BufferGeometry} Shared: keyed by the parameters, so a
 *   remount reuses the buffer rather than rebuilding it.
 */
export function getFlutedGeometry(params) {
  const key = Object.values(params).join('|')
  if (!flutedGeometryCache.has(key)) {
    flutedGeometryCache.set(key, createFlutedGeometry(params))
  }
  return flutedGeometryCache.get(key)
}

/**
 * A cylinder with vertical flutes cut around it, like a reeded plinth.
 *
 * Built by pushing each vertex in or out along its own radius by a sine of the
 * angle: the ribs follow the taper, and recomputed normals make them catch
 * light as rounded reeds rather than facets.
 */
export function createFlutedGeometry({
  topRadius,
  bottomRadius,
  height,
  flutes,
  depth,
  // How full each reed is. 0.5 is a true semicircle; lower carries the radius
  // further across the reed before it turns down, so neighbouring beads meet
  // later and the dark line between them is thinner.
  fullness = 0.3,
  // Samples across each reed. Twelve is smooth for a round section — the
  // curvature is spread over the whole reed rather than concentrated in a
  // narrow cut, so this does not need to be large. Sixteen measured 10%
  // slower on drawer toggling for no visible gain.
  segmentsPerFlute = 12
}) {
  const geometry = new THREE.CylinderGeometry(
    topRadius,
    bottomRadius,
    height,
    flutes * segmentsPerFlute,
    1,
    false
  )

  const position = geometry.attributes.position
  const vertex = new THREE.Vector3()

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i)
    const radius = Math.hypot(vertex.x, vertex.z)
    if (radius < 1e-4) continue

    const angle = Math.atan2(vertex.z, vertex.x)
    // Reeding, not fluting: the two are inverses of one another. Fluting cuts
    // grooves into a flat face and leaves the face between them; reeding
    // stands the ribs proud as convex beads that meet in a line, with no flat
    // anywhere on the surface.
    //
    // `offset` is the angular distance from a reed's crown, normalised so 0 is
    // the crown and 1 the valley between two reeds. (1 - offset^2) raised to a
    // power is the section riding over it: at 0.5 exactly a semicircle, and
    // below that a fuller bead that carries its radius further before turning
    // down — which narrows the parting line without flattening the crown.
    //
    // The valley still lands on a cusp. That is what gives reeding its crisp
    // parting line rather than the soft trough a cosine would leave; the
    // fullness sets how wide that line reads, not whether it is there.
    const wave = Math.min(1, Math.max(-1, Math.cos(angle * flutes)))
    const offset = Math.acos(wave) / Math.PI
    const bead = Math.pow(Math.max(0, 1 - offset * offset), fullness)
    const scale = 1 - depth * (1 - bead)

    position.setX(i, vertex.x * scale)
    position.setZ(i, vertex.z * scale)
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

