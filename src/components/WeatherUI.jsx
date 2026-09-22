import React, { useState, useMemo, useRef, useEffect } from 'react'
import './WeatherUI.css'
import SunPositionDiagram from './SunPositionDiagram'
import WeeklyForecast from './WeeklyForecast'
import HourlyForecast from './HourlyForecast'
import AdSlot from './ads/AdSlot'
import MeteoconIcon from './MeteoconIcon'

// Legacy function for backward compatibility - now returns icon name for MeteoconIcon
function getWeatherIcon(weatherMain) {
  if (!weatherMain) return null
  return weatherMain
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
  weatherService = null,
  renderMode = '3d'
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


  return (
    <div className="weather-ui">
      <div className="weather-header controls-top" style={{ zIndex: 1 }}>
       <div className="controls-hint">
          <p>🖱️ Left click + drag to rotate | Scroll to zoom | Right click + drag to pan</p>
        </div>
        <h1>City In A Snowglobe</h1>
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
        {/* <div className="test-toggles">
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

              {viewMode === 'informational' && hourlyForecast?.entries?.length > 0 && (
                <HourlyForecast
                  entries={hourlyForecast.entries}
                  timezoneOffset={hourlyForecast.timezoneOffset ?? weatherData?.timezone ?? 0}
                  sunrise={weatherData?.sys?.sunrise ?? null}
                  sunset={weatherData?.sys?.sunset ?? null}
                />
              )}

              {(viewMode === 'informational' || viewMode === 'compact') && weeklyForecast?.length > 0 && (
                <WeeklyForecast
                  days={weeklyForecast}
                  timezoneOffset={weatherData?.timezone ?? 0}
                />
              )}
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

              {/* Under the numbers and the timeline, where the reader has
                  already stopped to read. Never over the globe. */}
              <AdSlot name="drawer-banner" renderMode={renderMode} />

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
