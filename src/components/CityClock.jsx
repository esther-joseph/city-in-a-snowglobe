import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { SEASONS } from '../utils/seasons'
import './CityClock.css'

/**
 * The time and date where the city is, not where the reader is.
 *
 * The weather carries a timezone offset in seconds, which is the only thing
 * that makes this honest: a globe of Tokyo should read Tokyo's clock whoever
 * is looking at it.
 *
 * The ticking lives here rather than in App on purpose. BaseScene and
 * ShakeableScene are declared inside App, so every App render creates new
 * component types and React remounts the whole 3D subtree — a clock that
 * ticked in App state would tear down and rebuild the globe once a second.
 */

/**
 * The hue laid over the letters, by season.
 *
 * Summer is the plain iridescence the piece is named for — the full spread of
 * hues. The others tint it: the season should be readable from the clock
 * alone, without reading the date.
 */
const SEASON_SHEEN = {
  // No stop is allowed near white. The clock floats over the sky, which is
  // pale most of the day, and a thin white glyph on a pale blue ground is
  // gone — the pinks and blues keep enough saturation to stay readable at
  // noon without losing the season.
  [SEASONS.SPRING]: ['#ffb3d4', '#ff7fb4', '#ffd9e8', '#f26aa4', '#ff9fcc'],
  [SEASONS.SUMMER]: ['#67e8f9', '#c084fc', '#f472b6', '#4ade80', '#67e8f9'],
  [SEASONS.AUTUMN]: ['#f0bf55', '#e0932f', '#ffd98a', '#c9682a', '#e0932f'],
  [SEASONS.WINTER]: ['#bfe0ff', '#7fb5e8', '#dceeff', '#6fa8de', '#a8d0ff']
}

const FALLBACK_SHEEN = SEASON_SHEEN[SEASONS.SUMMER]

/**
 * The city's wall clock as an ordinary Date.
 *
 * Shifting the instant by the offset and then formatting in UTC gives the
 * city's local reading without needing an IANA zone name, which the weather
 * payload does not carry.
 *
 * @param {number} now - Epoch milliseconds.
 * @param {number} offsetSeconds - Seconds east of UTC.
 * @returns {Date}
 */
function cityDate(now, offsetSeconds) {
  return new Date(now + offsetSeconds * 1000)
}

const TIME_FORMAT = { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }
const DATE_FORMAT = { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }

function CityClock({ timezoneOffset = null, season = SEASONS.SUMMER, variant = 'panel' }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    // Once a second: a clock that only moves every minute looks stopped.
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const { time, date } = useMemo(() => {
    if (timezoneOffset === null || timezoneOffset === undefined) {
      return { time: '--:--', date: '' }
    }
    const local = cityDate(now, timezoneOffset)
    return {
      time: new Intl.DateTimeFormat(undefined, TIME_FORMAT).format(local),
      date: new Intl.DateTimeFormat(undefined, DATE_FORMAT).format(local)
    }
  }, [now, timezoneOffset])

  const sheen = SEASON_SHEEN[season] || FALLBACK_SHEEN
  const gradient = `linear-gradient(100deg, ${sheen.join(', ')})`

  return (
    <div
      className={`city-clock city-clock--${variant}`}
      data-testid={`city-clock-${variant}`}
      data-season={season}
    >
      <span className="city-clock__time" style={{ backgroundImage: gradient }}>
        {time}
      </span>
      {date && (
        <span className="city-clock__date" style={{ backgroundImage: gradient }}>
          {date}
        </span>
      )}
    </div>
  )
}

CityClock.propTypes = {
  /** Seconds east of UTC, straight from the weather payload. */
  timezoneOffset: PropTypes.number,
  season: PropTypes.string,
  /** 'overlay' floats above the globe; 'panel' sits in the side menu. */
  variant: PropTypes.oneOf(['overlay', 'panel'])
}

export default CityClock
