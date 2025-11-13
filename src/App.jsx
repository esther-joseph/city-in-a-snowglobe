import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, RenderTexture } from '@react-three/drei'
import { XR, Controllers } from '@react-three/xr'
import City from './components/City'
import WeatherEffects from './components/WeatherEffects'
import WeatherUI from './components/WeatherUI'
import ModeToggle from './components/ModeToggle'
import { SNOW_GLOBE_CONTENT_SCALE } from './components/SnowGlobe'
import Sun from './components/environment/Sun'
import Moon from './components/environment/Moon'
import StarField from './components/environment/StarField'
import AuraSky from './components/environment/AuraSky'
import WeatherRepository from './services/WeatherRepository'
import './App.css'

function hexToRgb(hex) {
  if (!hex) return { r: 255, g: 255, b: 255 }
  const normalized = hex.replace('#', '')
  const expanded = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized.padEnd(6, '0')
  const num = parseInt(expanded, 16)
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  }
}

function rgbToHex({ r, g, b }) {
  const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)))
  const composed = (clamp(r) << 16) | (clamp(g) << 8) | clamp(b)
  return `#${composed.toString(16).padStart(6, '0')}`
}

function mixColors(colorA, colorB, t) {
  const amount = Math.max(0, Math.min(1, t))
  const a = hexToRgb(colorA)
  const b = hexToRgb(colorB)
  return rgbToHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount
  })
}

const defaultCelestialSettings = {
  sunPosition: [55, 40, -28],
  moonPosition: [-42, 24, 42],
  isNight: false,
  backgroundColor: '#87CEEB',
  skySettings: {
    turbidity: 6,
    rayleigh: 2,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.8,
    exposure: 0.5
  },
  sunIntensity: 1.1,
  ambientIntensity: 0.55,
  moonlightIntensity: 0.1,
  showStars: false,
  starSettings: {
    radius: 250,
    depth: 60,
    count: 2500,
    factor: 4,
    saturation: 0,
    fade: true,
    speed: 0.6
  },
  sunColor: '#ffd27d',
  auraColor: '#ffb347',
  ambientSkyColor: '#9ec7ff',
  groundColor: '#3b4f3d',
  moonColor: '#f2f6ff',
  sunAuraIntensity: 0.65,
  moonAuraIntensity: 0.2,
  localHour: new Date().getHours()
}

function computeCelestialData(weatherData, currentTimestamp, manualHourOverride) {
  const result = { ...defaultCelestialSettings, localHour: defaultCelestialSettings.localHour }

  try {
    const overrideHour =
      manualHourOverride !== undefined && manualHourOverride !== null
        ? ((manualHourOverride % 24) + 24) % 24
        : null

    const timestampMs =
      overrideHour !== null
        ? Date.now()
        : Number.isFinite(currentTimestamp)
          ? currentTimestamp
          : Date.now()
    const utcSeconds = Math.floor(timestampMs / 1000)
    result.localHour = overrideHour !== null ? overrideHour : new Date().getHours()

    if (!weatherData) {
      const cycleProgress =
        overrideHour !== null ? overrideHour / 24 : (utcSeconds % 86400) / 86400
      const angle = cycleProgress * Math.PI * 2
      const radius = 95
      const sunY = Math.sin(angle) * radius * 0.45
      result.sunPosition = [
        Math.cos(angle) * radius,
        sunY,
        Math.sin(angle) * radius
      ]
      result.isNight = sunY < 0
      if (result.isNight) {
        result.backgroundColor = '#060b18'
        result.showStars = true
        result.starSettings = {
          ...result.starSettings,
          count: 3200,
          factor: 3.5
        }
        result.sunIntensity = 0.05
        result.ambientIntensity = 0.3
        result.moonPosition = [
          -result.sunPosition[0],
          Math.abs(result.sunPosition[1]) * 0.8 + 10,
          -result.sunPosition[2]
        ]
      }
      return result
    }

    const timezone = weatherData.timezone ?? 0
    const currentLocalSeconds = utcSeconds + timezone
    const sunriseRaw = weatherData.sys?.sunrise
    const sunsetRaw = weatherData.sys?.sunset
    const sunriseSeconds = typeof sunriseRaw === 'number' ? sunriseRaw + timezone : null
    const sunsetSeconds = typeof sunsetRaw === 'number' ? sunsetRaw + timezone : null

    const toLocalHours = (seconds) => {
      if (seconds === null) return null
      const normalized = ((seconds % 86400) + 86400) % 86400
      return normalized / 3600
    }

    let localHours = overrideHour !== null ? overrideHour : toLocalHours(currentLocalSeconds)
    if (localHours === null || Number.isNaN(localHours)) {
      localHours = overrideHour !== null
        ? overrideHour
        : (((currentLocalSeconds % 86400) + 86400) % 86400) / 3600
    }
    localHours = ((localHours % 24) + 24) % 24
    result.localHour = localHours

    const sunriseHours = toLocalHours(sunriseSeconds) ?? 6
    const sunsetHours = toLocalHours(sunsetSeconds) ?? 18

    const modularDifference = (end, start) => {
      const diff = (end - start + 24) % 24
      return diff <= 0 ? 24 : diff
    }

    const daySpan = modularDifference(sunsetHours, sunriseHours)
    const nightSpan = 24 - daySpan

    let isNight = false
    if (sunriseSeconds !== null && sunsetSeconds !== null) {
      if (sunriseHours < sunsetHours) {
        isNight = localHours < sunriseHours || localHours >= sunsetHours
      } else {
        isNight = !(localHours >= sunriseHours || localHours < sunsetHours)
      }
    } else {
      isNight = localHours < 6 || localHours >= 20
    }

    let daylightProgress = 0.5
    if (!isNight && sunriseSeconds !== null && sunsetSeconds !== null && daySpan > 0) {
      daylightProgress = (localHours - sunriseHours) / daySpan
    } else if (isNight && sunriseSeconds !== null && sunsetSeconds !== null && nightSpan > 0) {
      if (localHours >= sunsetHours) {
        daylightProgress = (localHours - sunsetHours) / nightSpan
      } else {
        daylightProgress = (localHours + (24 - sunsetHours)) / nightSpan
      }
    } else {
      daylightProgress = localHours / 24
    }
    daylightProgress = Math.min(Math.max(daylightProgress, 0), 1)

    const radius = 95
    const sunAngle = daylightProgress * Math.PI
    const azimuth = -Math.PI / 2 + daylightProgress * Math.PI
    let sunY = Math.sin(sunAngle) * radius * 0.6
    if (isNight) {
      sunY = Math.min(-10, sunY * -0.35)
    }
    const sunPosition = [
      Math.cos(azimuth) * radius,
      sunY,
      Math.sin(azimuth) * radius
    ]

    let nightProgress = daylightProgress
    if (sunriseSeconds !== null && sunsetSeconds !== null && nightSpan > 0) {
      if (localHours >= sunsetHours || localHours < sunriseHours) {
        if (localHours >= sunsetHours) {
          nightProgress = (localHours - sunsetHours) / nightSpan
        } else {
          nightProgress = (localHours + (24 - sunsetHours)) / nightSpan
        }
      } else {
        nightProgress = localHours / 24
      }
    } else {
      nightProgress = localHours / 24
    }
    nightProgress = ((nightProgress % 1) + 1) % 1

    const moonAzimuth = Math.PI / 2 + nightProgress * Math.PI
    const moonElevation = Math.sin(nightProgress * Math.PI) * radius * 0.45 + 12
    const moonPosition = [
      Math.cos(moonAzimuth) * radius * 0.75,
      moonElevation,
      Math.sin(moonAzimuth) * radius * 0.75
    ]

    const cloudCover = weatherData.clouds?.all ?? 35
    const overcastFactor = 1 - Math.min(Math.max(cloudCover / 100, 0), 1)
    const sunHeightRatio = Math.max(0, sunPosition[1] / (radius * 0.6))

    const backgroundColor = isNight
      ? cloudCover > 60
        ? '#0a101f'
        : '#050b18'
      : cloudCover > 65
        ? '#aeb9c6'
        : sunHeightRatio > 0.7
          ? '#6eb7ff'
          : '#89c2ff'

    const sunHeightNormalized = Math.max(0, Math.min(1, sunHeightRatio))

    const sunIntensity = isNight ? 0.04 : 0.75 + overcastFactor * 1.2
    const ambientIntensity = isNight ? 0.28 + overcastFactor * 0.2 : 0.4 + overcastFactor * 0.4
    const moonlightIntensity = isNight ? 0.1 + overcastFactor * 0.18 : 0

    const skySettings = {
      turbidity: isNight ? 2 : 5 + (1 - overcastFactor) * 4,
      rayleigh: isNight ? 0.2 : 2 + overcastFactor * 2,
      mieCoefficient: isNight ? 0.001 : 0.005 + (1 - overcastFactor) * 0.003,
      mieDirectionalG: isNight ? 0.7 : 0.8,
      exposure: isNight ? 0.22 : 0.45 + sunHeightRatio * 0.25
    }

    const showStars = isNight
    const starVisibility = Math.max(0.1, 1 - cloudCover / 100)
    const starSettings = {
      radius: 260,
      depth: 70,
      count: Math.round(1800 + starVisibility * 4000),
      factor: 2.5 + starVisibility * 3,
      saturation: 0,
      fade: true,
      speed: 0.5 + starVisibility * 0.5
    }

    const daySunRiseColor = '#ff944a'
    const daySunPeakColor = '#ffe6a3'
    const daySunsetColor = '#ff7a4e'
    const twilightSunColor = '#2f4468'
    const nightSunColor = '#1c2944'

    let sunColor
    if (isNight) {
      const twilightBlend = Math.max(0, Math.min(1, nightProgress))
      sunColor = mixColors(twilightSunColor, nightSunColor, twilightBlend)
    } else if (sunHeightNormalized < 0.5) {
      sunColor = mixColors(daySunRiseColor, daySunPeakColor, sunHeightNormalized * 2)
    } else {
      sunColor = mixColors(daySunPeakColor, daySunsetColor, (sunHeightNormalized - 0.5) * 2)
    }

    const dayAuraMorning = '#ffb46b'
    const dayAuraNoon = '#ffe4a6'
    const dayAuraEvening = '#ff946b'
    const nightAuraColor = '#4a5a7f'

    let auraColor
    if (isNight) {
      auraColor = mixColors(nightAuraColor, '#3a4a6a', starVisibility)
    } else if (sunHeightNormalized < 0.5) {
      auraColor = mixColors(dayAuraMorning, dayAuraNoon, sunHeightNormalized * 2)
    } else {
      auraColor = mixColors(dayAuraNoon, dayAuraEvening, (sunHeightNormalized - 0.5) * 2)
    }

    const ambientSkyDayLow = '#7fa7ff'
    const ambientSkyDayHigh = '#d1e6ff'
    const ambientSkyNight = '#151d33'
    const ambientSkyTwilight = '#263653'

    const ambientSkyColor = isNight
      ? mixColors(ambientSkyNight, ambientSkyTwilight, Math.min(1, starVisibility + 0.2))
      : mixColors(ambientSkyDayLow, ambientSkyDayHigh, sunHeightNormalized)

    const groundDayLow = '#324533'
    const groundDayHigh = '#6d8d59'
    const groundNight = '#1a2318'
    const groundTwilight = '#28321f'

    const groundColor = isNight
      ? mixColors(groundNight, groundTwilight, Math.max(0.2, starVisibility))
      : mixColors(groundDayLow, groundDayHigh, sunHeightNormalized)

    const sunAuraIntensity = isNight ? 0.08 : 0.45 + sunHeightNormalized * 0.7
    const moonAuraIntensity = isNight ? 0.25 + starVisibility * 0.35 : 0.05
    const moonColor = mixColors('#d7e0ff', '#f5f8ff', starVisibility)

    return {
      sunPosition,
      moonPosition,
      isNight,
      backgroundColor,
      skySettings,
      sunIntensity,
      ambientIntensity,
      moonlightIntensity,
      showStars,
      starSettings,
      sunColor,
      auraColor,
      ambientSkyColor,
      groundColor,
      sunAuraIntensity,
      moonAuraIntensity,
      moonColor,
      localHour: localHours
    }
  } catch {
    return {
      ...result,
      localHour: result.localHour ?? (manualHourOverride ?? new Date().getHours())
    }
  }
}
const cityProfiles = {
  'new york': {
    gridSize: 10,
    spacing: 7,
    heightRange: [12, 28],
    widthRange: [2.5, 4.5],
    depthRange: [2.5, 5],
    highRiseProbability: 0.55,
    highRiseMultiplier: 2.8,
    midRiseProbability: 0.25,
    lowRiseProbability: 0.12,
    colorPalette: ['#8a9ab3', '#a4b7cc', '#6e7a8c', '#506072'],
    accentPalette: ['#d9e1f2', '#b8c4d7', '#93a4c0'],
    centralClearance: 3,
    shapeOptions: ['box', 'box', 'tapered', 'spire'],
    maxCityRadius: 48,
    bridges: [
      {
        key: 'bridge-brooklyn',
        start: [-32, 0.35, -12],
        end: [32, 0.35, -12],
        deckWidth: 2.4,
        deckThickness: 0.28,
        towerHeight: 3.6,
        towerSpacing: 16,
        archHeight: 2.4,
        color: '#d7c3a1',
        cableColor: '#f0dfc6'
      }
    ],
    landmarks: [
      {
        key: 'landmark-oneworld',
        basePosition: [10, 0, -6],
        height: 70,
        width: 4,
        depth: 4,
        color: '#d7dde6',
        accentColor: '#9fb7d1',
        shape: 'spire'
      },
      {
        key: 'landmark-empire',
        basePosition: [-8, 0, 9],
        height: 55,
        width: 3.5,
        depth: 3.5,
        color: '#bdc9d8',
        accentColor: '#a0afc4',
        shape: 'tapered'
      }
    ]
  },
  london: {
    gridSize: 9,
    spacing: 8,
    heightRange: [10, 20],
    widthRange: [3, 5],
    depthRange: [3, 5],
    highRiseProbability: 0.35,
    highRiseMultiplier: 2.2,
    midRiseProbability: 0.35,
    lowRiseProbability: 0.2,
    colorPalette: ['#a6b1ba', '#c3cbd3', '#7d8791', '#939ca8'],
    accentPalette: ['#e0e5ec', '#cfd8df'],
    centralClearance: 3,
    shapeOptions: ['box', 'tapered', 'cylinder', 'box'],
    maxCityRadius: 48,
    bridges: [
      {
        key: 'bridge-tower',
        start: [-30, 0.3, 10],
        end: [30, 0.3, 10],
        deckWidth: 2.2,
        deckThickness: 0.25,
        towerHeight: 3,
        towerSpacing: 14,
        archHeight: 2,
        color: '#bfcada',
        cableColor: '#9fb0c8'
      }
    ],
    landmarks: [
      {
        key: 'landmark-shard',
        basePosition: [11, 0, 8],
        height: 60,
        width: 3.2,
        depth: 3.2,
        color: '#d5e1ec',
        accentColor: '#b9c8d9',
        shape: 'spire'
      },
      {
        key: 'landmark-gherkin',
        basePosition: [-10, 0, -9],
        height: 38,
        width: 5,
        depth: 5,
        color: '#9fb4c5',
        accentColor: '#d0dae3',
        shape: 'ellipsoid'
      }
    ]
  },
  paris: {
    gridSize: 8,
    spacing: 9,
    heightRange: [6, 12],
    widthRange: [3.5, 5.5],
    depthRange: [3.5, 5.5],
    highRiseProbability: 0.08,
    highRiseMultiplier: 1.6,
    midRiseProbability: 0.35,
    lowRiseProbability: 0.4,
    colorPalette: ['#d6c4a3', '#c1a780', '#b19363', '#ceb48d'],
    accentPalette: ['#f2e6cf', '#e4d2ad'],
    centralClearance: 3,
    shapeOptions: ['box', 'box', 'tapered'],
    maxCityRadius: 46,
    bridges: [
      {
        key: 'bridge-seine',
        start: [-26, 0.25, -8],
        end: [26, 0.25, -8],
        deckWidth: 2,
        deckThickness: 0.22,
        archHeight: 1.6,
        towerHeight: 0,
        color: '#d6c8a8',
        cableColor: '#f0e2c6'
      }
    ],
    landmarks: [
      {
        key: 'landmark-eiffel',
        basePosition: [-11, 0, 7],
        height: 45,
        width: 3.5,
        depth: 3.5,
        color: '#b89c6d',
        accentColor: '#d8c29a',
        shape: 'tower'
      },
      {
        key: 'landmark-montparnasse',
        basePosition: [9, 0, -10],
        height: 40,
        width: 4,
        depth: 4,
        color: '#535b66',
        accentColor: '#7a8696',
        shape: 'box'
      }
    ]
  },
  tokyo: {
    gridSize: 10,
    spacing: 7,
    heightRange: [10, 22],
    widthRange: [2.5, 4],
    depthRange: [2.5, 4],
    highRiseProbability: 0.45,
    highRiseMultiplier: 2.4,
    midRiseProbability: 0.35,
    lowRiseProbability: 0.15,
    colorPalette: ['#a3b4c6', '#7d8fa3', '#cad5e0', '#5f6f84'],
    accentPalette: ['#f0f5fa', '#d5e0ee', '#c0cee2'],
    centralClearance: 3,
    shapeOptions: ['box', 'box', 'tapered', 'spire', 'cylinder'],
    maxCityRadius: 48,
    bridges: [
      {
        key: 'bridge-rainbow',
        start: [-28, 0.32, 18],
        end: [28, 0.32, 18],
        deckWidth: 2.1,
        deckThickness: 0.26,
        towerHeight: 3.2,
        towerSpacing: 18,
        archHeight: 2.2,
        color: '#c4d3e9',
        cableColor: '#f5f7ff'
      }
    ],
    landmarks: [
      {
        key: 'landmark-skytree',
        basePosition: [12, 0, -12],
        height: 68,
        width: 3,
        depth: 3,
        color: '#d4e4f3',
        accentColor: '#b0c5dd',
        shape: 'spire'
      },
      {
        key: 'landmark-tvtower',
        basePosition: [-9, 0, 10],
        height: 42,
        width: 3,
        depth: 3,
        color: '#aebfd4',
        accentColor: '#f3c0c0',
        shape: 'tower'
      }
    ]
  },
  dubai: {
    gridSize: 9,
    spacing: 8,
    heightRange: [14, 26],
    widthRange: [2.4, 4],
    depthRange: [2.4, 4],
    highRiseProbability: 0.65,
    highRiseMultiplier: 3.2,
    midRiseProbability: 0.2,
    lowRiseProbability: 0.08,
    colorPalette: ['#cdd9e5', '#a9b8c8', '#8fa4b4', '#d8e4ef'],
    accentPalette: ['#f5faff', '#e0ecf5', '#b7d4f2'],
    centralClearance: 3,
    shapeOptions: ['spire', 'tapered', 'box', 'spire', 'cylinder'],
    maxCityRadius: 49,
    bridges: [
      {
        key: 'bridge-dubai-creek',
        start: [-30, 0.35, 6],
        end: [30, 0.35, 6],
        deckWidth: 2.5,
        deckThickness: 0.3,
        towerHeight: 3.8,
        towerSpacing: 18,
        archHeight: 2.6,
        color: '#e0edf7',
        cableColor: '#c5d7ec'
      }
    ],
    landmarks: [
      {
        key: 'landmark-burj',
        basePosition: [0, 0, -14],
        height: 90,
        width: 3,
        depth: 3,
        color: '#dce7f3',
        accentColor: '#b5cce4',
        shape: 'megaSpire'
      },
      {
        key: 'landmark-marina',
        basePosition: [-12, 0, 11],
        height: 60,
        width: 3.5,
        depth: 3.5,
        color: '#c2d7ea',
        accentColor: '#9fbfe1',
        shape: 'tapered'
      }
    ]
  }
}

const defaultCityProfile = {
  gridSize: 8,
  spacing: 8,
  heightRange: [8, 18],
  widthRange: [2.8, 4.8],
  depthRange: [2.8, 4.8],
  highRiseProbability: 0.3,
  highRiseMultiplier: 2,
  midRiseProbability: 0.4,
  lowRiseProbability: 0.2,
  colorPalette: ['#8B8B8B', '#A9A9A9', '#778899', '#696969'],
  accentPalette: ['#d9d9d9', '#bfbfbf'],
  centralClearance: 2,
  shapeOptions: ['box', 'box', 'tapered', 'cylinder'],
  landmarks: [],
  bridges: [],
  maxCityRadius: 45
}

function normalizeCityName(name) {
  if (!name) return ''
  return name.toLowerCase().trim()
}

function resolveCityProfile(cityName) {
  const normalized = normalizeCityName(cityName)
  if (!normalized) return defaultCityProfile
  return cityProfiles[normalized] || defaultCityProfile
}

function App() {
  const [weatherData, setWeatherData] = useState(null)
  const [hourlyForecast, setHourlyForecast] = useState(null)
  const [weeklyForecast, setWeeklyForecast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [city, setCity] = useState('New York')
  const [timeTick, setTimeTick] = useState(Date.now())
  const [manualHour, setManualHour] = useState(null)
  const [forceThunder, setForceThunder] = useState(false)
  const [forceSnow, setForceSnow] = useState(false)
  const [renderMode, setRenderMode] = useState('3d')
  const contentScale = SNOW_GLOBE_CONTENT_SCALE

  // Initialize weather repository (Dependency Inversion Principle)
  const weatherRepository = useMemo(() => {
    const apiKey = import.meta.env.OPENWEATHER_API_KEY
    if (!apiKey) {
      return null
    }
    try {
      return new WeatherRepository(apiKey)
    } catch (error) {
      console.error('Failed to initialize weather repository:', error)
      return null
    }
  }, [])

  const projectToGlobe = (sourcePosition, desiredActualRadius) => {
    if (
      !sourcePosition ||
      !Array.isArray(sourcePosition) ||
      sourcePosition.some((value) => !Number.isFinite(value))
    ) {
      return [0, desiredActualRadius / contentScale, 0]
    }

    const vector = new THREE.Vector3(...sourcePosition)
    if (vector.lengthSq() === 0) {
      return [0, desiredActualRadius / contentScale, 0]
    }

    const targetLength = desiredActualRadius / contentScale
    vector.normalize().multiplyScalar(targetLength)
    return [vector.x, vector.y, vector.z]
  }

  /**
   * Fetch weather data using repository pattern (CRUD: Read operation)
   * Follows SOLID principles:
   * - Single Responsibility: Only handles state updates
   * - Dependency Inversion: Depends on WeatherRepository abstraction
   */
  const fetchWeather = async (cityName) => {
    if (!weatherRepository) {
      setError('OPENWEATHER_API_KEY environment variable is not set. Please configure it in Vercel.')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      setHourlyForecast(null)
      setWeeklyForecast(null)
      
      // Use repository to get weather data (Read operation)
      const weatherData = await weatherRepository.getWeatherByCity(cityName)
      
      setWeatherData(weatherData.current)
      setHourlyForecast(weatherData.hourly)
      setWeeklyForecast(weatherData.weekly)
      setLoading(false)
    } catch (err) {
      setHourlyForecast(null)
      setWeeklyForecast(null)
      setError(err.message)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (weatherRepository) {
      fetchWeather(city)
    } else {
      setError('OPENWEATHER_API_KEY environment variable is not set. Please configure it in Vercel.')
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weatherRepository])

  const handleSearch = (newCity) => {
    setCity(newCity)
    fetchWeather(newCity)
  }

  useEffect(() => {
    if (manualHour !== null) return undefined
    const interval = setInterval(() => setTimeTick(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [manualHour])

  useEffect(() => {
    if (renderMode !== 'ar') {
      stopSession().catch(() => {})
      return
    }

    if (typeof window === 'undefined' || !('xr' in navigator)) {
      console.warn('WebXR not available; reverting to 3D mode.')
      setRenderMode('3d')
      return
    }

    let cancelled = false

    navigator.xr
      .isSessionSupported('immersive-ar')
      .then((supported) => {
        if (!supported) {
          if (!cancelled) {
            console.warn('AR not supported on this device; reverting to 3D mode.')
            setRenderMode('3d')
          }
          return
        }

        const optionalFeatures = ['local-floor', 'hit-test']
        if (typeof document !== 'undefined') optionalFeatures.push('dom-overlay')
        const sessionInit =
          typeof document !== 'undefined'
            ? { optionalFeatures, domOverlay: { root: document.body } }
            : { optionalFeatures }

        startSession('immersive-ar', sessionInit).catch((error) => {
          console.warn('Failed to start AR session; reverting to 3D mode.', error)
          if (!cancelled) setRenderMode('3d')
        })
      })
      .catch((error) => {
        console.warn('Failed to query AR support; reverting to 3D mode.', error)
        if (!cancelled) setRenderMode('3d')
      })

    return () => {
      cancelled = true
      stopSession().catch(() => {})
    }
  }, [renderMode, setRenderMode])

  const cityProfile = useMemo(
    () => resolveCityProfile(weatherData?.name || city),
    [weatherData, city]
  )

  const celestialData = useMemo(
    () =>
      computeCelestialData(
        weatherData,
        manualHour !== null ? null : timeTick,
        manualHour !== null ? manualHour : undefined
      ),
    [weatherData, timeTick, manualHour]
  )

  const weatherCondition = weatherData?.weather?.[0]?.main?.toLowerCase?.() || ''
  const weatherLightFactor = useMemo(() => {
    if (!weatherData) return 1
    if (weatherCondition.includes('storm')) return 0.35
    if (weatherCondition.includes('rain')) return 0.45
    if (weatherCondition.includes('snow')) return 0.55
    if (weatherCondition.includes('cloud')) return 0.65
    if (weatherCondition.includes('mist') || weatherCondition.includes('fog')) return 0.5
    return 1
  }, [weatherCondition, weatherData])

  const directionalLightIntensity = celestialData.sunIntensity * weatherLightFactor
  const ambientLightIntensity =
    celestialData.ambientIntensity * (celestialData.isNight ? 1 : weatherLightFactor + 0.35)

  const auraGradient = useMemo(() => {
    const brighten = (base, mixWith, amount) => mixColors(base, mixWith, amount)
    return [
      brighten(celestialData.ambientSkyColor, '#ffffff', Math.random() * 0.35),
      brighten(
        celestialData.auraColor,
        celestialData.isNight ? '#452d6d' : '#ff7edb',
        Math.random() * 0.25
      ),
      brighten(
        celestialData.groundColor,
        celestialData.isNight ? '#050716' : '#1d2a5c',
        Math.random() * 0.3
      )
    ]
  }, [
    celestialData.ambientSkyColor,
    celestialData.auraColor,
    celestialData.groundColor,
    celestialData.isNight
  ])

  const auraRotation = useMemo(
    () => [Math.PI * 0.1, Math.random() * Math.PI * 2, 0],
    [celestialData.localHour, celestialData.isNight]
  )

  const globeExtras = useMemo(() => {
    const elements = []

  const sunOuterPosition = projectToGlobe(celestialData.sunPosition, 20)
  const moonOuterPosition = projectToGlobe(celestialData.moonPosition, 18)

    elements.push(
      <group key="celestial">
        {!celestialData.isNight && (
          <Sun
            position={sunOuterPosition}
            auraColor={celestialData.auraColor}
            sunColor={celestialData.sunColor}
            auraIntensity={celestialData.sunAuraIntensity}
            scale={Math.max(1.1, contentScale * 4)}
          />
        )}
        {celestialData.isNight && (
          <Moon
            position={moonOuterPosition}
            moonColor={celestialData.moonColor}
            auraColor={mixColors(celestialData.moonColor, '#6f7ab1', 0.4)}
            auraIntensity={celestialData.moonAuraIntensity}
            lightIntensity={celestialData.moonlightIntensity}
            scale={Math.max(1, contentScale * 3.5)}
          />
        )}
      </group>
    )

    if (weatherData) {
      elements.push(
        <group key="weather-effects">
          <WeatherEffects
            weatherData={weatherData}
            enableNightStars={celestialData.isNight}
            forceThunder={forceThunder}
            forceSnow={forceSnow}
          />
        </group>
      )
    }

    return elements
  }, [celestialData, weatherData])

  const displayHour = useMemo(() => {
    if (manualHour !== null) return manualHour
    const localHour = celestialData?.localHour
    if (localHour !== undefined && localHour !== null && !Number.isNaN(localHour)) {
      return Math.floor(((localHour % 24) + 24) % 24)
    }
    if (weatherData?.dt !== undefined && weatherData?.timezone !== undefined) {
      const adjustedSeconds = weatherData.dt + weatherData.timezone
      return Math.floor((((adjustedSeconds % 86400) + 86400) % 86400) / 3600)
    }
    return new Date().getHours()
  }, [manualHour, celestialData, weatherData])

  const displayCityName = weatherData?.name || city

  const BaseScene = ({ includeSky = true }) => (
    <>
      <ambientLight
        color={celestialData.ambientSkyColor}
        intensity={ambientLightIntensity}
      />
      <hemisphereLight
        skyColor={celestialData.ambientSkyColor}
        groundColor={celestialData.groundColor}
        intensity={0.35 + weatherLightFactor * 0.25}
      />
      <directionalLight
        position={celestialData.sunPosition}
        intensity={directionalLightIntensity}
        castShadow
        color={celestialData.isNight ? '#4d5b78' : '#ffffff'}
      />
      {includeSky &&
        (celestialData.isNight && celestialData.showStars ? (
          <StarField
            radius={celestialData.starSettings.radius}
            depth={celestialData.starSettings.depth}
            count={celestialData.starSettings.count}
            factor={celestialData.starSettings.factor}
            saturation={celestialData.starSettings.saturation}
            fade={celestialData.starSettings.fade}
            speed={celestialData.starSettings.speed}
          />
        ) : (
          <AuraSky radius={420} colors={auraGradient} rotation={auraRotation} />
        ))}
      <City
        profile={cityProfile}
        cityName={displayCityName}
        extraElements={globeExtras}
        isNight={celestialData.isNight}
        windDirection={weatherData?.wind?.deg || 0}
        windSpeed={weatherData?.wind?.speed || 0}
      />
    </>
  )

  const ARGlobeBillboard = ({ backgroundColor, renderScene }) => {
    const cameraRef = useRef(null)

    return (
      <group position={[0, 1.25, -2.15]} scale={[1.5, 1.5, 1.5]}>
        <mesh rotation={[-Math.PI / 8, 0, 0]}>
          <planeGeometry args={[3.8, 3]} />
          <meshBasicMaterial toneMapped={false}>
            <RenderTexture attach="map" width={1024} height={1024}>
              <color attach="background" args={[backgroundColor]} />
              <PerspectiveCamera
                ref={cameraRef}
                makeDefault
                position={[120, 86, 120]}
                fov={28}
                near={0.1}
                far={360}
              />
              {renderScene?.()}
            </RenderTexture>
          </meshBasicMaterial>
        </mesh>
      </group>
    )
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        background: renderMode === '3d' ? celestialData.backgroundColor : '#060810'
      }}
    >
      {/* Left Side: UI Components */}
      <div
        style={{
          width: 'min(400px, 34vw)',
          padding: '24px 20px',
          boxSizing: 'border-box',
          overflowY: 'auto',
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        <WeatherUI 
          weatherData={weatherData}
          hourlyForecast={hourlyForecast}
          weeklyForecast={weeklyForecast}
          celestialData={celestialData}
          loading={loading}
          error={error}
          onSearch={handleSearch}
          currentCity={city}
          onTimeAdjust={(value) => {
            if (value === null || Number.isNaN(value)) {
              setManualHour(null)
              setTimeTick(Date.now())
            } else {
              setManualHour(value)
            }
          }}
          timeOverride={manualHour}
          displayHour={displayHour}
          onThunderToggle={setForceThunder}
          forceThunder={forceThunder}
          onSnowToggle={setForceSnow}
          forceSnow={forceSnow}
        />
        <ModeToggle mode={renderMode} onChange={setRenderMode} />
      </div>

      {/* Right Side: 3D Scene */}
      <div style={{ flex: 1, position: 'relative' }}>
        {renderMode === '3d' ? (
          <Canvas camera={{ position: [120, 86, 120], fov: 28, near: 0.1, far: 360 }}>
            <Suspense fallback={null}>
              <color attach="background" args={[celestialData.backgroundColor]} />
              <BaseScene includeSky />
              <OrbitControls 
                enablePan
                enableZoom
                enableRotate
                minDistance={18}
                maxDistance={200}
                maxPolarAngle={Math.PI / 2}
                target={[0, 7, 0]}
              />
            </Suspense>
          </Canvas>
        ) : (
          <Canvas
            camera={{ position: [0, 1.4, 3.4], fov: 45 }}
            onCreated={({ gl }) => {
              gl.xr.enabled = true
            }}
            style={{ width: '100%', height: '100%' }}
          >
            <Suspense fallback={null}>
              <XR referenceSpace="local-floor">
                <Controllers />
                <ARGlobeBillboard
                  backgroundColor={celestialData.backgroundColor}
                  renderScene={() => <BaseScene includeSky />}
                />
              </XR>
            </Suspense>
          </Canvas>
        )}
      </div>
    </div>
  )
}

export default App

