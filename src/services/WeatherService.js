/**
 * WeatherService - Handles all weather API operations
 * Follows SOLID principles:
 * - Single Responsibility: Only handles weather data fetching
 * - Open/Closed: Extensible for different weather providers
 * - Liskov Substitution: Can be replaced with other implementations
 * - Interface Segregation: Focused interface for weather operations
 * - Dependency Inversion: App depends on this abstraction
 * 
 * Follows CRUD principles:
 * - Read: getCurrentWeather, getForecast
 */
import { CACHE_TTL, cacheKey, readFresh, readStale, writeEntry } from './weatherCache'

const SERVICE_UNAVAILABLE = 'Weather service is unavailable right now. Please try again later.'

const UNITS = 'imperial'

class WeatherService {
  /**
   * @param {string} [baseUrl] - Origin that serves /api/openweather. Empty
   *   means "same origin", which is what the web build uses. The Android build
   *   passes the deployed site because its own origin is the local webview.
   * @param {Object} [options]
   * @param {boolean} [options.cache=true] - Read and write the localStorage
   *   cache. Off in tests that need every call to reach the network.
   * @param {number} [options.cacheTtl] - How long a cached payload counts as
   *   fresh, in milliseconds.
   */
  constructor(baseUrl = '', { cache = true, cacheTtl = CACHE_TTL } = {}) {
    this.endpoint = `${String(baseUrl).replace(/\/$/, '')}/api/openweather`
    this.cacheEnabled = cache
    this.cacheTtl = cacheTtl
  }

  /**
   * Build a proxy URL. The API key lives on the server, so nothing secret is
   * ever part of these requests.
   * @param {string} path - Allow-listed upstream path, e.g. 'data/2.5/weather'
   * @param {Object} params - Query parameters to forward
   * @returns {string} Absolute request URL
   */
  buildUrl(path, params = {}) {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://localhost'
    const url = new URL(this.endpoint, origin)
    url.searchParams.set('path', path)
    Object.entries(params).forEach(([name, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(name, String(value))
      }
    })
    return url.toString()
  }

  /**
   * CRUD: Read - Get current weather data for a city
   * @param {string} cityName - Name of the city
   * @returns {Promise<Object>} Current weather data
   */
  async getCurrentWeather(cityName) {
    if (!cityName || typeof cityName !== 'string') {
      throw new Error('City name must be a non-empty string')
    }

    const url = this.buildUrl('data/2.5/weather', { q: cityName, units: UNITS })
    
    try {
      const response = await fetch(url)
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 500) {
          throw new Error(SERVICE_UNAVAILABLE)
        }
        if (response.status === 404) {
          throw new Error(`City "${cityName}" not found. Please check the spelling.`)
        }
        throw new Error(`Failed to fetch weather data: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      if (error.message === SERVICE_UNAVAILABLE || error.message.includes('not found')) {
        throw error
      }
      throw new Error(`Network error: ${error.message}`)
    }
  }

  /**
   * CRUD: Read - Get forecast data (5-day, 3-hour intervals)
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {number} timezoneOffset - Timezone offset in seconds
   * @returns {Promise<Object>} Forecast data with hourly and weekly breakdown
   */
  async getForecast(lat, lon, timezoneOffset = 0) {
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      throw new Error('Latitude and longitude must be numbers')
    }

    const url = this.buildUrl('data/2.5/forecast', { lat, lon, units: UNITS })
    
    try {
      const response = await fetch(url)
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 500) {
          throw new Error(SERVICE_UNAVAILABLE)
        }
        throw new Error(`Failed to fetch forecast data: ${response.statusText}`)
      }
      
      const forecastJson = await response.json()
      
      if (!Array.isArray(forecastJson?.list)) {
        return { hourly: null, weekly: null }
      }

      // Extract hourly data (3-hour intervals)
      const hourlyData = {
        entries: forecastJson.list,
        timezoneOffset: timezoneOffset,
        city: forecastJson.city
      }
      
      // Group by day for the weekly forecast.
      //
      // Grouped by the *city's* date, not the viewer's. Using the viewer's
      // local date put a forecast for Tokyo into whatever day it happened to
      // be in London, which shifted every bucket by a day for anyone far
      // enough east or west.
      const dailyData = {}
      forecastJson.list.forEach((item) => {
        const local = new Date((item.dt + timezoneOffset) * 1000)
        const dateKey = local.toISOString().slice(0, 10)
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = {
            date: dateKey,
            timestamp: item.dt,
            temps: [],
            weather: [],
            dayTemps: [],
            nightTemps: [],
            dayWeather: [],
            nightWeather: [],
            pop: 0,
            min: Infinity,
            max: -Infinity
          }
        }
        const bucket = dailyData[dateKey]
        const temp = item.main?.temp
        // `sys.pod` is OpenWeather's own day/night flag for the entry, which
        // is better than guessing from the hour: it already accounts for how
        // late the sun sets at that latitude and season.
        const isDaytime = item.sys?.pod !== 'n'

        if (typeof temp === 'number') {
          bucket.temps.push(temp)
          bucket.min = Math.min(bucket.min, temp)
          bucket.max = Math.max(bucket.max, temp)
          if (isDaytime) bucket.dayTemps.push(temp)
          else bucket.nightTemps.push(temp)
        }
        if (item.weather?.[0]) {
          bucket.weather.push(item.weather[0])
          if (isDaytime) bucket.dayWeather.push(item.weather[0])
          else bucket.nightWeather.push(item.weather[0])
        }
        // Probability of precipitation is per three-hour window. The day's
        // figure is the worst of them, which is what a reader means when they
        // ask whether it is going to rain tomorrow.
        if (typeof item.pop === 'number') bucket.pop = Math.max(bucket.pop, item.pop)
      })

      /** The condition that turns up most often in a set of entries. */
      const commonWeather = (entries) => {
        if (!entries.length) return null
        const counts = {}
        entries.forEach((entry) => {
          counts[entry.main] = (counts[entry.main] || 0) + 1
        })
        const winner = Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b))
        return entries.find((entry) => entry.main === winner) || entries[0]
      }

      const weeklyData = Object.values(dailyData).map((day) => {
        const weather = commonWeather(day.weather)
        // A day's temperature is its high and a night's is its low, which is
        // how every forecast anyone has read states it.
        const dayTemp = day.dayTemps.length ? Math.max(...day.dayTemps) : null
        const nightTemp = day.nightTemps.length ? Math.min(...day.nightTemps) : null

        return {
          date: day.date,
          timestamp: day.timestamp,
          temp: {
            min: Math.round(day.min),
            max: Math.round(day.max),
            avg: Math.round(day.temps.reduce((a, b) => a + b, 0) / day.temps.length)
          },
          day: {
            temp: dayTemp === null ? null : Math.round(dayTemp),
            weather: commonWeather(day.dayWeather)
          },
          night: {
            temp: nightTemp === null ? null : Math.round(nightTemp),
            weather: commonWeather(day.nightWeather)
          },
          precipitation: Math.round(day.pop * 100),
          weather
        }
      })

      return {
        hourly: hourlyData,
        weekly: weeklyData
      }
    } catch (error) {
      if (error.message === SERVICE_UNAVAILABLE) {
        throw error
      }
      // Return null for forecast if it fails, but don't break the app
      console.warn('Failed to fetch forecast data:', error)
      return { hourly: null, weekly: null }
    }
  }

  /**
   * CRUD: Read - Search for cities (autocomplete/geocoding)
   * @param {string} query - Search query (city name)
   * @param {number} limit - Maximum number of results (default: 5)
   * @returns {Promise<Array>} Array of city suggestions
   */
  async searchCities(query, limit = 5) {
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return []
    }

    const url = this.buildUrl('geo/1.0/direct', { q: query, limit })
    
    try {
      const response = await fetch(url)
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 500) {
          throw new Error(SERVICE_UNAVAILABLE)
        }
        return []
      }
      
      const data = await response.json()
      return Array.isArray(data) ? data : []
    } catch (error) {
      console.warn('Failed to search cities:', error)
      return []
    }
  }

  /**
   * CRUD: Read - Get UV index data
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {Promise<number|null>} UV index value or null if unavailable
   */
  async getUVIndex(lat, lon) {
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return null
    }

    const url = this.buildUrl('data/2.5/uvi', { lat, lon })
    
    try {
      const response = await fetch(url)
      
      if (!response.ok) {
        return null
      }
      
      const data = await response.json()
      return typeof data.value === 'number' ? data.value : null
    } catch (error) {
      console.warn('Failed to fetch UV index:', error)
      return null
    }
  }

  /**
   * CRUD: Read - Get complete weather data (current + forecast)
   *
   * This is the only method the app calls for a city, and it is three upstream
   * requests deep, so it is the one worth caching. A hit inside the TTL costs
   * nothing; a network failure falls back to an expired entry rather than an
   * error screen.
   *
   * @param {string} cityName - Name of the city
   * @param {Object} [options]
   * @param {boolean} [options.refresh=false] - Skip the cache on the way in.
   * @returns {Promise<Object>} Complete weather data with current, hourly, and weekly forecast
   */
  async getCompleteWeatherData(cityName, { refresh = false } = {}) {
    const key = cacheKey(cityName, UNITS)

    if (this.cacheEnabled && !refresh) {
      const cached = readFresh(key, this.cacheTtl)
      if (cached) return cached
    }

    try {
      return await this.fetchCompleteWeatherData(cityName, key)
    } catch (error) {
      // A misspelled city will never have a cache entry, and serving one under
      // a name the user did not ask for would be worse than the error.
      if (this.cacheEnabled && !/not found/i.test(error.message)) {
        const stale = readStale(key)
        if (stale) {
          console.warn('Weather request failed; serving cached data:', error.message)
          return { ...stale, stale: true }
        }
      }
      throw error
    }
  }

  /**
   * The uncached path: current conditions, then forecast and UV index, which
   * are both optional.
   * @param {string} cityName
   * @param {string} [key] - Cache key to write the result under.
   * @returns {Promise<Object>}
   */
  async fetchCompleteWeatherData(cityName, key = null) {
    const currentWeather = await this.getCurrentWeather(cityName)
    
    const lat = currentWeather?.coord?.lat
    const lon = currentWeather?.coord?.lon
    const timezone = currentWeather?.timezone ?? 0

    let forecast = { hourly: null, weekly: null }
    let uvIndex = null
    
    if (typeof lat === 'number' && typeof lon === 'number') {
      try {
        forecast = await this.getForecast(lat, lon, timezone)
      } catch (error) {
        // Forecast is optional, continue with current weather only
        console.warn('Forecast fetch failed, continuing with current weather only:', error)
      }
      
      try {
        uvIndex = await this.getUVIndex(lat, lon)
      } catch (error) {
        // UV index is optional
        console.warn('UV index fetch failed:', error)
      }
    }

    const payload = {
      current: currentWeather,
      hourly: forecast.hourly,
      weekly: forecast.weekly,
      uvIndex: uvIndex
    }

    if (this.cacheEnabled && key) writeEntry(key, payload)

    return payload
  }
}

export default WeatherService

