import React, { useMemo } from 'react'
import PropTypes from 'prop-types'
import MeteoconIcon from './MeteoconIcon'
import ScrollStrip from './ScrollStrip'
import './ForecastCards.css'

/**
 * The next two days, hour by hour, as cards you scroll sideways.
 *
 * A caveat worth knowing before reading the numbers: OpenWeather's free
 * forecast is three-hourly, not hourly. Forty entries at three hours each is
 * five days, so covering 48 hours means sixteen cards rather than forty-eight.
 * Filling the gaps by interpolation would look like more data than was
 * actually forecast, so the cards show the hours the forecast actually has.
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

function HourlyForecast({ entries = [], timezoneOffset = 0, sunrise = null, sunset = null }) {
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

      <ScrollStrip testId="hourly-scroller">
        {hours.map((entry, index) => {
          const night = isNightAt(entry.dt)
          const temp = entry.main?.temp
          const newDay =
            index > 0 &&
            new Date((entry.dt + timezoneOffset) * 1000).getUTCDate() !==
              new Date((hours[index - 1].dt + timezoneOffset) * 1000).getUTCDate()

          return (
            <article
              className={`forecast-tile forecast-tile--hour${newDay ? ' forecast-tile--daybreak' : ''}`}
              key={entry.dt}
            >
              {newDay && (
                <span className="forecast-tile__daybreak">
                  {dayBreakLabel(entry.dt, timezoneOffset)}
                </span>
              )}

              <MeteoconIcon
                weatherMain={entry.weather?.[0]?.main}
                isNight={night}
                size={44}
                className="forecast-tile__icon"
              />

              <span className="forecast-tile__temp">
                {typeof temp === 'number' ? `${Math.round(temp)}°` : '--'}
              </span>

              <span className="forecast-tile__pop">
                <span className="forecast-tile__drop" aria-hidden="true" />
                {`${Math.round((entry.pop ?? 0) * 100)}%`}
              </span>

              <span className="forecast-tile__when">
                {hourLabel(entry.dt, timezoneOffset)}
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
  sunset: PropTypes.number
}

export default HourlyForecast
