import {
  SNOW_GLOBE_CONTENT_SCALE,
  SNOW_GLOBE_DOME_RADIUS,
  SNOW_GLOBE_DOME_RISE
} from '../components/SnowGlobe'

/**
 * Where the inside of the globe ends, in the city's own units.
 *
 * Everything in the city is modelled at its own scale and then shrunk to fit
 * inside the glass, so the dome's numbers have to be brought into that scale
 * before anything in the city can be held inside them.
 *
 * The important number is not the radius of the sphere, it is how wide the
 * glass is where it meets the ground. The dome is a ball sitting most of the
 * way above the floor, so at the floor it is a good deal narrower than at the
 * top: fifty-one units across up where the clouds are, thirty-eight down
 * where the rain lands. Rain was falling from as far out as forty-six, which
 * put whole columns of it outside the ornament, running down past the rim and
 * the wooden base.
 */

/** The glass, as a sphere in city units. */
export const GLASS = {
  radius: SNOW_GLOBE_DOME_RADIUS / SNOW_GLOBE_CONTENT_SCALE,
  centreY: SNOW_GLOBE_DOME_RISE / SNOW_GLOBE_CONTENT_SCALE
}

/** A little clear of it, so nothing is drawn intersecting the glass itself. */
const MARGIN = 2

/**
 * How wide the glass is at a given height.
 *
 * @param {number} y - Height above the city floor.
 * @returns {number} Zero above or below the sphere entirely.
 */
export function glassRadiusAt(y) {
  const rise = y - GLASS.centreY
  const span = GLASS.radius * GLASS.radius - rise * rise
  return span <= 0 ? 0 : Math.sqrt(span)
}

/**
 * The widest a column of falling anything may be.
 *
 * Measured at the floor, because a drop falls straight down: a column that
 * fits where it starts but not where it lands still ends up outside.
 */
export const FALL_RADIUS = Math.max(0, glassRadiusAt(0) - MARGIN)

/**
 * Pull a point in until it is inside the glass at ground level.
 *
 * Toward the middle rather than rejected and resampled, so the caller always
 * gets an answer: a drop at the edge of a cloud that overhangs the glass
 * falls from the part of that cloud which is over the city instead.
 *
 * @param {{ x: number, z: number }} point
 * @param {number} [limit]
 * @returns {{ x: number, z: number }}
 */
export function containToFall(point, limit = FALL_RADIUS) {
  const reach = Math.hypot(point.x, point.z)
  if (reach <= limit || reach === 0) return point
  const pull = limit / reach
  return { ...point, x: point.x * pull, z: point.z * pull }
}

/**
 * Is this inside the glass at all?
 *
 * For anything that moves sideways as it falls — snow sways, and wind pushes
 * it — which can carry it out through the side even though it started in.
 *
 * @returns {boolean}
 */
export function insideGlass(x, y, z) {
  const rise = y - GLASS.centreY
  return x * x + rise * rise + z * z <= GLASS.radius * GLASS.radius
}
