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
    canopy: ['#4f9e43', '#5cb44e', '#6ec45f', '#7ed070', '#58a84c'],
    // Blossom clusters dotted through the canopy.
    blossom: ['#ffd9e8', '#ffffff', '#ffc2da', '#ffe8f2'],
    trunk: '#7a4f28',
    grass: '#5aa84a',
    grassTuft: '#48944a',
    bush: ['#5aa84a', '#6cba59', '#4f9e43'],
    showFlowers: true,
    flowers: ['#ff9fcc', '#ffffff', '#ffc2da', '#ffd7ea', '#f7a8c4', '#fde2f0'],
    fall: {
      kind: 'petal',
      colors: ['#ffd9e8', '#ffffff', '#ffc2da'],
      count: 90,
      size: 0.16,
      speed: 0.9
    }
  },
  [SEASONS.SUMMER]: {
    label: 'Summer',
    bareTrees: false,
    // The original palette: summer is the look the park was built around.
    canopy: ['#2d7a2f', '#3a9c3c', '#4db84f', '#56cc58', '#3f8f3d'],
    blossom: null,
    trunk: '#7a4f28',
    grass: '#4a8c3f',
    grassTuft: '#3d7a32',
    bush: ['#2f8032', '#3a9c3c', '#46ae48'],
    showFlowers: true,
    flowers: ['#ff6b8a', '#ffcd3c', '#ff8c42', '#c084fc', '#f472b6', '#86efac', '#ff9fcc', '#a5f3fc'],
    fall: null
  },
  [SEASONS.AUTUMN]: {
    label: 'Autumn',
    bareTrees: false,
    canopy: ['#c9682a', '#e0932f', '#b5471f', '#d98324', '#a85d22'],
    blossom: null,
    trunk: '#6b4526',
    grass: '#94904a',
    grassTuft: '#8a8445',
    bush: ['#b56a2a', '#c98833', '#9c5526'],
    showFlowers: true,
    flowers: ['#d97706', '#b45309', '#ea9d3a', '#c2410c', '#a16207', '#e2b04a'],
    fall: {
      kind: 'leaf',
      colors: ['#c9682a', '#e0932f', '#b5471f', '#d98324'],
      count: 110,
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
