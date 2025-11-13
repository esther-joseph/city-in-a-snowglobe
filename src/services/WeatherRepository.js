import WeatherApiService from './WeatherApiService'

/**
 * WeatherRepository - Repository pattern for weather data access
 * Single Responsibility: Manage data access and caching
 * Dependency Inversion: Depends on WeatherApiService abstraction
 */
class WeatherRepository {
  constructor(apiKey) {
    this.service = new WeatherApiService(apiKey)
    this.cache = new Map()
    this.cacheTimeout = 5 * 60 * 1000 // 5 minutes
  }

  /**
   * Get cached data if available and not expired
   * @private
   */
  getCached(key) {
    const cached = this.cache.get(key)
    if (!cached) return null

    const now = Date.now()
    if (now - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key)
      return null
    }

    return cached.data
  }

  /**
   * Store data in cache
   * @private
   */
  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  /**
   * Read: Get weather data with caching
   */
  async getWeatherByCity(cityName, useCache = true) {
    const cacheKey = `weather:${cityName.toLowerCase().trim()}`

    if (useCache) {
      const cached = this.getCached(cacheKey)
      if (cached) {
        return cached
      }
    }

    const data = await this.service.getWeatherByCity(cityName)
    
    if (useCache) {
      this.setCache(cacheKey, data)
    }

    return data
  }

  /**
   * Clear cache for a specific city
   */
  clearCache(cityName) {
    const cacheKey = `weather:${cityName.toLowerCase().trim()}`
    this.cache.delete(cacheKey)
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    this.cache.clear()
  }
}

export default WeatherRepository

