/**
 * WeatherDataTransformer - Transforms raw API data into application models
 * Single Responsibility: Data transformation and normalization
 */
class WeatherDataTransformer {
  /**
   * Transform forecast list into hourly data structure
   */
  transformToHourlyData(forecastList, timezoneOffset) {
    if (!Array.isArray(forecastList) || forecastList.length === 0) {
      return null
    }

    return {
      entries: forecastList,
      timezoneOffset: timezoneOffset || 0,
      city: null // Will be set by service if available
    }
  }

  /**
   * Transform forecast list into weekly data structure
   */
  transformToWeeklyData(forecastList) {
    if (!Array.isArray(forecastList) || forecastList.length === 0) {
      return null
    }

    const dailyData = {}

    forecastList.forEach((item) => {
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

    return Object.values(dailyData).map((day) => {
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
  }

  /**
   * Validate weather data structure
   */
  validateWeatherData(data) {
    if (!data || typeof data !== 'object') {
      return false
    }

    const requiredFields = ['coord', 'main', 'weather']
    return requiredFields.every((field) => data[field] !== undefined)
  }

  /**
   * Validate forecast data structure
   */
  validateForecastData(data) {
    if (!data || typeof data !== 'object') {
      return false
    }

    return Array.isArray(data.list) && data.list.length > 0
  }
}

export default WeatherDataTransformer

