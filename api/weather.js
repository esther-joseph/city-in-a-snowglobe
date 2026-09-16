/**
 * City-shaped convenience wrapper around the OpenWeather proxy.
 *
 * /api/weather?city=New%20York is easier to call than the general form at
 * /api/openweather?path=data/2.5/weather&q=..., and it is the route a client
 * cache keys off. It is a thin adapter on purpose: the allow-list, the key
 * handling and the upstream call all stay in one place, in openweather.mjs,
 * so there is a single door to the API key rather than two.
 */

import { proxyOpenWeather, cacheHeaderFor } from './openweather.mjs'

// The app displays Fahrenheit throughout, so that is what this returns unless
// a caller asks otherwise.
const DEFAULT_UNITS = 'imperial'
const ALLOWED_UNITS = new Set(['standard', 'metric', 'imperial'])

/**
 * Transport-agnostic core, shared with the Vite dev middleware in
 * vite.config.js so that `vite dev` rejects exactly what the deployed
 * function rejects.
 *
 * @param {URLSearchParams} searchParams
 * @param {string|undefined} apiKey
 * @returns {Promise<{ status: number, body: unknown }>}
 */
export async function cityWeather(searchParams, apiKey) {
  const city = searchParams.get('city')
  const units = searchParams.get('units')

  if (!city || !city.trim()) {
    return { status: 400, body: { error: 'Missing required query parameter: city' } }
  }

  if (units && !ALLOWED_UNITS.has(units)) {
    return { status: 400, body: { error: `Unsupported units: ${units}` } }
  }

  const upstream = new URLSearchParams({
    path: 'data/2.5/weather',
    q: city.trim(),
    units: units || DEFAULT_UNITS
  })

  return proxyOpenWeather(upstream, apiKey)
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

  if (req.method !== 'GET') {
    res.setHeader('Content-Type', 'application/json')
    res.status(405).send(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  const { searchParams } = new URL(req.url, `https://${req.headers.host}`)
  const { status, body } = await cityWeather(searchParams, process.env.OPENWEATHER_API_KEY)

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', cacheHeaderFor(status))
  res.status(status).send(JSON.stringify(body))
}
