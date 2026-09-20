import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
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
 * The sheen laid over the letters.
 *
 * Yellow through to a pale champagne and back — the ring's own gold rather
 * than a colour of its own. No stop sits near white: the clock floats over a
 * sky that is pale most of the day, and a thin white glyph on pale blue simply
 * is not there.
 */
const SHEEN = ['#ffe9a8', '#f0bf55', '#fff4cf', '#ffd97a', '#f5dea1']

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

function CityClock({ timezoneOffset = null, overrideHour = null, variant = 'overlay' }) {
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
    // While the Sun & Moon slider is held away from now, the clock reads the
    // hour the sky is showing rather than the hour it is. The minutes keep
    // running, so it still reads as a clock rather than a label.
    if (overrideHour !== null && overrideHour !== undefined) {
      local.setUTCHours(overrideHour)
    }
    return {
      time: new Intl.DateTimeFormat(undefined, TIME_FORMAT).format(local),
      date: new Intl.DateTimeFormat(undefined, DATE_FORMAT).format(local)
    }
  }, [now, timezoneOffset, overrideHour])

  const gradient = `linear-gradient(100deg, ${SHEEN.join(', ')})`

  return (
    <div
      className={`city-clock city-clock--${variant}`}
      data-testid={`city-clock-${variant}`}
      data-overridden={overrideHour !== null && overrideHour !== undefined ? 'true' : 'false'}
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
  /** The hour the Sun & Moon slider is holding, or null for the real one. */
  overrideHour: PropTypes.number,
  variant: PropTypes.oneOf(['overlay'])
}

export default CityClock
