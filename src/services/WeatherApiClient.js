/**
 * WeatherApiClient - HTTP client for OpenWeatherMap API
 * Single Responsibility: Handle HTTP requests and responses
 */
class WeatherApiClient {
  constructor(apiKey, baseUrl = 'https://api.openweathermap.org/data/2.5') {
    if (!apiKey) {
      throw new Error('API key is required')
    }
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  /**
   * Generic HTTP request method
   * @private
   */
  async request(endpoint, params = {}) {
    const queryParams = new URLSearchParams({
      ...params,
      appid: this.apiKey,
      units: 'metric'
    })
    const url = `${this.baseUrl}${endpoint}?${queryParams.toString()}`

    const response = await fetch(url)
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}. ${errorText}`
      )
    }

    return response.json()
  }

  /**
   * Read: Get current weather by city name
   */
  async getCurrentWeather(cityName) {
    return this.request('/weather', { q: cityName })
  }

  /**
   * Read: Get current weather by coordinates
   */
  async getCurrentWeatherByCoords(lat, lon) {
    return this.request('/weather', { lat, lon })
  }

  /**
   * Read: Get forecast by coordinates
   */
  async getForecast(lat, lon) {
    return this.request('/forecast', { lat, lon })
  }
}

export default WeatherApiClient

