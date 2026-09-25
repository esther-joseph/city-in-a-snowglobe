/**
 * Where you can stand, once you are inside the globe.
 *
 * Two ways of looking at it. Observational keeps the globe an object on the
 * table in front of you, the size a snow globe actually is. Immersive drops
 * you into the park at its own scale, where a tower is a tower and the dome is
 * a sky, and these are the places worth standing.
 *
 * Positions are derived from the park's own dimensions rather than typed in,
 * so that moving a path or widening the grass moves the viewpoints with it.
 * The exceptions are the benches and the tree ring, which are placed by hand
 * in City.jsx; the constants below have to match, and say so.
 */
import { FOUNTAIN_RING } from './parkLayout'

export const AR_VIEWS = {
  OBSERVATIONAL: 'observational',
  IMMERSIVE: 'immersive'
}

/**
 * The bench on the north-east diagonal, as City.jsx places it: the group sits
 * at 0.25 with the seat 0.5 above that, and it is turned to face the fountain.
 * Hand-placed there, so these have to match.
 */
const BENCH = { x: 6, z: 6, seat: 0.75 }

/** Eye above the seat, sitting upright. */
const SEATED_EYE = 0.75

/** Halfway between two radial paths, which is where the grass is widest. */
const BETWEEN_PATHS = Math.PI / 4

/**
 * The outer ring of full-size trees in City.jsx: this many, evenly spaced in
 * angle, at about this radius. Like the benches, these are its numbers and
 * have to match; the radius jitters by under a metre per tree, which the
 * clearance below absorbs.
 */
const TREE_RING = { count: 28, radius: 14.6 }

/**
 * How far off the trunk to stand, measured along the ring so that the metre of
 * jitter in a tree's own radius barely changes it.
 *
 * At the drip line rather than against the trunk. Standing at the trunk puts
 * the crown between the viewer and everything worth seeing; standing out at
 * the edge of it leaves the canopy overhead and the city visible underneath,
 * which is the whole of what this spot is for. The ring's trees sit about 3.3
 * apart, so at this distance the next one along is overhead too.
 */
const TRUNK_CLEARANCE = 1.4

/** Eye height, in the park's own units, where one unit reads as a metre. */
const EYE_HEIGHT = 1.6

/**
 * @typedef {Object} Viewpoint
 * @property {string} id
 * @property {string} label - On the button.
 * @property {string} blurb - What you get from standing there.
 * @property {[number, number, number]} position - Where the viewer stands.
 * @property {[number, number, number]} lookAt - What they face on arrival.
 */

/**
 * The three places to stand.
 *
 * Fountain and bench look inward and level, because what is worth seeing there
 * is the water and the skyline behind it. The tree looks up: the point of
 * standing under a canopy is the canopy, with the city and the sky through it.
 *
 * @returns {Viewpoint[]}
 */
export function getViewpoints() {
  // Just off the ring path around the fountain, on the paving, far enough back
  // to take the whole thing in rather than standing in the basin.
  const fountainDistance = FOUNTAIN_RING.outer + 0.9

  // Under an actual tree, not merely among them. The ring's angles are fixed,
  // so the nearest one to the diagonal is picked and then stepped sideways
  // along the ring, which puts the trunk at arm's length and the
  // crown overhead. Standing between two trees, which is where a plain
  // diagonal lands, leaves nothing but sky above.
  const treeIndex = Math.round(
    ((BETWEEN_PATHS + Math.PI / 2) / (Math.PI * 2)) * TREE_RING.count
  )
  const treeAngle =
    (treeIndex / TREE_RING.count) * Math.PI * 2 + TRUNK_CLEARANCE / TREE_RING.radius

  return [
    {
      id: 'fountain',
      label: 'Fountain',
      blurb: 'Beside the water, with the skyline behind it.',
      position: [
        Math.cos(BETWEEN_PATHS) * fountainDistance,
        EYE_HEIGHT,
        Math.sin(BETWEEN_PATHS) * fountainDistance
      ],
      lookAt: [0, 1.4, 0]
    },
    {
      id: 'bench',
      label: 'Bench',
      blurb: 'Sat down, looking across the park at the water.',
      // On the bench rather than beside it, which is the difference between
      // being in the park and standing about in it. The bench already faces
      // the fountain, so this faces the same way.
      position: [BENCH.x, BENCH.seat + SEATED_EYE, BENCH.z],
      lookAt: [0, 1.2, 0]
    },
    {
      id: 'trees',
      label: 'Under the trees',
      blurb: 'Looking up through the canopy at the city and the sky.',
      position: [
        Math.cos(treeAngle) * TREE_RING.radius,
        EYE_HEIGHT,
        Math.sin(treeAngle) * TREE_RING.radius
      ],
      // Up and inward: the canopy overhead, the towers past it, the dome above
      // that. A level gaze here would be a trunk.
      lookAt: [0, 16, 0]
    }
  ]
}

/**
 * The yaw that turns a viewer at `position` to face `lookAt`.
 *
 * Scene forward is -Z, which is why this is measured from there rather than
 * from +X.
 *
 * @param {[number, number, number]} position
 * @param {[number, number, number]} lookAt
 * @returns {number} Radians about Y.
 */
export function headingTowards(position, lookAt) {
  return Math.atan2(lookAt[0] - position[0], lookAt[2] - position[2]) + Math.PI
}

/**
 * How far the pitch has to tilt to meet the target, for viewpoints that look
 * up. Returned separately from the heading because a WebXR origin cannot be
 * pitched: the headset owns that axis, and forcing it would fight the neck of
 * whoever is wearing it. Callers use it to place the scene, not the viewer.
 *
 * @param {[number, number, number]} position
 * @param {[number, number, number]} lookAt
 * @returns {number} Radians, positive when the target is above.
 */
export function pitchTowards(position, lookAt) {
  const horizontal = Math.hypot(lookAt[0] - position[0], lookAt[2] - position[2])
  return Math.atan2(lookAt[1] - position[1], horizontal)
}

/**
 * Look a viewpoint up by id, falling back to the first one so a stale or
 * unknown id can never leave the viewer nowhere.
 *
 * @param {string} id
 * @returns {Viewpoint}
 */
export function getViewpoint(id) {
  const viewpoints = getViewpoints()
  return viewpoints.find((viewpoint) => viewpoint.id === id) ?? viewpoints[0]
}

/**
 * The transform to hand an XROrigin for a viewpoint.
 *
 * An origin marks the viewer's feet, not their eyes, so the y here is the
 * difference between the eye height the viewpoint wants and the height someone
 * standing up actually has. It is zero at the two standing spots and negative
 * at the bench, which lowers the viewer onto the seat without asking them to
 * sit down.
 *
 * `floor` is where the park's ground sits in the scene the origin lives in,
 * which is not the same place: the city is parked above the globe's base.
 *
 * @param {Viewpoint} viewpoint
 * @param {{ floor?: number }} [options]
 * @returns {{ position: [number, number, number], rotation: [number, number, number] }}
 */
export function originFor(viewpoint, { floor = 0 } = {}) {
  const [x, eye, z] = viewpoint.position
  return {
    position: [x, floor + eye - EYE_HEIGHT, z],
    rotation: [0, headingTowards(viewpoint.position, viewpoint.lookAt), 0]
  }
}
