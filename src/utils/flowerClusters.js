/**
 * Flowers on the grass, in ones and twos and threes.
 *
 * The formal planting is in the beds around the fountain. Out here the park
 * is informal, and this is what grows in it: the same scattering the park
 * always had, but clumped the way flowers actually come up, one here and
 * three there, rather than one daisy every few metres like a planted pattern.
 *
 * A clump is one colour, because a clump is one plant that has spread.
 */

/** How many flowers in a clump, and how likely each is. */
const CLUMP_SIZES = [1, 1, 2, 2, 3]

/** How much smaller each flower gets as the clump grows, so it still fits. */
const CROWDING = [1, 0.82, 0.72]

/**
 * @typedef {Object} Flower
 * @property {[number, number, number]} position
 * @property {number} scale
 * @property {string} color
 * @property {number} yaw
 */

/**
 * Fill a spot with a clump.
 *
 * @param {Object} options
 * @param {[number, number]} options.at - Middle of the clump, on the grass.
 * @param {number} options.radius - What the planting cleared for it.
 * @param {string} options.color
 * @param {number} [options.ground]
 * @param {() => number} [options.random] - Injectable, for the tests.
 * @returns {Flower[]}
 */
export function clumpAt({ at, radius, color, ground = 0.1, random = Math.random }) {
  const count = CLUMP_SIZES[Math.floor(random() * CLUMP_SIZES.length)]
  const scale = radius * CROWDING[count - 1]
  // Where the clump sits within its own spot: far enough apart to read as
  // separate flowers, close enough to read as one clump.
  const spread = count > 1 ? radius - scale : 0
  const turn = random() * Math.PI * 2

  return Array.from({ length: count }, (unused, i) => {
    const angle = turn + (i / count) * Math.PI * 2
    return {
      position: [
        at[0] + Math.cos(angle) * spread,
        ground,
        at[1] + Math.sin(angle) * spread
      ],
      scale,
      color,
      // Each one faces its own way, or three of the same head line up.
      yaw: random() * Math.PI * 2
    }
  })
}

/**
 * The three rings of clumps, out on the grass beyond the beds.
 *
 * @param {Object} options
 * @param {(angle: number, distance: number, radius: number) => [number, number]|null}
 *   options.place - The park's own placement, carrying its obstacles.
 * @param {string[]} options.palette
 * @param {() => number} [options.random]
 * @returns {Flower[]}
 */
export function scatterFlowers({ place, palette, random = Math.random }) {
  if (palette.length === 0) return []

  const rings = [
    // The innermost ring clears the beds around the fountain, which reach to
    // about eight.
    { count: 26, distance: 9.4, radius: 0.26 },
    { count: 32, distance: 12.7, radius: 0.3 },
    { count: 34, distance: 14.6, radius: 0.28 }
  ]

  const flowers = []
  rings.forEach((ring, ringIndex) => {
    for (let i = 0; i < ring.count; i += 1) {
      const angle = (i / ring.count) * Math.PI * 2 + ringIndex * 0.11
      const distance = ring.distance + ((i % 3) - 1) * 0.55
      const spot = place(angle, distance, ring.radius)
      if (!spot) continue
      flowers.push(
        ...clumpAt({
          at: spot,
          radius: ring.radius,
          // Offset per ring so neighbouring rings do not line up in stripes.
          color: palette[(i + ringIndex * 2) % palette.length],
          random
        })
      )
    }
  })

  return flowers
}
