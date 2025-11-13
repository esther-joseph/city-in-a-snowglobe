import React, { useState, useMemo, useRef, useEffect } from 'react'
import './WeatherUI.css'
import SunPositionDiagram from './SunPositionDiagram'

const WEATHER_ICON_MAP = {
  Clear: '☀️',
  Clouds: '☁️',
  Rain: '🌧️',
  Drizzle: '🌦️',
  Thunderstorm: '⛈️',
  Snow: '❄️',
  Mist: '🌫️',
  Fog: '🌫️',
  Haze: '🌫️'
}

function getWeatherIcon(weatherMain) {
  if (!weatherMain) return '🌤️'
  return WEATHER_ICON_MAP[weatherMain] || '🌤️'
}

function TemperatureTrend({ data }) {
  const containerRef = useRef(null)
  const hoursRef = useRef(null)

  if (!data?.points?.length) return null

  const { points, min, max, selectedIndex } = data
  // Calculate width based on number of points - give each point 60px of space
  const pointSpacing = 60
  const paddingX = 20
  const paddingY = 18
  const width = points.length * pointSpacing + paddingX * 2
  const height = 80
  const innerWidth = width - paddingX * 2
  const innerHeight = height - paddingY * 2
  const range = max - min === 0 ? 1 : max - min

  const plottedPoints = points.map((point, index) => {
    const ratio = points.length > 1 ? index / (points.length - 1) : 0.5
    const x = paddingX + ratio * innerWidth
    const normalized = (point.temp - min) / range
    const y = paddingY + (1 - normalized) * innerHeight
    return { ...point, x, y }
  })

  const path = plottedPoints.reduce((acc, point, index) => {
    const segment = `${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    if (index === 0) return `M ${segment}`
    return `${acc} L ${segment}`
  }, '')

  // Scroll to selected time when it changes
  useEffect(() => {
    if (selectedIndex !== undefined && selectedIndex >= 0 && containerRef.current && hoursRef.current) {
      const selectedPoint = plottedPoints[selectedIndex]
      if (selectedPoint) {
        // Calculate scroll position to center the selected point
        const scrollPosition = selectedPoint.x - containerRef.current.clientWidth / 2
        containerRef.current.scrollTo({
          left: Math.max(0, scrollPosition),
          behavior: 'smooth'
        })
        // Also scroll the hours container
        hoursRef.current.scrollTo({
          left: Math.max(0, scrollPosition),
          behavior: 'smooth'
        })
      }
    }
  }, [selectedIndex, plottedPoints])

  return (
    <div className="temperature-graph">
      <div ref={containerRef} className="temperature-chart-container">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="temperature-chart"
          preserveAspectRatio="xMinYMid meet"
        >
          {path && <path d={path} className="temperature-chart-line" />}
          {plottedPoints.map((point, index) => (
            <g key={point.id ?? point.hourLabel}>
              <circle 
                cx={point.x} 
                cy={point.y} 
                r={point.isSelected ? "2.2" : "1.6"} 
                className={`temperature-chart-node ${point.isSelected ? 'temperature-chart-node-selected' : ''}`}
              />
              <text
                x={point.x}
                y={point.y - 6}
                textAnchor="middle"
                fontSize="6"
                className="temperature-chart-icon"
              >
                {point.icon}
              </text>
              <text
                x={point.x}
                y={point.y + 8}
                textAnchor="middle"
                fontSize="6"
                className="temperature-chart-temp"
              >
                {`${point.roundedTemp}°`}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div ref={hoursRef} className="temperature-chart-hours">
        {plottedPoints.map((point) => (
          <span 
            key={`hour-${point.id ?? point.hourLabel}`}
            className={point.isSelected ? 'temperature-hour-selected' : ''}
          >
            {point.hourLabel}
          </span>
        ))}
      </div>
    </div>
  )
}

function WeatherUI({
  weatherData,
  hourlyForecast,
  weeklyForecast,
  celestialData,
  loading,
  error,
  onSearch,
  currentCity,
  onTimeAdjust,
  timeOverride,
  displayHour,
  onThunderToggle,
  forceThunder = false,
  onSnowToggle,
  forceSnow = false
}) {
  const [city, setCity] = useState(currentCity)
  const [viewMode, setViewMode] = useState('informational')
  const VIEW_MODES = [
    { id: 'minimal', label: 'Minimal' },
    { id: 'compact', label: 'Compact' },
    { id: 'informational', label: 'Informational' }
  ]

  const handleSubmit = (e) => {
    e.preventDefault()
    if (city.trim()) {
      onSearch(city)
    }
  }

  const formattedTimeLabel = useMemo(() => {
    const formatHour = (hour) => {
      if (hour === null || hour === undefined || Number.isNaN(hour)) return '--'
      return String(Math.round(hour)).padStart(2, '0')
    }
    if (timeOverride !== null && timeOverride !== undefined) {
      return `${formatHour(timeOverride)}:00`
    }
    if (displayHour !== null && displayHour !== undefined) {
      return `Auto (${formatHour(displayHour)}:00)`
    }
    return 'Auto (--:00)'
  }, [timeOverride, displayHour])

  const formatLocalTime = (seconds) => {
    if (!seconds || !weatherData) return '--'
    const timezone = weatherData.timezone ?? 0
    const date = new Date((seconds + timezone) * 1000)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const temperatureC = weatherData?.main?.temp
  const temperatureF =
    typeof temperatureC === 'number' ? (temperatureC * 9) / 5 + 32 : undefined
  const temperatureLabel =
    temperatureC !== undefined && temperatureF !== undefined
      ? `${Math.round(temperatureC)}°C / ${Math.round(temperatureF)}°F`
      : '--'
  const feelsLike = weatherData?.main?.feels_like
  const humidity = weatherData?.main?.humidity
  const windSpeed = weatherData?.wind?.speed
  const description = weatherData?.weather?.[0]?.description
  const iconMain = weatherData?.weather?.[0]?.main
  const sunrise = formatLocalTime(weatherData?.sys?.sunrise)
  const sunset = formatLocalTime(weatherData?.sys?.sunset)

  const hourlyTrend = useMemo(() => {
    const entries = hourlyForecast?.entries
    if (!Array.isArray(entries) || entries.length === 0) {
      return null
    }

    const timezoneOffset =
      typeof hourlyForecast?.timezoneOffset === 'number'
        ? hourlyForecast.timezoneOffset
        : weatherData?.timezone ?? 0

    // Get the selected hour (timeOverride or displayHour or current hour)
    const selectedHour = timeOverride !== null && timeOverride !== undefined
      ? timeOverride
      : (displayHour !== null && displayHour !== undefined ? displayHour : new Date().getHours())

    // Calculate the target timestamp for the selected hour
    const now = new Date()
    const selectedTime = new Date(now)
    selectedTime.setHours(selectedHour, 0, 0, 0)
    const selectedTimestamp = Math.floor(selectedTime.getTime() / 1000)

    // Find the entry closest to the selected time
    // Forecast entries are in 3-hour intervals, so we find the closest one
    let closestIndex = 0
    let minDiff = Infinity
    entries.forEach((entry, index) => {
      const entryTimestamp = entry.dt + timezoneOffset
      const diff = Math.abs(entryTimestamp - selectedTimestamp)
      if (diff < minDiff) {
        minDiff = diff
        closestIndex = index
      }
    })

    // Start from the closest entry, show 12 hours forward (4 entries = 12 hours at 3-hour intervals)
    // But we want to show 12 data points, so we need 12 entries
    const startIndex = Math.max(0, Math.min(closestIndex, entries.length - 12))
    const slice = entries.slice(startIndex, startIndex + 12)
    if (slice.length === 0) return null

    const points = slice.map((entry, index) => {
      const timestamp = (entry.dt + timezoneOffset) * 1000
      const date = new Date(timestamp)
      const hourLabel = date.toLocaleTimeString([], { hour: 'numeric' })
      const entryHour = date.getHours()
      // Forecast API uses main.temp, onecall uses temp directly
      const tempValue = typeof entry.temp === 'number' 
        ? entry.temp 
        : (typeof entry.main?.temp === 'number' ? entry.main.temp : NaN)
      // Check if this entry matches the selected hour (within 1.5 hours since entries are 3-hour intervals)
      const entryTimestamp = entry.dt + timezoneOffset
      const timeDiff = Math.abs(entryTimestamp - selectedTimestamp)
      const isSelected = timeDiff <= 5400 // 1.5 hours in seconds (closest match)
      
      return {
        id: entry.dt,
        temp: tempValue,
        roundedTemp: Number.isFinite(tempValue) ? Math.round(tempValue) : '--',
        hourLabel,
        icon: getWeatherIcon(entry.weather?.[0]?.main),
        condition: entry.weather?.[0]?.main || '',
        description: entry.weather?.[0]?.description || '',
        hour: entryHour,
        isSelected,
        index: startIndex + index
      }
    }).filter((point) => Number.isFinite(point.temp))

    if (points.length === 0) return null

    const temps = points.map((point) => point.temp)
    const min = Math.min(...temps)
    const max = Math.max(...temps)

    return { points, min, max, selectedIndex: points.findIndex(p => p.isSelected) }
  }, [hourlyForecast, weatherData, timeOverride, displayHour])

  return (
    <div className="weather-ui">
      <div className="weather-header controls-top">
        <div className="controls-hint">
          <p>🖱️ Left click + drag to rotate | Scroll to zoom | Right click + drag to pan</p>
        </div>
        <h1>3D Weather City</h1>
        <form onSubmit={handleSubmit} className="search-form">
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Enter city name..."
            className="city-input"
          />
          <button type="submit" className="search-button" disabled={loading}>
            {loading ? '⏳' : '🔍'}
          </button>
        </form>
        <div className="view-toggle">
          {VIEW_MODES.map((mode) => (
            <button
              type="button"
              key={mode.id}
              className={`view-toggle-button${viewMode === mode.id ? ' active' : ''}`}
              onClick={() => setViewMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
         {/* Thunder and Snow test toggles - commented out for production */}
         {/* <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {onThunderToggle && (
              <button
                type="button"
                className={`thunder-toggle${forceThunder ? ' active' : ''}`}
                onClick={() => onThunderToggle(!forceThunder)}
                title="Toggle Thunder Test Mode"
              >
                ⚡ {forceThunder ? 'Thunder ON' : 'Thunder OFF'}
              </button>
            )}
            {onSnowToggle && (
              <button
                type="button"
                className={`snow-toggle${forceSnow ? ' active' : ''}`}
                onClick={() => onSnowToggle(!forceSnow)}
                title="Toggle Snow Test Mode"
              >
                ❄️ {forceSnow ? 'Snow ON' : 'Snow OFF'}
              </button>
            )}
         </div> */}
      </div>

      {error && (
        <div className="error-message">
          <p>⚠️ {error}</p>
        </div>
      )}

      <div className="weather-stack">
        {weatherData && !loading ? (
          viewMode === 'minimal' ? (
            <div className="weather-summary">
              <div className="summary-main">
                <span className="summary-icon">{getWeatherIcon(iconMain)}</span>
                <div className="summary-meta">
                  <h2>{weatherData?.name}, {weatherData?.sys?.country}</h2>
                  <p className="summary-temp">
                    {temperatureLabel}
                  </p>
                  <p className="summary-desc">{description}</p>
                </div>
              </div>
              <div className="summary-stats">
                <span>💧 {humidity !== undefined ? `${humidity}%` : '--'}</span>
                <span>💨 {windSpeed !== undefined ? `${windSpeed} m/s` : '--'}</span>
                <span>🌅 {sunrise}</span>
                <span>🌇 {sunset}</span>
              </div>
            </div>
          ) : (
            <>
              <div className={`weather-info weather-info--${viewMode}`}>
          <div className="weather-icon">
                  {getWeatherIcon(iconMain)}
          </div>
          <div className="weather-details">
                  <h2>{weatherData?.name}, {weatherData?.sys?.country}</h2>
                  <p className="temperature">
                    {temperatureLabel}
                  </p>
                  <p className="condition">{description}</p>
                  <div className={`extra-info${viewMode === 'compact' ? ' extra-info--compact' : ''}`}>
                    <span>💨 {windSpeed !== undefined ? `${windSpeed} m/s` : '--'}</span>
                    <span>💧 {humidity !== undefined ? `${humidity}%` : '--'}</span>
                    {viewMode === 'informational' && (
                      <span>
                        👁️ {weatherData?.visibility !== undefined
                          ? `${(weatherData.visibility / 1000).toFixed(1)} km`
                          : '--'}
                      </span>
                    )}
                    {viewMode === 'informational' && feelsLike !== undefined && (
                      <span>🌡️ Feels {Math.round(feelsLike)}°C</span>
                    )}
                  </div>
                </div>
              </div>

              {viewMode === 'informational' && (
                <div className="time-card">
                  <div className="time-card-header">
                    <h3>Sun & Moon Timeline</h3>
                    <span>{formattedTimeLabel}</span>
                  </div>
                  <div className="time-slider-container">
                    <input
                      id="time-of-day-slider"
                      className="time-slider"
                      type="range"
                      min="0"
                      max="23"
                      step="1"
                      value={timeOverride ?? displayHour ?? 0}
                      onChange={(event) => {
                        const newValue = Number(event.target.value)
                        if (!Number.isNaN(newValue)) {
                          onTimeAdjust(newValue)
                        }
                      }}
                    />
                    <div className="time-slider-markers">
                      <span>Dawn</span>
                      <span>Noon</span>
                      <span>Dusk</span>
                      <span>Midnight</span>
                    </div>
                    <button
                      type="button"
                      className="time-reset-button"
                      onClick={() => onTimeAdjust(null)}
                    >
                      Reset to Current Time
                    </button>
                  </div>
                  <div className="time-details">
                    <span>🌅 Sunrise {sunrise}</span>
                    <span>🌇 Sunset {sunset}</span>
                  </div>
                </div>
              )}

              {viewMode === 'informational' && hourlyTrend && (
                <div className="temperature-card">
                  <div className="temperature-card-header">
                    <h3>12-Hour Temperature</h3>
                    <span>
                      {`${Math.round(hourlyTrend.min)}° / ${Math.round(hourlyTrend.max)}°`}
                    </span>
                  </div>
                  <TemperatureTrend data={hourlyTrend} />
                </div>
              )}

              {viewMode === 'compact' && (
                <div className="time-card time-card--compact">
                  <div className="time-basic">
                    <div>
                      <span>Sunrise</span>
                      <strong>{sunrise}</strong>
                    </div>
                    <div>
                      <span>Sunset</span>
                      <strong>{sunset}</strong>
                    </div>
                    <div>
                      <span>Feels</span>
                      <strong>{feelsLike !== undefined ? `${Math.round(feelsLike)}°C` : '--'}</strong>
            </div>
          </div>
        </div>
      )}
            </>
          )
        ) : (
          <div className="empty-panel">
            Search for a city to see local weather and celestial timeline.
          </div>
        )}
      </div>

      {weatherData && celestialData && viewMode === 'informational' && (
        <SunPositionDiagram
          weatherData={weatherData}
          celestialData={celestialData}
          timeOverride={timeOverride}
          displayHour={displayHour}
        />
      )}
    </div>
  )
}

export default WeatherUI
