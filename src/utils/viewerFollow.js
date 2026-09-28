/**
 * How a panel follows the person looking at it.
 *
 * Two bad extremes bracket this. A panel welded to the head can never be
 * looked at or looked away from, and makes people ill. A panel left at the
 * spot the session started at is, three steps later, behind the viewer in a
 * corner of the room — which is how the AR controls went missing.
 *
 * What is wanted between them is slack. The panel stays where it is while the
 * viewer shifts their weight and glances around, and only once they have
 * properly moved does it come after them, easing rather than snapping, and
 * carrying on until it has caught up rather than stopping the instant they
 * are back inside the slack.
 *
 * That last part is why this is a state machine rather than a comparison: a
 * follow that starts and stops on the same threshold judders against it.
 */

/** How far the viewer may move before it comes after them, in metres. */
export const FOLLOW_SLACK = 0.25
/** And how far they may turn, in radians: a little over twenty degrees. */
export const TURN_SLACK = 0.35
/** Once it is coming, it comes until it is this close. */
export const SETTLED = 0.02
export const SETTLED_TURN = 0.03
/** How fast it closes the gap: the fraction left after a second is e^-this. */
export const CHASE = 3.2

/**
 * One frame of the chase.
 *
 * @param {object} params
 * @param {number} params.gap - How far off it is now.
 * @param {boolean} params.chasing - Whether it was already on its way.
 * @param {number} params.delta - Seconds since the last frame.
 * @param {number} [params.slack] - How far it may drift before setting off.
 * @param {number} [params.settled] - How close counts as arrived.
 * @param {number} [params.rate] - How hard it closes.
 * @returns {{ chasing: boolean, fraction: number }} How much of the gap to
 *   close this frame, and whether it is still on its way.
 */
export function followStep({
  gap,
  chasing,
  delta,
  slack = FOLLOW_SLACK,
  settled = SETTLED,
  rate = CHASE
}) {
  const moving = chasing ? gap > settled : gap > slack
  if (!moving) return { chasing: false, fraction: 0 }

  // Exponential, off the frame time rather than a flat fraction per frame, so
  // it eases the same way on a 72Hz headset as on a 120Hz one.
  return { chasing: true, fraction: 1 - Math.exp(-rate * Math.max(delta, 0)) }
}

/**
 * The shortest way round from one heading to another, in radians.
 *
 * Without this, a viewer facing a hair west of due south has the panel take
 * the long way round — most of a full turn — to reach a hair east of it.
 */
export function shortestTurn(from, to) {
  let turn = (to - from) % (Math.PI * 2)
  if (turn > Math.PI) turn -= Math.PI * 2
  if (turn < -Math.PI) turn += Math.PI * 2
  return turn
}

/**
 * The heading a group needs so its front faces the given direction.
 *
 * A group's front is -Z, which after a turn of θ about Y points at
 * (-sin θ, 0, -cos θ). Hence the negations; they are not a guess.
 */
export const headingFor = (x, z) => Math.atan2(-x, -z)
