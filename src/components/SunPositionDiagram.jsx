import React, { useMemo } from 'react'
import './SunPositionDiagram.css'

function SunPositionDiagram({ weatherData, celestialData, timeOverride, displayHour }) {
  const sunData = useMemo(() => {
    if (!celestialData || !celestialData.sunPosition) {
      return null
    }

    const [sunX, sunY, sunZ] = celestialData.sunPosition
    const radius = 95 // Same as in computeCelestialData
    
    // Calculate azimuth (0-360 degrees, 0 = North, 90 = East, 180 = South, 270 = West)
    const azimuth = Math.atan2(sunX, sunZ) * (180 / Math.PI)
    const normalizedAzimuth = ((azimuth + 360) % 360)
    
    // Calculate elevation angle (0-90 degrees, 0 = horizon, 90 = zenith)
    const distance = Math.sqrt(sunX * sunX + sunZ * sunZ)
    const elevation = Math.atan2(sunY, distance) * (180 / Math.PI)
    
    // Determine sun phase
    let phase = 'Night'
    let phaseColor = '#4a5a7f'
    if (elevation > 0) {
      if (elevation < 10) phase = 'Sunrise/Sunset'
      else if (elevation < 30) phase = 'Morning/Evening'
      else if (elevation < 60) phase = 'Day'
      else phase = 'Noon'
      phaseColor = elevation > 30 ? '#ffd27d' : '#ffb347'
    }

    return {
      azimuth: normalizedAzimuth,
      elevation,
      phase,
      phaseColor,
      isVisible: elevation > -6 // Sun is visible if above -6 degrees (civil twilight)
    }
  }, [celestialData])

  const coordinates = useMemo(() => {
    if (!weatherData?.coord) return null
    return {
      lat: weatherData.coord.lat,
      lon: weatherData.coord.lon
    }
  }, [weatherData])

  const currentTime = useMemo(() => {
    const hour = timeOverride !== null && timeOverride !== undefined 
      ? timeOverride 
      : (displayHour !== null && displayHour !== undefined ? displayHour : new Date().getHours())
    const date = new Date()
    return {
      hour: Math.round(hour),
      date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    }
  }, [timeOverride, displayHour])

  if (!sunData || !coordinates) return null

  // Convert azimuth to SVG coordinates (0° = top/North, clockwise)
  const svgSize = 200
  const center = svgSize / 2
  const radius = 80
  const sunAngle = (sunData.azimuth - 90) * (Math.PI / 180) // Convert to radians, adjust for SVG (0° = right)
  const sunX = center + Math.cos(sunAngle) * radius * Math.max(0, Math.min(1, (sunData.elevation + 6) / 90))
  const sunY = center + Math.sin(sunAngle) * radius * Math.max(0, Math.min(1, (sunData.elevation + 6) / 90))

  return (
    <div className="sun-position-diagram">
      <div className="sun-diagram-header">
        <h3>Sun Position</h3>
        <div className="sun-phase-badge" style={{ backgroundColor: sunData.phaseColor }}>
          {sunData.phase}
        </div>
      </div>
      
      <div className="sun-diagram-container">
        <svg width={svgSize} height={svgSize} className="sun-compass">
          {/* Outer circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="2"
          />
          
          {/* Horizon line */}
          <line
            x1={center - radius}
            y1={center}
            x2={center + radius}
            y2={center}
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth="1"
            strokeDasharray="4,4"
          />
          
          {/* Compass directions */}
          <text x={center} y={20} textAnchor="middle" className="compass-label compass-north">N</text>
          <text x={center} y={svgSize - 10} textAnchor="middle" className="compass-label compass-south">S</text>
          <text x={20} y={center + 5} textAnchor="middle" className="compass-label compass-west">W</text>
          <text x={svgSize - 20} y={center + 5} textAnchor="middle" className="compass-label compass-east">E</text>
          
          {/* Cardinal direction lines */}
          <line x1={center} y1={10} x2={center} y2={30} stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" />
          <line x1={center} y1={svgSize - 10} x2={center} y2={svgSize - 30} stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" />
          <line x1={10} y1={center} x2={30} y2={center} stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" />
          <line x1={svgSize - 10} y1={center} x2={svgSize - 30} y2={center} stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" />
          
          {/* Sun position indicator */}
          {sunData.isVisible && (
            <>
              <circle
                cx={sunX}
                cy={sunY}
                r="8"
                fill={sunData.phaseColor}
                className="sun-indicator"
                filter="url(#sunGlow)"
              />
              <circle
                cx={sunX}
                cy={sunY}
                r="12"
                fill="none"
                stroke={sunData.phaseColor}
                strokeWidth="2"
                opacity="0.5"
                className="sun-aura"
              />
              {/* Line from center to sun */}
              <line
                x1={center}
                y1={center}
                x2={sunX}
                y2={sunY}
                stroke={sunData.phaseColor}
                strokeWidth="1.5"
                opacity="0.4"
                strokeDasharray="3,3"
              />
            </>
          )}
          
          {/* Gradient filter for sun glow */}
          <defs>
            <filter id="sunGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
        </svg>
      </div>

      <div className="sun-data-grid">
        <div className="sun-data-item">
          <span className="sun-data-label">Azimuth</span>
          <span className="sun-data-value">{Math.round(sunData.azimuth)}°</span>
        </div>
        <div className="sun-data-item">
          <span className="sun-data-label">Elevation</span>
          <span className="sun-data-value">{Math.round(sunData.elevation)}°</span>
        </div>
        <div className="sun-data-item">
          <span className="sun-data-label">Latitude</span>
          <span className="sun-data-value">{coordinates.lat.toFixed(4)}°</span>
        </div>
        <div className="sun-data-item">
          <span className="sun-data-label">Longitude</span>
          <span className="sun-data-value">{coordinates.lon.toFixed(4)}°</span>
        </div>
      </div>

      <div className="sun-time-info">
        <div className="sun-time-item">
          <span className="sun-time-label">Time</span>
          <span className="sun-time-value">{String(currentTime.hour).padStart(2, '0')}:00</span>
        </div>
        <div className="sun-time-item">
          <span className="sun-time-label">Date</span>
          <span className="sun-time-value">{currentTime.date}</span>
        </div>
      </div>
    </div>
  )
}

export default SunPositionDiagram

