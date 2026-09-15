/**
 * Canned OpenWeather responses served through the app's /api/openweather proxy.
 *
 * The suite stubs the network so runs are deterministic and don't spend API
 * quota: the UI assertions care about the shape of the data, not today's
 * weather in New York.
 */
const NOW = Math.floor(Date.parse('2026-03-15T15:00:00Z') / 1000)

export const CURRENT_WEATHER = {
  coord: { lon: -74.006, lat: 40.7143 },
  weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
  base: 'stations',
  main: {
    temp: 72.4,
    feels_like: 71.8,
    temp_min: 68.2,
    temp_max: 76.1,
    pressure: 1015,
    humidity: 46
  },
  visibility: 10000,
  wind: { speed: 8.05, deg: 210 },
  clouds: { all: 4 },
  dt: NOW,
  sys: { country: 'US', sunrise: NOW - 32400, sunset: NOW + 14400 },
  timezone: -14400,
  id: 5128581,
  name: 'New York',
  cod: 200
}

export const FORECAST = {
  cod: '200',
  cnt: 8,
  list: Array.from({ length: 8 }, (_, index) => ({
    dt: NOW + index * 10800,
    main: {
      temp: 70 + index,
      feels_like: 69 + index,
      temp_min: 68 + index,
      temp_max: 74 + index,
      pressure: 1014,
      humidity: 50
    },
    weather: [{ id: 801, main: 'Clouds', description: 'few clouds', icon: '02d' }],
    clouds: { all: 20 },
    wind: { speed: 7.2, deg: 200 },
    visibility: 10000,
    dt_txt: new Date((NOW + index * 10800) * 1000).toISOString()
  })),
  city: {
    id: 5128581,
    name: 'New York',
    coord: { lat: 40.7143, lon: -74.006 },
    country: 'US',
    timezone: -14400,
    sunrise: NOW - 32400,
    sunset: NOW + 14400
  }
}

export const UV_INDEX = { lat: 40.7143, lon: -74.006, date_iso: '2026-03-15T15:00:00Z', value: 5.2 }

export const GEOCODE = [
  { name: 'London', lat: 51.5073, lon: -0.1277, country: 'GB' },
  { name: 'London', lat: 42.9836, lon: -81.2497, country: 'CA', state: 'Ontario' },
  { name: 'Londonderry', lat: 55.0, lon: -7.3, country: 'GB' }
]

/**
 * Intercept the proxy so every spec sees the same weather.
 * @param {import('@playwright/test').Page} page
 */
export async function stubWeatherApi(page) {
  await page.route('**/api/openweather**', async (route) => {
    const path = new URL(route.request().url()).searchParams.get('path')
    const body =
      path === 'data/2.5/forecast'
        ? FORECAST
        : path === 'data/2.5/uvi'
          ? UV_INDEX
          : path === 'geo/1.0/direct'
            ? GEOCODE
            : { ...CURRENT_WEATHER }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    })
  })
}
