import React, { useMemo } from 'react'
import PropTypes from 'prop-types'
import MeteoconIcon from './MeteoconIcon'
import ScrollStrip from './ScrollStrip'
import './ForecastCards.css'

/**
 * Day by day outlook, as cards you scroll sideways.
 *
 * OpenWeather's free forecast covers five days at three hour resolution, which
 * WeatherService groups into daily buckets, so this usually has five or six
 * days rather than a full seven. It renders whatever it is given, up to seven.
 *
 * Each card carries the day and the night separately. A single number for a
 * whole day hides the thing people actually want to know, which is how cold it
 * gets after dark.
 */
const MAX_DAYS = 7

function dayLabel(timestamp, index, timezoneOffset) {
  const local = new Date((timestamp + timezoneOffset) * 1000)
  if (index === 0) return 'Today'
  return local.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })
}

function dateLabel(timestamp, timezoneOffset) {
  const local = new Date((timestamp + timezoneOffset) * 1000)
  return local.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  })
}

const formatTemp = (value) =>
  value === null || value === undefined || Number.isNaN(value) ? '--' : `${Math.round(value)}°`

function WeeklyForecast({ days = [], timezoneOffset = 0 }) {
  const shown = useMemo(() => days.slice(0, MAX_DAYS), [days])

  if (shown.length === 0) return null

  return (
    <div className="forecast-card" data-testid="weekly-forecast">
      <div className="forecast-card-header">
        {/* The heading counts what is on screen. The free forecast usually
            yields five or six days, and a card claiming seven while showing
            six is worse than one that says six. */}
        <h3>{`${shown.length}-Day Forecast`}</h3>
        <span>Day / Night</span>
      </div>

      <ScrollStrip testId="weekly-scroller">
        {shown.map((day, index) => (
          <article className="forecast-tile forecast-tile--day" key={day.date}>
            <span className="forecast-tile__when">
              {dayLabel(day.timestamp, index, timezoneOffset)}
            </span>
            <span className="forecast-tile__date">
              {dateLabel(day.timestamp, timezoneOffset)}
            </span>

            <span className="forecast-split">
              <MeteoconIcon
                weatherMain={day.day?.weather?.main || day.weather?.main}
                isNight={false}
                size={40}
                className="forecast-split__icon"
              />
              <span className="forecast-split__rule" aria-hidden="true" />
              <MeteoconIcon
                weatherMain={day.night?.weather?.main || day.weather?.main}
                isNight
                size={40}
                className="forecast-split__icon"
              />
            </span>

            <span className="forecast-tile__pop">
              <span className="forecast-tile__drop" aria-hidden="true" />
              {`${day.precipitation ?? 0}%`}
            </span>

            <span className="forecast-split forecast-split--temps">
              {/* Late in the evening a day has no daylight entries left, so
                  the day slot falls back to the high of what the forecast
                  still covers rather than showing a dash. */}
              <span className="forecast-split__temp">
                {formatTemp(day.day?.temp ?? day.temp?.max)}
              </span>
              <span className="forecast-split__rule" aria-hidden="true" />
              <span className="forecast-split__temp forecast-split__temp--night">
                {formatTemp(day.night?.temp ?? day.temp?.min)}
              </span>
            </span>
          </article>
        ))}
      </ScrollStrip>
    </div>
  )
}

WeeklyForecast.propTypes = {
  days: PropTypes.arrayOf(
    PropTypes.shape({
      date: PropTypes.string.isRequired,
      timestamp: PropTypes.number.isRequired,
      temp: PropTypes.shape({
        min: PropTypes.number,
        max: PropTypes.number,
        avg: PropTypes.number
      }),
      day: PropTypes.shape({ temp: PropTypes.number, weather: PropTypes.object }),
      night: PropTypes.shape({ temp: PropTypes.number, weather: PropTypes.object }),
      precipitation: PropTypes.number,
      weather: PropTypes.shape({
        main: PropTypes.string,
        description: PropTypes.string
      })
    })
  ),
  /** Seconds east of UTC, so the days are the city's rather than the reader's. */
  timezoneOffset: PropTypes.number
}

export default WeeklyForecast
