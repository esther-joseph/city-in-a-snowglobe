import React from 'react'
import PropTypes from 'prop-types'

/**
 * MeteoconIcon - Renders animated outlined Meteocons weather icons
 * Uses the Meteocons library from https://basmilius.github.io/weather-icons/
 * 
 * Maps OpenWeatherMap weather conditions to Meteocons icon names
 */
function MeteoconIcon({ weatherMain, isNight = false, className = '', size = 24, ...props }) {
  // Map OpenWeatherMap weather conditions to Meteocons icon names
  const getIconName = (main, night = false) => {
    const baseMap = {
      'Clear': night ? 'clear-night' : 'clear-day',
      'Clouds': night ? 'overcast-night' : 'overcast-day',
      'Rain': 'rain',
      'Drizzle': 'drizzle',
      'Thunderstorm': 'thunderstorms',
      'Snow': 'snow',
      'Mist': 'mist',
      'Fog': night ? 'fog-night' : 'fog-day',
      'Haze': night ? 'haze-night' : 'haze-day',
      'Smoke': 'smoke',
      'Dust': 'dust',
      'Sand': 'dust',
      'Ash': 'smoke',
      'Squall': 'wind',
      'Tornado': 'tornado'
    }

    return baseMap[main] || 'not-available'
  }

  if (!weatherMain) {
    return (
      <span 
        className={`meteocon-icon meteocon-fallback ${className}`}
        style={{ 
          width: size, 
          height: size, 
          display: 'inline-block',
          verticalAlign: 'middle',
          fontSize: size * 0.6
        }}
        {...props}
      >
        ⛅
      </span>
    )
  }

  const iconName = getIconName(weatherMain, isNight)

  // Use Meteocons CDN for the outlined animated icons (line style)
  // Try GitHub Pages first, then fallback to raw GitHub
  const iconUrl = `https://basmilius.github.io/weather-icons/production/line/all/${iconName}.svg`

  return (
    <img
      src={iconUrl}
      alt={iconName}
      className={`meteocon-icon ${className}`}
      style={{ 
        width: size, 
        height: size, 
        display: 'inline-block',
        verticalAlign: 'middle',
        objectFit: 'contain'
      }}
      onError={(e) => {
        // Fallback to raw GitHub if GitHub Pages fails
        e.target.src = `https://raw.githubusercontent.com/basmilius/weather-icons/master/production/line/all/${iconName}.svg`
      }}
      {...props}
    />
  )
}

MeteoconIcon.propTypes = {
  weatherMain: PropTypes.string,
  isNight: PropTypes.bool,
  className: PropTypes.string,
  size: PropTypes.number
}

export default MeteoconIcon

