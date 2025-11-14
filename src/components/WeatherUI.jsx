import React, { useState, useMemo, useRef, useEffect } from 'react'
import './WeatherUI.css'
import SunPositionDiagram from './SunPositionDiagram'
import MeteoconIcon from './MeteoconIcon'

// Legacy function for backward compatibility - now returns icon name for MeteoconIcon
function getWeatherIcon(weatherMain) {
  if (!weatherMain) return null
  return weatherMain
}

function TemperatureTrend({ data }) {
  const containerRef = useRef(null)

  if (!data?.points?.length) return null

  const { points, min, max, selectedIndex } = data
  // Calculate width based on number of points - give each point 60px of space
  const pointSpacing = 60
  const paddingLeft = 44
  const paddingRight = 20
  const paddingY = 30
  const paddingBottom = 80 // Reduced space under the chart
  const width = points.length * pointSpacing + paddingLeft + paddingRight
  const height = 240 // Increased height to accommodate all elements
  const innerWidth = width - paddingLeft - paddingRight
  const innerHeight = height - paddingY - paddingBottom
  const range = max - min === 0 ? 1 : max - min
  
  // Calculate max precipitation for scaling bars
  const maxPrecipitation = Math.max(...points.map(p => p.precipitation || 0), 0.1)
  // Max probability is 100% (1.0)
  const maxProbability = 1.0

  const plottedPoints = points.map((point, index) => {
    const ratio = points.length > 1 ? index / (points.length - 1) : 0.5
    const x = paddingLeft + ratio * innerWidth
    const normalized = (point.temp - min) / range
    const y = paddingY + (1 - normalized) * innerHeight
    
    // Calculate precipitation probability bar height (0-100% scale)
    // Bar height represents probability, not amount
    const probabilityBarHeight = (point.pop || 0) * 40 // Max 40px height for 100% probability
    const probabilityBarY = height - paddingBottom + 20 // Start position for bars (from bottom)
    
    // Format weather description text (capitalize and handle long words)
    const formatWeatherText = (text) => {
      if (!text) return ''
      // Capitalize first letter of each word
      return text.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ')
    }
    
    return { 
      ...point, 
      x, 
      y,
      precipitationBarHeight: probabilityBarHeight,
      precipitationBarY: probabilityBarY,
      formattedDescription: formatWeatherText(point.description || point.condition)
    }
  })

  const path = plottedPoints.reduce((acc, point, index) => {
    const segment = `${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    if (index === 0) return `M ${segment}`
    return `${acc} L ${segment}`
  }, '')

  // Generate grid lines
  // Horizontal grid lines (temperature levels)
  const horizontalGridLines = []
  const numHorizontalLines = 5 // Number of horizontal grid lines
  for (let i = 0; i <= numHorizontalLines; i++) {
    const ratio = i / numHorizontalLines
    const y = paddingY + (1 - ratio) * innerHeight
    horizontalGridLines.push({
      x1: paddingLeft,
      y1: y,
      x2: paddingLeft + innerWidth,
      y2: y
    })
  }

  // Vertical grid lines (time points)
  const verticalGridLines = []
  plottedPoints.forEach((point) => {
    verticalGridLines.push({
      x1: point.x,
      y1: paddingY,
      x2: point.x,
      y2: paddingY + innerHeight
    })
  })

  // Scroll to selected time when it changes
  useEffect(() => {
    if (selectedIndex !== undefined && selectedIndex >= 0 && containerRef.current) {
      const selectedPoint = plottedPoints[selectedIndex]
      if (selectedPoint) {
        // Calculate scroll position to center the selected point
        const scrollPosition = selectedPoint.x - containerRef.current.clientWidth / 2
        containerRef.current.scrollTo({
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
          {/* Grid lines - rendered first so they appear behind the data */}
          <g className="temperature-grid">
            {/* Horizontal grid lines */}
            {horizontalGridLines.map((line, index) => (
              <line
                key={`h-grid-${index}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                className="temperature-grid-line temperature-grid-line-horizontal"
              />
            ))}
            {/* Vertical grid lines */}
            {verticalGridLines.map((line, index) => (
              <line
                key={`v-grid-${index}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                className="temperature-grid-line temperature-grid-line-vertical"
              />
            ))}
          </g>
          {path && <path d={path} className="temperature-chart-line" />}
          
          {/* Temperature points and labels */}
          {plottedPoints.map((point, index) => (
            <g key={point.id ?? point.hourLabel}>
              <circle 
                cx={point.x} 
                cy={point.y} 
                r={point.isSelected ? "3.5" : "2.5"} 
                className={`temperature-chart-node ${point.isSelected ? 'temperature-chart-node-selected' : ''}`}
              />
              {point.icon && (
                <foreignObject
                  x={point.x - 12}
                  y={point.y - 34}
                  width="24"
                  height="24"
                  className="temperature-chart-icon-wrapper"
                >
                  <div xmlns="http://www.w3.org/1999/xhtml" className="temperature-chart-icon-content">
                    <MeteoconIcon
                      weatherMain={point.icon}
                      isNight={point.isNight}
                      size={20}
                      className="temperature-chart-icon"
                    />
                  </div>
                </foreignObject>
              )}
              <text
                x={point.x}
                y={point.y - 8}
                textAnchor="middle"
                fontSize="10"
                className="temperature-chart-temp"
              >
                {`${point.roundedTemp}°F`}
              </text>
            </g>
          ))}
          
          {/* Hour labels */}
          {plottedPoints.map((point) => (
            <text
              key={`hour-label-${point.id ?? point.hourLabel}`}
              x={point.x}
              y={height - paddingBottom + 24}
              textAnchor="middle"
              fontSize="10"
              className="temperature-hour-label"
            >
              {point.hourLabel}
            </text>
          ))}

          {/* Temperature scale labels on left */}
          {horizontalGridLines.map((line, index) => {
            const tempValue = min + (max - min) * (index / (horizontalGridLines.length - 1))
            return (
              <text
                key={`temp-label-${index}`}
                x={paddingLeft - 8}
                y={line.y1 + 4}
                textAnchor="end"
                fontSize="9"
                className="temperature-scale-label"
              >
                {Math.round(tempValue)}°F
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

function WeatherUI({
  weatherData,
  hourlyForecast,
  weeklyForecast,
  uvIndex,
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
  forceSnow = false,
  onRainToggle,
  forceRain = false,
  weatherService = null
}) {
  const [city, setCity] = useState(currentCity)
  const [viewMode, setViewMode] = useState('informational')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeoutRef = useRef(null)
  const suggestionsRef = useRef(null)
  const VIEW_MODES = [
    { id: 'minimal', label: 'Minimal' },
    { id: 'compact', label: 'Compact' },
    { id: 'informational', label: 'Informational' }
  ]

  const handleSubmit = (e) => {
    e.preventDefault()
    if (city.trim()) {
      setShowSuggestions(false)
      onSearch(city)
    }
  }

  const handleCityChange = (e) => {
    const value = e.target.value
    setCity(value)
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // If input is empty, clear suggestions
    if (!value.trim()) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    // Debounce autocomplete search
    searchTimeoutRef.current = setTimeout(async () => {
      if (weatherService && value.trim().length >= 2) {
        setIsSearching(true)
        try {
          const results = await weatherService.searchCities(value.trim(), 5)
          setSuggestions(results)
          setShowSuggestions(true)
        } catch (error) {
          console.warn('Autocomplete search failed:', error)
          setSuggestions([])
        } finally {
          setIsSearching(false)
        }
      } else {
        setSuggestions([])
        setShowSuggestions(false)
    }
    }, 300)
  }

  const handleSuggestionClick = (suggestion) => {
    const cityName = suggestion.name
    const state = suggestion.state
    const country = suggestion.country
    // Format: "City, State, Country" or "City, Country" if no state
    const fullName = state ? `${cityName}, ${state}, ${country}` : `${cityName}, ${country}`
    setCity(fullName)
    setShowSuggestions(false)
    onSearch(fullName)
  }

  const handleClear = () => {
    setCity('')
    setSuggestions([])
    setShowSuggestions(false)
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Update city when currentCity prop changes
  useEffect(() => {
    setCity(currentCity)
  }, [currentCity])

  const formattedTimeLabel = useMemo(() => {
    const formatTime = (hour) => {
      if (hour === null || hour === undefined || Number.isNaN(hour)) return '--'
      const date = new Date()
      date.setHours(Math.round(hour), 0, 0, 0)
      // Format in 12-hour format using user's device timezone
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })
    }
    if (timeOverride !== null && timeOverride !== undefined) {
      return formatTime(timeOverride)
    }
    if (displayHour !== null && displayHour !== undefined) {
      return `Auto (${formatTime(displayHour)})`
    }
    return 'Auto (--:--)'
  }, [timeOverride, displayHour])

  const formatLocalTime = (seconds) => {
    if (!seconds || !weatherData) return '--'
    // OpenWeatherMap returns UTC timestamps
    // Convert to user's device timezone and format in 12-hour format
    const utcDate = new Date(seconds * 1000)
    // Use user's device timezone and locale for formatting
    return utcDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
  }

  const formatLocation = () => {
    if (!weatherData) return '--'
    const cityName = weatherData.name || ''
    const countryCode = weatherData.sys?.country || ''
    // Try to get state from the full location string if available
    // OpenWeatherMap doesn't provide state directly, but we can format it nicely
    if (countryCode) {
      return `${cityName}, ${countryCode}`
    }
    return cityName
  }

  const temperatureF = weatherData?.main?.temp
  
  // Get temperature for selected time from hourly forecast
  const selectedTimeTemperature = useMemo(() => {
    if (!hourlyForecast?.entries || !Array.isArray(hourlyForecast.entries) || hourlyForecast.entries.length === 0) {
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
    let closestEntry = null
    let minDiff = Infinity
    hourlyForecast.entries.forEach((entry) => {
      const entryTimestamp = entry.dt + timezoneOffset
      const diff = Math.abs(entryTimestamp - selectedTimestamp)
      if (diff < minDiff) {
        minDiff = diff
        closestEntry = entry
      }
    })

    if (!closestEntry) return null

    // Get temperature from the closest entry
    const tempValue = typeof closestEntry.temp === 'number' 
      ? closestEntry.temp 
      : (typeof closestEntry.main?.temp === 'number' ? closestEntry.main.temp : null)
    
    return Number.isFinite(tempValue) ? tempValue : null
  }, [hourlyForecast, weatherData, timeOverride, displayHour])

  const temperatureLabel =
    selectedTimeTemperature !== null
      ? `${Math.round(selectedTimeTemperature)}°F`
      : (temperatureF !== undefined
          ? `${Math.round(temperatureF)}°F`
          : '--')
  const feelsLikeF = weatherData?.main?.feels_like
  const humidity = weatherData?.main?.humidity
  const windSpeed = weatherData?.wind?.speed
  const pressure = weatherData?.main?.pressure
  const cloudCoverage = weatherData?.clouds?.all
  const description = weatherData?.weather?.[0]?.description
  const iconMain = weatherData?.weather?.[0]?.main
  const sunrise = formatLocalTime(weatherData?.sys?.sunrise)
  const sunset = formatLocalTime(weatherData?.sys?.sunset)
  
  // Calculate pollen index (0-10 scale) based on weather conditions
  // Higher values indicate higher pollen levels
  const pollenIndex = useMemo(() => {
    if (!weatherData) return null
    
    let index = 5 // Base value
    
    // Wind speed: Moderate wind (5-15 mph) increases pollen, very high wind decreases it
    if (windSpeed !== undefined) {
      const windMph = windSpeed * 2.237 // Convert m/s to mph
      if (windMph >= 5 && windMph <= 15) {
        index += 2 // Moderate wind spreads pollen
      } else if (windMph > 15) {
        index -= 1 // High wind disperses pollen
      } else if (windMph < 2) {
        index -= 1 // Very low wind allows pollen to settle
      }
    }
    
    // Humidity: Low humidity (30-50%) increases pollen, high humidity decreases it
    if (humidity !== undefined) {
      if (humidity < 30) {
        index += 1.5 // Very dry air keeps pollen airborne
      } else if (humidity >= 30 && humidity <= 50) {
        index += 1 // Optimal for pollen
      } else if (humidity > 70) {
        index -= 2 // High humidity weighs down pollen
      }
    }
    
    // Temperature: Warm temperatures (60-80°F) increase pollen
    if (temperatureF !== undefined) {
      if (temperatureF >= 60 && temperatureF <= 80) {
        index += 1.5 // Optimal temperature for pollen release
      } else if (temperatureF < 40 || temperatureF > 90) {
        index -= 1 // Extreme temperatures reduce pollen
      }
    }
    
    // Rain/Precipitation: Reduces pollen significantly
    const weatherMain = weatherData?.weather?.[0]?.main
    if (weatherMain === 'Rain' || weatherMain === 'Drizzle' || weatherMain === 'Thunderstorm') {
      index -= 3 // Rain washes away pollen
    }
    
    // Clamp between 0 and 10
    return Math.max(0, Math.min(10, Math.round(index * 10) / 10))
  }, [weatherData, windSpeed, humidity, temperatureF])

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
      const timestamp = entry.dt * 1000
      const date = new Date(timestamp)
      // Format in 12-hour format using user's device timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const hourLabel = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: userTimezone
      })
      // Get hour in user's timezone for comparison
      const localDateString = date.toLocaleString('en-US', { timeZone: userTimezone })
      const entryHour = new Date(localDateString).getHours()
      // Forecast API uses main.temp, onecall uses temp directly
      const tempValue = typeof entry.temp === 'number' 
        ? entry.temp 
        : (typeof entry.main?.temp === 'number' ? entry.main.temp : NaN)
      // Check if this entry matches the selected hour (within 1.5 hours since entries are 3-hour intervals)
      const entryTimestamp = entry.dt + timezoneOffset
      const timeDiff = Math.abs(entryTimestamp - selectedTimestamp)
      const isSelected = timeDiff <= 5400 // 1.5 hours in seconds (closest match)
      
      // Determine if it's night for this entry
      const entryIsNight = entryHour >= 20 || entryHour < 6
      
      // Get precipitation data
      const rain = entry.rain?.['3h'] || entry.rain?.['1h'] || 0
      const snow = entry.snow?.['3h'] || entry.snow?.['1h'] || 0
      const precipitation = rain + snow
      const pop = entry.pop || 0 // Probability of precipitation (0-1)
      
      // Get wind speed
      const windSpeed = entry.wind?.speed || 0
      
      // Get cloud coverage
      const clouds = entry.clouds?.all || 0
      
      return {
        id: entry.dt,
        temp: tempValue,
        roundedTemp: Number.isFinite(tempValue) ? Math.round(tempValue) : '--',
        hourLabel,
        icon: entry.weather?.[0]?.main || null,
        isNight: entryIsNight,
        condition: entry.weather?.[0]?.main || '',
        description: entry.weather?.[0]?.description || '',
        hour: entryHour,
        isSelected,
        index: startIndex + index,
        precipitation: precipitation,
        pop: pop,
        windSpeed: windSpeed,
        clouds: clouds
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
      <div className="weather-header controls-top" style={{ zIndex: 1 }}>
       <div className="controls-hint">
          <p>🖱️ Left click + drag to rotate | Scroll to zoom | Right click + drag to pan</p>
        </div>
        <h1>3D Weather City</h1>
        <form onSubmit={handleSubmit} className="search-form">
          <div className="search-input-wrapper" ref={suggestionsRef}>
          <input
            type="text"
            value={city}
              onChange={handleCityChange}
              onFocus={() => {
                if (suggestions.length > 0) {
                  setShowSuggestions(true)
                }
              }}
            placeholder="Enter city name..."
            className="city-input"
          />
            {city && (
              <button
                type="button"
                onClick={handleClear}
                className="clear-button"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {suggestions.map((suggestion, index) => {
                  const displayName = suggestion.state
                    ? `${suggestion.name}, ${suggestion.state}, ${suggestion.country}`
                    : `${suggestion.name}, ${suggestion.country}`
                  return (
                    <button
                      key={index}
                      type="button"
                      className="suggestion-item"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      <span className="suggestion-name">{suggestion.name}</span>
                      <span className="suggestion-location">
                        {suggestion.state ? `${suggestion.state}, ` : ''}{suggestion.country}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <button type="submit" className="search-button" disabled={loading}>
            {loading ? '⏳' : 'Search'}
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
        <div className="test-toggles">
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
          {onRainToggle && (
            <button
              type="button"
              className={`rain-toggle${forceRain ? ' active' : ''}`}
              onClick={() => onRainToggle(!forceRain)}
              title="Toggle Rain Test Mode"
            >
              💧 {forceRain ? 'Rain ON' : 'Rain OFF'}
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
        </div>
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
                <span className="summary-icon">
                  <MeteoconIcon
                    weatherMain={iconMain}
                    isNight={celestialData?.isNight || false}
                    size={130}
                    className="summary-meteocon-icon"
                  />
                </span>
                <div className="summary-meta">
                  <h2>{formatLocation()}</h2>
                  <p className="summary-temp">
                    {temperatureLabel}
                  </p>
                  <p className="summary-desc">{description}</p>
                </div>
              </div>
              <div className="summary-stats">
                <div className="stat-item">
                  <span className="stat-label">Wind Speed</span>
                  <span className="stat-value">{windSpeed !== undefined ? `${windSpeed} m/s` : '--'}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Humidity</span>
                  <span className="stat-value">{humidity !== undefined ? `${humidity}%` : '--'}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Feels Like</span>
                  <span className="stat-value">{feelsLikeF !== undefined ? `${Math.round(feelsLikeF)}°F` : '--'}</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className={`weather-info weather-info--${viewMode}`}>
          <div className="weather-icon">
                  <MeteoconIcon
                    weatherMain={iconMain}
                    isNight={celestialData?.isNight || false}
                    size={viewMode === 'informational' ? 150 : (viewMode === 'minimal' || viewMode === 'compact' ? 150 : 60)}
                    className="weather-meteocon-icon"
                  />
          </div>
          <div className="weather-details">
                  <h2>{formatLocation()}</h2>
                  <p className="temperature">
                    {temperatureLabel}
                  </p>
                  <p className="condition">{description}</p>
                  <div className={`extra-info${viewMode === 'compact' ? ' extra-info--compact' : ''}`}>
                    <div className="stat-item">
                      <span className="stat-label">Wind Speed</span>
                      <span className="stat-value">{windSpeed !== undefined ? `${windSpeed} m/s` : '--'}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Humidity</span>
                      <span className="stat-value">{humidity !== undefined ? `${humidity}%` : '--'}</span>
                    </div>
                    {(viewMode === 'compact' || viewMode === 'informational') && feelsLikeF !== undefined && (
                      <div className="stat-item">
                        <span className="stat-label">Feels Like</span>
                        <span className="stat-value">{Math.round(feelsLikeF)}°F</span>
                      </div>
                    )}
                    {viewMode === 'compact' && pressure !== undefined && (
                      <div className="stat-item">
                        <span className="stat-label">Pressure</span>
                        <span className="stat-value">{pressure} hPa</span>
                      </div>
                    )}
                    {viewMode === 'compact' && cloudCoverage !== undefined && (
                      <div className="stat-item">
                        <span className="stat-label">Clouds</span>
                        <span className="stat-value">{cloudCoverage}%</span>
                      </div>
                    )}
                    {viewMode === 'informational' && (
                      <div className="stat-item">
                        <span className="stat-label">Visibility</span>
                        <span className="stat-value">
                          {weatherData?.visibility !== undefined
                            ? `${(weatherData.visibility / 1000).toFixed(1)} km`
                            : '--'}
                        </span>
                      </div>
                    )}
                    {viewMode === 'informational' && uvIndex !== null && uvIndex !== undefined && (
                      <div className="stat-item">
                        <span className="stat-label">UV Index</span>
                        <span className="stat-value">{Math.round(uvIndex)}</span>
                      </div>
                    )}
                    {viewMode === 'informational' && pollenIndex !== null && pollenIndex !== undefined && (
                      <div className="stat-item">
                        <span className="stat-label">Allergy Index</span>
                        <span className="stat-value">{pollenIndex.toFixed(1)}</span>
                      </div>
                    )}
                    {viewMode === 'compact' && pollenIndex !== null && pollenIndex !== undefined && (
                      <div className="stat-item">
                        <span className="stat-label">Allergy Index</span>
                        <span className="stat-value">{pollenIndex.toFixed(1)}</span>
                      </div>
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
                    <div className="stat-item">
                      <span className="stat-label">Sunrise</span>
                      <span className="stat-value">{sunrise}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Sunset</span>
                      <span className="stat-value">{sunset}</span>
            </div>
          </div>
        </div>
      )}

              {viewMode === 'informational' && hourlyTrend && (
                <div className="temperature-card">
                  <div className="temperature-card-header">
                    <h3>12-Hour Temperature</h3>
                    <span>
                      {`${Math.round(hourlyTrend.min)}°F / ${Math.round(hourlyTrend.max)}°F`}
                    </span>
                  </div>
                  <TemperatureTrend data={hourlyTrend} />
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
