import WeatherApiClient from './WeatherApiClient'
import WeatherDataTransformer from './WeatherDataTransformer'

/**
 * WeatherApiService - High-level service for weather operations
 * Single Responsibility: Orchestrate API calls and data transformation
 * Open/Closed: Can be extended without modification
 */
class WeatherApiService {
  constructor(apiKey) {
    this.client = new WeatherApiClient(apiKey)
    this.transformer = new WeatherDataTransformer()
  }

  /**
   * Read: Get complete weather data for a city
   * Returns: { current, hourly, weekly }
   */
  async getWeatherByCity(cityName) {
    try {
      // Validate input
      if (!cityName || typeof cityName !== 'string' || cityName.trim() === '') {
        throw new Error('City name is required and must be a non-empty string')
      }

      // Get current weather
      const currentWeather = await this.client.getCurrentWeather(cityName.trim())

      // Validate response
      if (!this.transformer.validateWeatherData(currentWeather)) {
        throw new Error('Invalid weather data received from API')
      }

      const lat = currentWeather?.coord?.lat
      const lon = currentWeather?.coord?.lon
      const timezoneOffset = currentWeather?.timezone ?? 0

      let hourlyData = null
      let weeklyData = null

      // Get forecast if coordinates are available
      if (typeof lat === 'number' && typeof lon === 'number') {
        try {
          const forecastData = await this.client.getForecast(lat, lon)

          if (this.transformer.validateForecastData(forecastData)) {
            // Transform to hourly format
            hourlyData = this.transformer.transformToHourlyData(
              forecastData.list,
              timezoneOffset
            )
            if (hourlyData) {
              hourlyData.city = forecastData.city
            }

            // Transform to weekly format
            weeklyData = this.transformer.transformToWeeklyData(forecastData.list)
          }
        } catch (forecastError) {
          // Log but don't fail - forecast is optional
          console.warn('Failed to fetch forecast data:', forecastError)
        }
      }

      return {
        current: currentWeather,
        hourly: hourlyData,
        weekly: weeklyData
      }
    } catch (error) {
      // Re-throw with context
      throw new Error(`Failed to get weather for city "${cityName}": ${error.message}`)
    }
  }

  /**
   * Read: Get current weather only (lightweight)
   */
  async getCurrentWeatherOnly(cityName) {
    if (!cityName || typeof cityName !== 'string' || cityName.trim() === '') {
      throw new Error('City name is required and must be a non-empty string')
    }

    const currentWeather = await this.client.getCurrentWeather(cityName.trim())

    if (!this.transformer.validateWeatherData(currentWeather)) {
      throw new Error('Invalid weather data received from API')
    }

    return currentWeather
  }

  /**
   * Read: Get forecast only
   */
  async getForecastOnly(lat, lon) {
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      throw new Error('Latitude and longitude must be valid numbers')
    }

    const forecastData = await this.client.getForecast(lat, lon)

    if (!this.transformer.validateForecastData(forecastData)) {
      throw new Error('Invalid forecast data received from API')
    }

    return {
      hourly: this.transformer.transformToHourlyData(forecastData.list, 0),
      weekly: this.transformer.transformToWeeklyData(forecastData.list)
    }
  }
}

export default WeatherApiService

