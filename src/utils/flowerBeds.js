/**
 * Flower beds, the way a park plants them.
 *
 * The flowers used to be scattered: three rings of single daisies at slightly
 * jittered radii, each its own colour, all the way around the park. Nobody
 * plants like that. A park puts its flowers in beds — a cut plot of turned
 * earth, edged, with the planting inside it in rings of one colour at a time.
 *
 * This works out where those plots go and what is planted in each. Where they
 * go is handed in, because the park is planted in one pass and a bed has to
 * clear the paths and the benches like everything else.
 */

/** Rows inside a plot: the middle, then two rings out toward the edge. */
const ROWS = [
  { at: 0, count: 1 },
  { at: 0.46, count: 7 },
  { at: 0.8, count: 12 }
]

/** How far inside the edging the outermost row sits. */
const MARGIN = 0.22

/**
 * @typedef {Object} Bed
 * @property {string} key
 * @property {[number, number]} at - Middle of the plot, on the grass.
 * @property {number} radius - Out to the edging.
 * @property {Array<{ position: [number, number, number], scale: number,
 *   color: string, yaw: number }>} flowers
 */

/**
 * Lay out one bed.
 *
 * Two colours: the middle row and the outer ring, the way bedding is planted
 * in blocks rather than mixed. Which two comes from the bed's own index, so a
 * park has variety across its beds and none within one.
 *
 * @param {Object} options
 * @param {string} options.key
 * @param {[number, number]} options.at
 * @param {number} options.radius
 * @param {string[]} options.palette
 * @param {number} options.index - Which bed this is, for choosing colours.
 * @param {number} [options.ground] - Height of the soil the flowers sit on.
 * @returns {Bed}
 */
export function layOutBed({ key, at, radius, palette, index, ground = 0.12 }) {
  const inner = palette[index % palette.length]
  const outer = palette[(index + 3) % palette.length]
  const planted = radius - MARGIN
  const flowers = []

  ROWS.forEach((row, rowIndex) => {
    // A flower is sized to the gap between its neighbours, so a bed reads as
    // planted rather than as a few daisies sharing a plot.
    const spacing = row.count > 1 ? (Math.PI * 2 * planted * row.at) / row.count : planted
    const scale = Math.min(0.3, Math.max(0.17, spacing * 0.42))

    for (let i = 0; i < row.count; i += 1) {
      const angle = row.count > 1 ? (i / row.count) * Math.PI * 2 + rowIndex * 0.3 : 0
      const distance = planted * row.at
      flowers.push({
        position: [at[0] + Math.cos(angle) * distance, ground, at[1] + Math.sin(angle) * distance],
        scale,
        // Rows of one colour at a time. The middle takes the second one, so
        // the bed reads as a ring around a heart rather than as a gradient.
        color: rowIndex === 1 ? inner : outer,
        // Turned to face out of the bed, which is how they are set out and
        // stops a ring of identical heads lining up.
        yaw: -angle
      })
    }
  })

  return { key, at, radius, flowers }
}

/**
 * Where the plots go: two rings of them, on the diagonals where the grass is
 * widest, near enough to the paths to be seen from them.
 *
 * Separate from what is planted in them, because the two happen at different
 * times. A plot is cut once, with the rest of the park, so that the bushes
 * and the stones that follow can clear it; what grows in it changes with the
 * season, and the park is not dug up every time it does.
 *
 * @param {Object} options
 * @param {(angle: number, distance: number, radius: number) => [number, number]|null}
 *   options.place - The park's own placement, already carrying its obstacles.
 * @returns {Array<{ key: string, at: [number, number], radius: number }>}
 */
export function placeBedPlots({ place }) {
  const rings = [
    // Inside, where they are seen from the benches and the fountain ring.
    { count: 4, distance: 7.4, radius: 1.05, offset: Math.PI / 4 },
    // And out among the trees, between the radial paths.
    { count: 4, distance: 12.4, radius: 1.25, offset: Math.PI / 4 }
  ]

  const plots = []
  rings.forEach((ring, ringIndex) => {
    for (let i = 0; i < ring.count; i += 1) {
      const angle = (i / ring.count) * Math.PI * 2 + ring.offset
      const spot = place(angle, ring.distance, ring.radius)
      if (!spot) continue
      plots.push({ key: `bed-${ringIndex}-${i}`, at: spot, radius: ring.radius })
    }
  })

  return plots
}

/**
 * Plant the plots for a season.
 *
 * @param {Array<{ key: string, at: [number, number], radius: number }>} plots
 * @param {string[]} palette
 * @returns {Bed[]}
 */
export function plantBeds(plots, palette) {
  if (palette.length === 0) return []
  return plots.map((plot, index) => layOutBed({ ...plot, palette, index }))
}
