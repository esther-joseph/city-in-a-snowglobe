/**
 * Where the sun and moon actually are, for a given place and moment.
 *
 * Standard astronomical formulae (Meeus, low-precision forms): ecliptic
 * coordinates for the body, converted to equatorial, then to the horizontal
 * frame of an observer at a latitude and longitude. Accurate to well under a
 * degree for the sun, about a degree for the moon — far beyond what the scene
 * needs, and enough for the compass to be honest.
 *
 * Azimuth is returned as a compass bearing: degrees clockwise from true north,
 * so 90 is due east and 180 due south. Altitude is degrees above the horizon,
 * negative when the body has set.
 */
const RAD = Math.PI / 180
const DAY_MS = 86400000
const J1970 = 2440588
const J2000 = 2451545
// Obliquity of the ecliptic.
const E = RAD * 23.4397

const toDays = (date) => date.valueOf() / DAY_MS - 0.5 + J1970 - J2000

const rightAscension = (l, b) =>
  Math.atan2(Math.sin(l) * Math.cos(E) - Math.tan(b) * Math.sin(E), Math.cos(l))

const declination = (l, b) =>
  Math.asin(Math.sin(b) * Math.cos(E) + Math.cos(b) * Math.sin(E) * Math.sin(l))

/** Hour angle of the meridian at this longitude. */
const siderealTime = (d, lw) => RAD * (280.16 + 360.9856235 * d) - lw

const altitude = (H, phi, dec) =>
  Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H))

/** Measured from south, clockwise — converted to a compass bearing below. */
const azimuthFromSouth = (H, phi, dec) =>
  Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi))

function sunEquatorial(d) {
  const M = RAD * (357.5291 + 0.98560028 * d)
  // Equation of centre, then perihelion of the Earth's orbit.
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
  const L = M + C + RAD * 102.9372 + Math.PI
  return { dec: declination(L, 0), ra: rightAscension(L, 0) }
}

function moonEquatorial(d) {
  const L = RAD * (218.316 + 13.176396 * d) // mean longitude
  const M = RAD * (134.963 + 13.064993 * d) // mean anomaly
  const F = RAD * (93.272 + 13.229350 * d) // mean distance from ascending node

  const longitude = L + RAD * 6.289 * Math.sin(M)
  const latitude = RAD * 5.128 * Math.sin(F)

  return { dec: declination(longitude, latitude), ra: rightAscension(longitude, latitude) }
}

function horizontal(equatorial, date, latitude, longitude) {
  const lw = RAD * -longitude
  const phi = RAD * latitude
  const d = toDays(date)
  const H = siderealTime(d, lw) - equatorial.ra

  const alt = altitude(H, phi, equatorial.dec)
  const bearing = (azimuthFromSouth(H, phi, equatorial.dec) / RAD + 180 + 360) % 360

  return { azimuth: bearing, altitude: alt / RAD }
}

/**
 * @param {Date} date
 * @param {number} latitude - degrees, north positive
 * @param {number} longitude - degrees, east positive
 * @returns {{ azimuth: number, altitude: number }} compass bearing and degrees above the horizon
 */
export function sunPosition(date, latitude, longitude) {
  return horizontal(sunEquatorial(toDays(date)), date, latitude, longitude)
}

/**
 * @param {Date} date
 * @param {number} latitude
 * @param {number} longitude
 * @returns {{ azimuth: number, altitude: number }}
 */
export function moonPosition(date, latitude, longitude) {
  return horizontal(moonEquatorial(toDays(date)), date, latitude, longitude)
}

/**
 * Horizontal coordinates to scene coordinates.
 *
 * The scene's compass is fixed: −Z is north and +X is east, which is what the
 * cardinal marks on the base ring are drawn against.
 *
 * @param {{ azimuth: number, altitude: number }} position
 * @param {number} radius
 * @returns {[number, number, number]}
 */
export function toScenePosition({ azimuth, altitude: alt }, radius) {
  const a = azimuth * RAD
  const h = alt * RAD
  return [
    radius * Math.cos(h) * Math.sin(a),
    radius * Math.sin(h),
    -radius * Math.cos(h) * Math.cos(a)
  ]
}
