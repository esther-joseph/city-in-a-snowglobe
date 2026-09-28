import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { proxyOpenWeather, cacheHeaderFor } from './api/openweather.mjs'
import { cityWeather } from './api/weather.js'

/**
 * Serves /api/openweather locally so `vite dev` and `vite preview` behave like
 * the deployed Vercel function. The API key stays in this Node process; it is
 * never handed to the browser.
 */
function openWeatherProxy(apiKey) {
  const middleware = async (req, res) => {
    const { searchParams } = new URL(req.url, 'http://localhost')
    const { status, body } = await proxyOpenWeather(searchParams, apiKey)
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', cacheHeaderFor(status))
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.end(JSON.stringify(body))
  }

  // The city-shaped route, running the same core as api/weather.js so dev
  // accepts and rejects exactly what the deployed function does.
  const cityMiddleware = async (req, res) => {
    const { searchParams } = new URL(req.url, 'http://localhost')
    const { status, body } = await cityWeather(searchParams, apiKey)
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', cacheHeaderFor(status))
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.end(JSON.stringify(body))
  }

  const mount = (server) => {
    server.middlewares.use('/api/openweather', middleware)
    server.middlewares.use('/api/weather', cityMiddleware)
  }

  return {
    name: 'openweather-proxy',
    configureServer: mount,
    configurePreviewServer: mount
  }
}

/**
 * Serves the standalone HTML pages in public/ at their extensionless URLs.
 *
 * Vercel does this itself with "cleanUrls": true, but Vite's dev server hands
 * /seasons to the SPA fallback instead, so a link in the app would open the
 * globe in development and the page in production. Same trick as the weather
 * proxy above: make dev behave like the deployment rather than remember the
 * difference.
 */
function cleanUrlPages(pages) {
  const mount = (server) => {
    for (const [route, file] of Object.entries(pages)) {
      server.middlewares.use(route, (req, res, next) => {
        // Only the page itself; anything deeper is not ours.
        if (req.url !== '/' && req.url !== '') return next()
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(readFileSync(file, 'utf8'))
      })
    }
  }

  return {
    name: 'clean-url-pages',
    configureServer: mount,
    configurePreviewServer: mount
  }
}

export default defineConfig(({ mode }) => {
  // Read .env files for the dev proxy only. On Vercel the function reads the
  // key from process.env instead.
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = process.env.OPENWEATHER_API_KEY || env.OPENWEATHER_API_KEY

  // No AdSense loader is injected into the app page, on any build.
  //
  // It used to be, and that is half of why the site was turned down: the tag
  // was on a screen with no publisher content, where Auto ads promptly tried
  // to place a unit. The loader now lives in the written pages in public/,
  // which are the pages that have something on them, and the Android build
  // monetises through AdMob rather than either.

  return {
    plugins: [
      react(),
      openWeatherProxy(apiKey),
      cleanUrlPages({
        '/how-it-works': 'public/how-it-works.html',
        '/seasons': 'public/seasons.html',
        '/augmented-reality': 'public/augmented-reality.html',
        '/about': 'public/about.html',
        '/privacy': 'public/privacy.html'
      }),
    ],
    server: {
      port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
      open: true
    }
  }
})
