/**
 * The park's paved surfaces, in one place.
 *
 * These numbers were written twice: once in the meshes that draw the paths and
 * again, as literals, in the test that decides where a tree may stand. The two
 * drifted — the planting test knew the path's centre line but not how wide a
 * canopy is, so trees were placed a metre from a path and overhung it by two.
 *
 * Everything that draws or avoids a path reads from here now.
 */

/** Ring path around the fountain: inner and outer edge. */
export const FOUNTAIN_RING = { inner: 4.6, outer: 5.85 }

/** Walkway around the park's perimeter. */
export const PERIMETER_WALK = { inner: 16.8, outer: 18.3 }

/** The four radial paths. */
export const RADIAL_PATH = {
  angles: [0, Math.PI / 2, Math.PI, Math.PI * 1.5],
  width: 1.3,
  start: FOUNTAIN_RING.inner,
  end: PERIMETER_WALK.outer
}

/** The planted ground: between the fountain ring and the perimeter walk. */
export const GRASS_BAND = { inner: FOUNTAIN_RING.outer, outer: PERIMETER_WALK.inner }

/**
 * A hand's breadth of grass left between a crown and any paving.
 *
 * Without it a placement lands exactly on the kerb, which is both a hair from
 * overhanging once floating point has its say, and visibly tight — a tree
 * whose leaves stop precisely at the edge of the path looks planted with a
 * ruler.
 */
export const PLANTING_MARGIN = 0.12

/**
 * How far a tree reaches from its trunk.
 *
 * The canopy is a central sphere of 0.55 * scale with four lobes set 0.29 out
 * carrying 0.43 of their own, so the crown reaches about 0.72 of the foliage
 * scale — and the grass disc at the foot reaches the same. Planting has to
 * respect the crown, not the trunk.
 *
 * @param {number} foliageScale
 * @returns {number}
 */
export const canopyRadius = (foliageScale) => foliageScale * 0.72

/**
 * Is a circle of this radius clear of every radial path?
 * @param {number} x
 * @param {number} z
 * @param {number} radius
 * @returns {boolean}
 */
export function clearOfRadialPaths(x, z, radius) {
  const halfWidth = RADIAL_PATH.width / 2
  return RADIAL_PATH.angles.every((angle) => {
    // Distance along the path's direction, and away from its centre line.
    const along = x * Math.sin(angle) + z * Math.cos(angle)
    const perpendicular = Math.abs(x * Math.cos(angle) - z * Math.sin(angle))
    const beyondEnds = along < RADIAL_PATH.start - radius || along > RADIAL_PATH.end + radius
    return beyondEnds || perpendicular > halfWidth + radius
  })
}

/**
 * Does a circle of this radius sit wholly on the grass, clear of every path?
 * @param {number} x
 * @param {number} z
 * @param {number} radius
 * @returns {boolean}
 */
export function fitsOnGrass(x, z, radius) {
  const distance = Math.hypot(x, z)
  if (distance - radius < GRASS_BAND.inner) return false
  if (distance + radius > GRASS_BAND.outer) return false
  return clearOfRadialPaths(x, z, radius)
}

/**
 * Find a spot near the one asked for that a circle of this radius fits in.
 *
 * The distance from the centre is clamped into the grass band first, then the
 * angle is walked away from wherever it landed until the paths are clear.
 * Returns null if nothing within a quarter turn works, which happens when the
 * canopy is simply wider than the gap between two paths.
 *
 * @param {number} angle
 * @param {number} distance
 * @param {number} radius
 * @returns {[number, number]|null} [x, z]
 */
export function placeOnGrass(angle, distance, radius) {
  const clearance = radius + PLANTING_MARGIN
  const nearest = Math.max(
    GRASS_BAND.inner + clearance,
    Math.min(GRASS_BAND.outer - clearance, distance)
  )
  // No room between the fountain ring and the walkway for a crown this wide.
  if (nearest - clearance < GRASS_BAND.inner) return null
  if (nearest + clearance > GRASS_BAND.outer) return null

  const stepSize = Math.PI / 90 // two degrees
  for (let step = 0; step <= 45; step += 1) {
    for (const direction of step === 0 ? [1] : [1, -1]) {
      const candidate = angle + direction * step * stepSize
      const x = Math.cos(candidate) * nearest
      const z = Math.sin(candidate) * nearest
      if (clearOfRadialPaths(x, z, clearance)) return [x, z]
    }
  }
  return null
}
