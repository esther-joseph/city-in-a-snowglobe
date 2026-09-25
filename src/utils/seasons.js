/**
 * Season resolution and the palette each season paints the park with.
 *
 * Seasons follow the meteorological convention (three whole months each) and
 * flip below the equator, so a July city in Sydney is in winter while a July
 * city in Oslo is in summer. The date used is the city's local date — derived
 * from the observation time plus the city's UTC offset — not the viewer's, so
 * a city that has already rolled into the next month gets the new season.
 * Near the equator seasons are suppressed entirely.
 */

import { complementOf, hexToHsl, pastel } from './colorHarmony'

/**
 * A season's flowers, from its trees.
 *
 * Same family as the canopy overhead, a long way lighter, and leaning on the
 * far side of the wheel for two of the five. A bed painted in the canopy's own
 * colours disappears into the grass in summer and into the leaf litter in
 * autumn; a bed painted at random belongs to no season at all. This is the
 * middle: pale enough to read against planting, related enough to belong to
 * it.
 *
 * @param {string[]} canopy
 * @returns {string[]}
 */
function flowersFrom(canopy) {
  // Spring's canopy includes plain white, which has no hue to borrow and
  // would come back as five white flowers.
  const coloured = canopy.filter((colour) => hexToHsl(colour).s > 0.12)
  const source = coloured.length >= 2 ? coloured : canopy
  const pick = (index) => source[index % source.length]

  // Fixed steps around the wheel rather than whatever variety the canopy
  // happens to have. Spring's is five shades of the same pink, and asking for
  // pastels of three of them gives the same pastel three times.
  return [
    pastel(complementOf(pick(0), 0.42)),
    pastel(pick(0)),
    pastel(complementOf(pick(1), 0.55)),
    pastel(complementOf(pick(2), 0.14)),
    pastel(complementOf(pick(2), 0.3))
  ]
}

export const SEASONS = {
  WINTER: 'winter',
  SPRING: 'spring',
  SUMMER: 'summer',
  AUTUMN: 'autumn'
}

// Northern hemisphere, indexed by month (0 = January).
const NORTHERN_BY_MONTH = [
  SEASONS.WINTER, SEASONS.WINTER, SEASONS.SPRING,
  SEASONS.SPRING, SEASONS.SPRING, SEASONS.SUMMER,
  SEASONS.SUMMER, SEASONS.SUMMER, SEASONS.AUTUMN,
  SEASONS.AUTUMN, SEASONS.AUTUMN, SEASONS.WINTER
]

const OPPOSITE = {
  [SEASONS.WINTER]: SEASONS.SUMMER,
  [SEASONS.SUMMER]: SEASONS.WINTER,
  [SEASONS.SPRING]: SEASONS.AUTUMN,
  [SEASONS.AUTUMN]: SEASONS.SPRING
}

// Within roughly ten degrees of the equator there is no seasonal swing to
// show: the vegetation stays green all year, so Quito in December should not
// be standing in bare winter trees the way Denver is.
const TROPICAL_LATITUDE = 10

/**
 * @param {number} month - 0-11
 * @param {number} latitude - degrees; negative is the southern hemisphere
 * @returns {string} one of SEASONS
 */
export function seasonForMonth(month, latitude = 0) {
  if (Math.abs(latitude) < TROPICAL_LATITUDE) return SEASONS.SUMMER
  const northern = NORTHERN_BY_MONTH[((month % 12) + 12) % 12]
  return latitude < 0 ? OPPOSITE[northern] : northern
}

/**
 * Season where the weather is being reported, using the city's local time.
 * @param {Object|null} weatherData - OpenWeather current-weather payload
 * @param {Date} [now] - fallback when no weather has loaded yet
 * @returns {string} one of SEASONS
 */
export function getSeason(weatherData, now = new Date()) {
  const latitude = weatherData?.coord?.lat ?? 0

  if (weatherData?.dt !== undefined && weatherData?.timezone !== undefined) {
    const localMs = (weatherData.dt + weatherData.timezone) * 1000
    return seasonForMonth(new Date(localMs).getUTCMonth(), latitude)
  }

  return seasonForMonth(now.getMonth(), latitude)
}

const SPRING_CANOPY = ['#ffffff', '#ffd9e8', '#ffc2da', '#fff5f9', '#ffb7d5']
const SUMMER_CANOPY = ['#2d7a2f', '#3a9c3c', '#4db84f', '#56cc58', '#3f8f3d']
const AUTUMN_CANOPY = ['#c9682a', '#e0932f', '#b5471f', '#d98324', '#a85d22']

/**
 * Per-season look for the park. `fall` describes the drifting petals or leaves;
 * null means nothing falls that season.
 */
export const SEASON_PALETTES = {
  [SEASONS.WINTER]: {
    label: 'Winter',
    // Bare branches: no canopy spheres are drawn at all.
    bareTrees: true,
    canopy: ['#6d5a45', '#7a6650', '#5f4e3c', '#6b5a47', '#57483a'],
    blossom: null,
    trunk: '#5f452c',
    grass: '#7e8a72',
    grassTuft: '#78856d',
    bush: ['#6f6255', '#7b6e5f', '#655a4d'],
    showFlowers: false,
    flowers: [],
    fall: null
  },
  [SEASONS.SPRING]: {
    label: 'Spring',
    bareTrees: false,
    // A tree in blossom is not a green tree with flowers stuck on it — the
    // crown is the blossom, white on one tree and pink on the next. Same
    // mechanism as autumn: one colour per tree, variety across the stand.
    solidCanopy: true,
    canopy: SPRING_CANOPY,
    // Still dotted through the crown, which reads as depth now that the crown
    // is pale rather than green.
    blossom: ['#ffe8f2', '#ffffff', '#ffc2da', '#ffd9e8'],
    trunk: '#7a4f28',
    grass: '#5aa84a',
    grassTuft: '#48944a',
    bush: ['#5aa84a', '#6cba59', '#4f9e43'],
    showFlowers: true,
    flowers: flowersFrom(SPRING_CANOPY),
    fall: {
      kind: 'petal',
      colors: ['#ffd9e8', '#ffffff', '#ffc2da', '#ffb7d5'],
      // Instanced, so more petals cost a bigger buffer rather than more draw
      // calls — the same trade autumn's leaves make.
      count: 240,
      size: 0.16,
      speed: 0.9
    }
  },
  [SEASONS.SUMMER]: {
    label: 'Summer',
    bareTrees: false,
    // The original palette: summer is the look the park was built around.
    canopy: SUMMER_CANOPY,
    blossom: null,
    trunk: '#7a4f28',
    grass: '#4a8c3f',
    grassTuft: '#3d7a32',
    bush: ['#2f8032', '#3a9c3c', '#46ae48'],
    showFlowers: true,
    flowers: flowersFrom(SUMMER_CANOPY),
    fall: null
  },
  [SEASONS.AUTUMN]: {
    label: 'Autumn',
    bareTrees: false,
    // One colour per tree rather than one per lobe. A turning canopy is the
    // same leaf all over; mixing five shades within a crown read as a fruit
    // salad. The variety moves to the stand: each tree draws its own.
    solidCanopy: true,
    canopy: AUTUMN_CANOPY,
    blossom: null,
    trunk: '#6b4526',
    grass: '#94904a',
    grassTuft: '#8a8445',
    bush: ['#b56a2a', '#c98833', '#9c5526'],
    showFlowers: true,
    flowers: flowersFrom(AUTUMN_CANOPY),
    fall: {
      kind: 'leaf',
      colors: ['#c9682a', '#e0932f', '#b5471f', '#d98324'],
      // Instanced, so the cost of more is a bigger buffer rather than more
      // draw calls.
      count: 260,
      size: 0.22,
      speed: 1.15
    }
  }
}

/**
 * @param {string} season
 * @returns {Object} palette, defaulting to summer for anything unrecognised
 */
export function getSeasonPalette(season) {
  return SEASON_PALETTES[season] || SEASON_PALETTES[SEASONS.SUMMER]
}
