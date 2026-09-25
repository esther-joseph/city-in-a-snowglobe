/**
 * The things in the park that were put there by hand.
 *
 * The benches and the lamp posts are placed deliberately, at coordinates that
 * were chosen rather than generated, and three separate places need to agree
 * about where they are: the components that draw them, the planting that has
 * to avoid them, and the AR viewpoints that stand a person next to one. They
 * were written out three times, with a comment in two of them asking whoever
 * changed one to remember the others. This is the one copy instead.
 */

/** Benches on the diagonals between the radial paths, all facing the fountain. */
export const BENCHES = [
  { position: [6.0, 0.25, 6.0], rotation: [0, Math.PI * 1.25, 0], seat: 0.75 },
  { position: [-6.0, 0.25, 6.0], rotation: [0, Math.PI * 0.75, 0], seat: 0.75 },
  { position: [-6.0, 0.25, -6.0], rotation: [0, Math.PI * 0.25, 0], seat: 0.75 },
  { position: [6.0, 0.25, -6.0], rotation: [0, -Math.PI * 0.25, 0], seat: 0.75 }
]

/**
 * A lamp beside each bench, set off to one side rather than in front of it, so
 * it lights the seat without standing in the view from it.
 */
export const LAMP_POSTS = [
  [7.4, 0, 5.2],
  [-5.2, 0, 7.4],
  [-7.4, 0, -5.2],
  [5.2, 0, -7.4]
]

/** A bench is 2.4 long and 0.6 deep, so this is the circle it needs. */
const BENCH_RADIUS = 1.35
/** The post itself is slim; the flared base and the reach of the arm are not. */
const LAMP_RADIUS = 0.95

/**
 * Circles nothing may be planted in.
 *
 * Bushes were being grown through bench arms and rocks were being dropped at
 * the foot of lamp posts, because the planting only knew about the paving.
 * Anything placed on the grass checks against this.
 *
 * @param {Object} [options]
 * @param {Array<[number, number, number]>} [options.extra] - More circles as
 *   [x, z, radius], for anything placed later that has to be respected too.
 * @returns {Array<[number, number, number]>} [x, z, radius]
 */
export function furnitureObstacles({ extra = [] } = {}) {
  return [
    ...BENCHES.map((bench) => [bench.position[0], bench.position[2], BENCH_RADIUS]),
    ...LAMP_POSTS.map((post) => [post[0], post[2], LAMP_RADIUS]),
    ...extra
  ]
}
