import React, { useMemo } from 'react'
import PropTypes from 'prop-types'
import MeteoconIcon from './MeteoconIcon'

/**
 * Day-by-day outlook.
 *
 * OpenWeather's free forecast covers five days at three-hour resolution, which
 * WeatherService groups into daily buckets — so this usually has five or six
 * days to show rather than a full seven. It renders whatever it is given, up
 * to seven.
 */
const MAX_DAYS = 7

function dayLabel(timestamp, index) {
  if (index === 0) return 'Today'
  return new Date(timestamp * 1000).toLocaleDateString(undefined, { weekday: 'short' })
}

function WeeklyForecast({ days = [], isNight = false }) {
  const shown = useMemo(() => days.slice(0, MAX_DAYS), [days])

  // Every bar is drawn against the week's own span, so the spread between a
  // mild day and a cold one is readable at a glance.
  const span = useMemo(() => {
    if (shown.length === 0) return null
    const lows = shown.map((day) => day.temp.min)
    const highs = shown.map((day) => day.temp.max)
    const min = Math.min(...lows)
    const max = Math.max(...highs)
    return { min, max, range: Math.max(max - min, 1) }
  }, [shown])

  if (shown.length === 0 || !span) return null

  return (
    <div className="weekly-card">
      <div className="weekly-card-header">
        {/* The heading counts what is actually on screen: the free forecast
            usually yields five or six days, and a card that claims seven while
            showing six is worse than one that says six. */}
        <h3>{`${shown.length}-Day Forecast`}</h3>
        <span>{`${Math.round(span.min)}°F / ${Math.round(span.max)}°F`}</span>
      </div>

      <ul className="weekly-list">
        {shown.map((day, index) => {
          const low = Math.round(day.temp.min)
          const high = Math.round(day.temp.max)
          const offset = ((day.temp.min - span.min) / span.range) * 100
          const width = Math.max(((day.temp.max - day.temp.min) / span.range) * 100, 6)

          return (
            <li className="weekly-row" key={day.date}>
              <span className="weekly-day">{dayLabel(day.timestamp, index)}</span>
              <MeteoconIcon
                weatherMain={day.weather?.main}
                isNight={isNight}
                size={30}
                className="weekly-icon"
              />
              <span className="weekly-low">{`${low}°`}</span>
              <span className="weekly-bar">
                <span
                  className="weekly-bar-fill"
                  style={{ left: `${offset}%`, width: `${width}%` }}
                />
              </span>
              <span className="weekly-high">{`${high}°`}</span>
            </li>
          )
        })}
      </ul>
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
      }).isRequired,
      weather: PropTypes.shape({
        main: PropTypes.string,
        description: PropTypes.string
      })
    })
  ),
  isNight: PropTypes.bool
}

export default WeeklyForecast
