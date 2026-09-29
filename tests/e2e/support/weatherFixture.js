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

// Eighteen three-hour steps, so the 48-hour strip has a full set to show and
// the daily buckets have both daylight and night entries to split on.
export const FORECAST = {
  cod: '200',
  cnt: 18,
  list: Array.from({ length: 18 }, (_, index) => {
    const dt = NOW + index * 10800
    // The city is UTC-4, so work out whether this step falls in its daylight.
    const localHour = new Date((dt - 14400) * 1000).getUTCHours()
    const daytime = localHour >= 6 && localHour < 18
    return {
      dt,
      main: {
        temp: daytime ? 70 + (index % 5) : 58 + (index % 4),
        feels_like: 69 + (index % 5),
        temp_min: 68 + (index % 5),
        temp_max: 74 + (index % 5),
        pressure: 1014,
        humidity: 50
      },
      weather: [
        daytime
          ? { id: 801, main: 'Clouds', description: 'few clouds', icon: '02d' }
          : { id: 500, main: 'Rain', description: 'light rain', icon: '10n' }
      ],
      clouds: { all: 20 },
      wind: { speed: 7.2, deg: 200 },
      visibility: 10000,
      // Probability of precipitation, which the cards show as a percentage.
      pop: daytime ? 0.1 : 0.6,
      sys: { pod: daytime ? 'd' : 'n' },
      dt_txt: new Date(dt * 1000).toISOString()
    }
  }),
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
/**
 * One Call 3.0's hourly block, forty-eight entries of it.
 *
 * Shaped as the upstream sends it — temperature at the top of each entry
 * rather than under `main` — so that the mapping in WeatherService.getHourly
 * is exercised rather than bypassed.
 *
 * @param {number} [hours]
 */
export function oneCallHourly(hours = 48) {
  return {
    lat: 40.7143,
    lon: -74.006,
    timezone: 'America/New_York',
    timezone_offset: -14400,
    hourly: Array.from({ length: hours }, (unused, index) => ({
      dt: NOW + index * 3600,
      temp: 72.4 - index * 0.4,
      feels_like: 71.8 - index * 0.4,
      pressure: 1015,
      humidity: 46 + index,
      clouds: index * 2,
      visibility: 10000,
      wind_speed: 8.05,
      wind_deg: 210,
      weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
      pop: index / 100
    }))
  }
}

/**
 * Intercept the proxy so every spec sees the same weather.
 *
 * One Call 3.0 is refused by default, because that is what a key without the
 * subscription gets and it is the path most runs should be exercising: the
 * fall back to the three-hourly forecast. A spec that wants the hourly strip
 * asks for it with stubHourlyForecast below.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function stubWeatherApi(page) {
  await page.route('**/api/openweather**', async (route) => {
    const path = new URL(route.request().url()).searchParams.get('path')

    if (path === 'data/3.0/onecall') {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ cod: 401, message: 'One Call 3.0 not subscribed' })
      })
      return
    }

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

/**
 * Answer One Call 3.0 as a subscribed key would, for the specs that care.
 *
 * Registered after stubWeatherApi, so it takes precedence for that one path
 * and everything else still comes from the canned responses above.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ hours?: number }} [options]
 */
export async function stubHourlyForecast(page, { hours = 48 } = {}) {
  // Matched by reading the query rather than by a glob: the path travels
  // percent-encoded (`path=data%2F3.0%2Fonecall`), and a pattern written the
  // readable way silently matches nothing.
  const isOneCall = (url) =>
    url.pathname.includes('/api/openweather') &&
    url.searchParams.get('path') === 'data/3.0/onecall'

  await page.route(isOneCall, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(oneCallHourly(hours))
    })
  })
}
