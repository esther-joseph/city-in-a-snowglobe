/**
 * Server-side proxy for the OpenWeather API.
 *
 * The browser (and the Capacitor webview on Android) calls this endpoint
 * instead of api.openweathermap.org, so OPENWEATHER_API_KEY only ever exists
 * on the server and is never shipped inside the JS bundle or the app binary.
 *
 * Requests look like: /api/openweather?path=data/2.5/weather&q=New%20York&units=imperial
 */

const UPSTREAM_ORIGIN = 'https://api.openweathermap.org'

// Only the endpoints the app actually uses; anything else is rejected so the
// proxy can't be turned into a general-purpose key-lending service.
const ALLOWED_PATHS = new Set([
  'data/2.5/weather',
  'data/2.5/forecast',
  'data/2.5/uvi',
  // One Call 3.0, for the hour-by-hour forecast. The free 2.5 forecast is
  // three-hourly; this is the endpoint that actually has every hour. It is a
  // separate subscription on the OpenWeather account, so a key without it is
  // refused here and the app falls back — see WeatherService.getHourly.
  'data/3.0/onecall',
  'geo/1.0/direct'
])

const FORWARDED_PARAMS = ['q', 'lat', 'lon', 'units', 'limit', 'exclude']

/**
 * Transport-agnostic core, shared by the Vercel function below and the Vite
 * dev middleware in vite.config.js.
 * @param {URLSearchParams} searchParams
 * @param {string|undefined} apiKey
 * @returns {Promise<{ status: number, body: unknown }>}
 */
export async function proxyOpenWeather(searchParams, apiKey) {
  const path = searchParams.get('path')

  if (!path || !ALLOWED_PATHS.has(path)) {
    return { status: 400, body: { error: `Unsupported weather path: ${path ?? '(missing)'}` } }
  }

  if (!apiKey) {
    return { status: 500, body: { error: 'Weather service is not configured.' } }
  }

  const upstream = new URL(`${UPSTREAM_ORIGIN}/${path}`)
  for (const name of FORWARDED_PARAMS) {
    const value = searchParams.get(name)
    if (value !== null) upstream.searchParams.set(name, value)
  }
  upstream.searchParams.set('appid', apiKey)

  try {
    const response = await fetch(upstream)
    return { status: response.status, body: await response.json() }
  } catch (error) {
    return { status: 502, body: { error: `Weather upstream request failed: ${error.message}` } }
  }
}

/**
 * How long the edge may answer for us.
 *
 * Ten minutes, which is roughly how often OpenWeather's own observations
 * change — a shorter window spends function invocations and upstream calls on
 * data that is the same data. The browser already keeps its own fifteen
 * minutes in localStorage (see weatherCache.js), so a reader who reloads is
 * not hitting this at all; what this covers is everybody else asking for the
 * same city, which for a handful of popular cities is most of the traffic.
 *
 * stale-while-revalidate keeps the window: for ten minutes past expiry the
 * edge serves the old answer and fetches the new one behind it, so nobody
 * waits on a cold upstream.
 *
 * Errors are never cached. A rate-limited minute would otherwise be served to
 * everyone for the next ten.
 */
export function cacheHeaderFor(status) {
  return status === 200 ? 'public, s-maxage=600, stale-while-revalidate=600' : 'no-store'
}

export default async function handler(req, res) {
  // The Android build runs on the https://localhost webview origin, so the
  // proxy has to allow cross-origin reads. No credentials are involved.
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.status(204).end()
    return
  }

  const { searchParams } = new URL(req.url, `https://${req.headers.host}`)
  const { status, body } = await proxyOpenWeather(searchParams, process.env.OPENWEATHER_API_KEY)

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', cacheHeaderFor(status))
  res.status(status).send(JSON.stringify(body))
}
