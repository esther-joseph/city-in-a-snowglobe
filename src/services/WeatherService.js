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
const SERVICE_UNAVAILABLE = 'Weather service is unavailable right now. Please try again later.'

class WeatherService {
  /**
   * @param {string} [baseUrl] - Origin that serves /api/openweather. Empty
   *   means "same origin", which is what the web build uses. The Android build
   *   passes the deployed site because its own origin is the local webview.
   */
  constructor(baseUrl = '') {
    this.endpoint = `${String(baseUrl).replace(/\/$/, '')}/api/openweather`
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

    const url = this.buildUrl('data/2.5/weather', { q: cityName, units: 'imperial' })
    
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

    const url = this.buildUrl('data/2.5/forecast', { lat, lon, units: 'imperial' })
    
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
      
      // Group by day for weekly forecast
      const dailyData = {}
      forecastJson.list.forEach((item) => {
        const date = new Date(item.dt * 1000)
        const dateKey = date.toDateString()
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = {
            date: dateKey,
            timestamp: item.dt,
            temps: [],
            weather: [],
            min: Infinity,
            max: -Infinity
          }
        }
        const temp = item.main?.temp
        if (typeof temp === 'number') {
          dailyData[dateKey].temps.push(temp)
          dailyData[dateKey].min = Math.min(dailyData[dateKey].min, temp)
          dailyData[dateKey].max = Math.max(dailyData[dateKey].max, temp)
        }
        if (item.weather?.[0]) {
          dailyData[dateKey].weather.push(item.weather[0])
        }
      })
      
      // Convert to array and get most common weather for each day
      const weeklyData = Object.values(dailyData).map((day) => {
        // Get most common weather condition
        const weatherCounts = {}
        day.weather.forEach((w) => {
          const main = w.main
          weatherCounts[main] = (weatherCounts[main] || 0) + 1
        })
        const mostCommonWeather = Object.keys(weatherCounts).reduce((a, b) =>
          weatherCounts[a] > weatherCounts[b] ? a : b
        )
        const weather = day.weather.find((w) => w.main === mostCommonWeather) || day.weather[0]
        
        return {
          date: day.date,
          timestamp: day.timestamp,
          temp: {
            min: Math.round(day.min),
            max: Math.round(day.max),
            avg: Math.round(day.temps.reduce((a, b) => a + b, 0) / day.temps.length)
          },
          weather: weather
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
   * Convenience method that combines getCurrentWeather and getForecast
   * @param {string} cityName - Name of the city
   * @returns {Promise<Object>} Complete weather data with current, hourly, and weekly forecast
   */
  async getCompleteWeatherData(cityName) {
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

    return {
      current: currentWeather,
      hourly: forecast.hourly,
      weekly: forecast.weekly,
      uvIndex: uvIndex
    }
  }
}

export default WeatherService

