/**
 * Fahrenheit and Celsius, in one place.
 *
 * The weather is fetched in imperial and converted here for display rather
 * than refetched per unit. Two reasons: a refetch would spend an API call and
 * blow the fifteen-minute cache every time someone taps the toggle, and every
 * temperature in the app then comes from one number, so the panel and the
 * cards can never disagree about how warm it is.
 */

export const UNITS = {
  FAHRENHEIT: 'fahrenheit',
  CELSIUS: 'celsius'
}

/** Fahrenheit is the default, so this is the identity case. */
export const DEFAULT_UNIT = UNITS.FAHRENHEIT

export const UNIT_SUFFIX = {
  [UNITS.FAHRENHEIT]: '°F',
  [UNITS.CELSIUS]: '°C'
}

/**
 * @param {number} fahrenheit
 * @param {string} unit
 * @returns {number} The same temperature in the chosen unit, unrounded.
 */
export function convert(fahrenheit, unit) {
  if (unit !== UNITS.CELSIUS) return fahrenheit
  return ((fahrenheit - 32) * 5) / 9
}

/**
 * A temperature ready to show, degree sign and all.
 *
 * @param {number|null|undefined} fahrenheit
 * @param {string} unit
 * @param {Object} [options]
 * @param {boolean} [options.withUnit=false] - Append F or C after the degree.
 * @param {string} [options.fallback='--'] - Shown when there is no reading.
 * @returns {string}
 */
export function formatTemp(fahrenheit, unit = DEFAULT_UNIT, { withUnit = false, fallback = '--' } = {}) {
  if (fahrenheit === null || fahrenheit === undefined || Number.isNaN(fahrenheit)) {
    return fallback
  }
  const value = Math.round(convert(fahrenheit, unit))
  return withUnit ? `${value}${UNIT_SUFFIX[unit] || '°'}` : `${value}°`
}
