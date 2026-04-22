import React from 'react'
import PropTypes from 'prop-types'

/**
 * MeteoconIcon — Meteocons line-style weather icons, served from /public (see postinstall).
 * Icon files come from @meteocons/svg-static (copied to public/weather-icons/line).
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
  const iconUrl = `/weather-icons/line/${iconName}.svg`
  const fallbackUrl = '/weather-icons/line/not-available.svg'

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
        if (e.target.dataset.fallbackApplied) return
        e.target.dataset.fallbackApplied = '1'
        e.target.src = fallbackUrl
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

