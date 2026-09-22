import React, { useMemo } from 'react'
import PropTypes from 'prop-types'
import MeteoconIcon from './MeteoconIcon'
import ScrollStrip from './ScrollStrip'
import { DEFAULT_UNIT, formatTemp } from '../utils/temperature'
import './ForecastCards.css'

/**
 * The next two days, hour by hour, as rows you scroll down.
 *
 * A caveat worth knowing before reading the numbers: OpenWeather's free
 * forecast is three-hourly, not hourly. Forty entries at three hours each is
 * five days, so covering 48 hours means sixteen rows rather than forty-eight.
 * Filling the gaps by interpolation would look like more data than was
 * actually forecast, so the rows show the hours the forecast actually has.
 *
 * Laid out as rows in a column rather than cards in a row: there are sixteen
 * of them carrying four fields each, and read down a column the fields line
 * up with one another instead of being read one card at a time.
 */
const HOURS_COVERED = 48

function hourLabel(timestamp, timezoneOffset) {
  const local = new Date((timestamp + timezoneOffset) * 1000)
  return local.toLocaleTimeString(undefined, {
    hour: 'numeric',
    timeZone: 'UTC'
  })
}

function dayBreakLabel(timestamp, timezoneOffset) {
  const local = new Date((timestamp + timezoneOffset) * 1000)
  return local.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })
}

function HourlyForecast({
  entries = [],
  timezoneOffset = 0,
  sunrise = null,
  sunset = null,
  unit = DEFAULT_UNIT
}) {
  const hours = useMemo(() => {
    if (!entries.length) return []
    const first = entries[0].dt
    const until = first + HOURS_COVERED * 3600
    return entries.filter((entry) => entry.dt <= until)
  }, [entries])

  // Which side of sunrise and sunset each hour falls on, so the icons match
  // the sky rather than all showing a sun.
  const isNightAt = useMemo(() => {
    if (!sunrise || !sunset) return () => false
    return (timestamp) => {
      const secondsIntoDay = ((timestamp + timezoneOffset) % 86400 + 86400) % 86400
      const riseAt = ((sunrise + timezoneOffset) % 86400 + 86400) % 86400
      const setAt = ((sunset + timezoneOffset) % 86400 + 86400) % 86400
      return secondsIntoDay < riseAt || secondsIntoDay >= setAt
    }
  }, [sunrise, sunset, timezoneOffset])

  if (hours.length === 0) return null

  const span = Math.round((hours[hours.length - 1].dt - hours[0].dt) / 3600)

  return (
    <div className="forecast-card" data-testid="hourly-forecast">
      <div className="forecast-card-header">
        {/* Counts the hours actually covered rather than claiming 48 when the
            forecast ran out early. */}
        <h3>{`${span}-Hour Forecast`}</h3>
        <span>Every 3 hours</span>
      </div>

      <ScrollStrip axis="y" testId="hourly-scroller">
        {hours.map((entry, index) => {
          const night = isNightAt(entry.dt)
          const temp = entry.main?.temp
          const newDay =
            index > 0 &&
            new Date((entry.dt + timezoneOffset) * 1000).getUTCDate() !==
              new Date((hours[index - 1].dt + timezoneOffset) * 1000).getUTCDate()

          return (
            <article
              className={`forecast-row${newDay ? ' forecast-row--daybreak' : ''}`}
              key={entry.dt}
            >
              {/* The weekday shares the time cell rather than sitting above
                  the row. A label on its own line would push that one row
                  taller than the rest and break the column alignment down the
                  whole strip. */}
              <span className="forecast-row__when">
                {newDay && (
                  <>
                    <span className="forecast-row__weekday">
                      {dayBreakLabel(entry.dt, timezoneOffset)}
                    </span>
                    <span className="forecast-row__rule" aria-hidden="true" />
                  </>
                )}
                {hourLabel(entry.dt, timezoneOffset)}
              </span>

              <MeteoconIcon
                weatherMain={entry.weather?.[0]?.main}
                isNight={night}
                size={36}
                className="forecast-row__icon"
              />

              <span className="forecast-row__temp">{formatTemp(temp, unit)}</span>

              <span className="forecast-row__pop">
                <span className="forecast-tile__drop" aria-hidden="true" />
                {`${Math.round((entry.pop ?? 0) * 100)}%`}
              </span>
            </article>
          )
        })}
      </ScrollStrip>
    </div>
  )
}

HourlyForecast.propTypes = {
  /** Raw three-hourly entries straight from the forecast payload. */
  entries: PropTypes.arrayOf(
    PropTypes.shape({
      dt: PropTypes.number.isRequired,
      main: PropTypes.shape({ temp: PropTypes.number }),
      weather: PropTypes.array,
      pop: PropTypes.number
    })
  ),
  timezoneOffset: PropTypes.number,
  sunrise: PropTypes.number,
  sunset: PropTypes.number,
  /** Which scale to show in. The readings themselves are always Fahrenheit. */
  unit: PropTypes.string
}

export default HourlyForecast
