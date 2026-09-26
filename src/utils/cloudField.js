import { createContext, useContext, useMemo } from 'react'

/**
 * Where the clouds are, for the things that fall out of them.
 *
 * Rain, snow and lightning were each scattered over their own patch of sky
 * and dropped from a fixed height: rain over a disc of radius 32, snow over a
 * square of 80, bolts over another. The clouds, meanwhile, sat in a ring out
 * near the glass. So it rained everywhere except under a cloud, and the two
 * never had anything to do with each other.
 *
 * The clouds publish where they are on every frame — they drift with the wind
 * and wrap around, so it cannot be worked out once — and whatever falls asks
 * for a cloud to fall out of.
 *
 * A live object rather than state: this is read in a frame loop by three
 * other components, and a re-render per frame for a cloud that moved half a
 * unit would be a poor trade.
 */

export const CloudFieldContext = createContext(null)

/** @returns {{ clouds: Array<{x: number, y: number, z: number, radius: number}> }} */
export function createCloudField() {
  return { clouds: [] }
}

export function useCloudField() {
  return useContext(CloudFieldContext)
}

/** A field of its own, for anything rendered outside a provider. */
export function useOwnCloudField() {
  return useMemo(() => createCloudField(), [])
}

/**
 * Say where one cloud is, now.
 *
 * Called from the cloud layer's own frame loop, once per cloud, because they
 * drift with the wind and wrap around: where they were when the scene was
 * built is not where they are.
 *
 * The footprint is a little inside the visible edge, so that what falls out
 * starts under the cloud rather than beside it, and the height is the
 * underside rather than the middle.
 *
 * @param {{ clouds: Array }} field
 * @param {number} index
 * @param {{ position: { x: number, y: number, z: number } }} cloud
 * @param {number} scale - The cloud's own scale, which sets how big it is.
 */
export function publishCloud(field, index, cloud, scale) {
  if (!field) return
  field.clouds[index] = {
    x: cloud.position.x,
    y: cloud.position.y - scale * 1.15,
    z: cloud.position.z,
    radius: scale * 2.4
  }
}

/**
 * Somewhere under a cloud.
 *
 * The point is drawn from the cloud's own footprint, so a drop starts inside
 * the shape it is falling out of rather than at its middle, and just below
 * its underside rather than inside it.
 *
 * @param {{ clouds: Array }} field
 * @param {() => number} [random] - Injectable, for the tests.
 * @returns {{ x: number, y: number, z: number }|null} Null when the sky is
 *   clear, which is the caller's cue to fall back to its own patch of sky:
 *   forced rain with the clouds suppressed still has to rain.
 */
export function sampleUnderCloud(field, random = Math.random) {
  const clouds = field?.clouds
  if (!clouds || clouds.length === 0) return null

  const cloud = clouds[Math.min(clouds.length - 1, Math.floor(random() * clouds.length))]
  if (!cloud) return null

  // Square rooted, or everything lands in a ring around the edge of the
  // cloud: an even spread over a disc needs the radius to go as the root.
  const angle = random() * Math.PI * 2
  const reach = Math.sqrt(random()) * cloud.radius

  return {
    x: cloud.x + Math.cos(angle) * reach,
    y: cloud.y,
    z: cloud.z + Math.sin(angle) * reach
  }
}

/**
 * Fill a column of falling things, under the clouds, from the ground up.
 *
 * Everything that falls is scattered through the sky when it mounts, before
 * any cloud has said where it is — there is nothing else it could do on the
 * first frame. Left alone, those first particles keep falling from wherever
 * they started until each one reaches the ground and is recycled, which for a
 * bolt drifting down from eighty units up is the better part of a minute of
 * lightning in a clear sky.
 *
 * So the first frame that has clouds in it reseeds the lot: each particle
 * under a cloud, at a random height between that cloud and the ground, which
 * is the state a steady fall settles into anyway.
 *
 * @param {{ clouds: Array }} field
 * @param {Float32Array} positions - Packed x, y, z per particle.
 * @param {number} count
 * @param {Object} [options]
 * @param {number} [options.floor=0] - Where the fall ends.
 * @param {() => number} [options.random]
 * @returns {boolean} Whether there were any clouds to seed from.
 */
export function seedUnderClouds(field, positions, count, { floor = 0, random = Math.random } = {}) {
  if (!field?.clouds?.length) return false

  for (let i = 0; i < count; i += 1) {
    const under = sampleUnderCloud(field, random)
    if (!under) return false
    positions[i * 3] = under.x
    positions[i * 3 + 1] = floor + random() * Math.max(0, under.y - floor)
    positions[i * 3 + 2] = under.z
  }

  return true
}
