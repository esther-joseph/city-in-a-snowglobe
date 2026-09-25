/**
 * Flower beds, the way a park plants them.
 *
 * A cut plot of turned earth, edged in iron, with the planting inside it in
 * rings of one colour at a time. They ring the fountain, on the first band of
 * grass outside its paving, which is where a park puts its formal planting:
 * where everyone walking round the water passes them and everyone sitting on
 * the benches looks at them. Further out the park is informal, and the
 * flowers there are clumps on the grass rather than beds.
 *
 * This works out where the plots go and what is planted in each. Where they
 * go is handed in, because the park is planted in one pass and a bed has to
 * clear the paths and the benches like everything else.
 */
import { FOUNTAIN_RING } from './parkLayout'

/** Rows inside a plot: the middle, then two rings out toward the edge. */
const ROWS = [
  { at: 0, count: 1 },
  { at: 0.46, count: 7 },
  { at: 0.8, count: 12 }
]

/** How far inside the edging the outermost row sits. */
const MARGIN = 0.22

/** And how much grass is left between a plot's edging and the paving. */
const BED_MARGIN = 0.3

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
 * Where the plots go: a ring of them on the grass around the fountain.
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
  // Eight of them around the fountain, set between the radial paths rather
  // than across them: a bed is as close to the water as it can be while its
  // whole plot is still on the grass.
  const count = 8
  const radius = 0.95
  const distance = FOUNTAIN_RING.outer + radius + BED_MARGIN

  const plots = []
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + Math.PI / count
    const spot = place(angle, distance, radius)
    if (!spot) continue
    plots.push({ key: `bed-${i}`, at: spot, radius })
  }

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
