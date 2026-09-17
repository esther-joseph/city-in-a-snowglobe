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
 * /privacy to the SPA fallback instead, so the link in the app would open the
 * globe in development and the policy in production. Same trick as the weather
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

/**
 * Puts the AdSense loader in the built page — but only for the web build.
 *
 * AdSense is a website product: serving it inside the Play Store build would
 * breach its programme policies, and the Android wrapper ships this same
 * index.html. Injecting at build time keeps the tag out of the app binary
 * while leaving it statically present in dist/index.html, which is what
 * AdSense's own site verification looks for.
 */
function adsenseTag({ client, enabled }) {
  return {
    name: 'adsense-tag',
    transformIndexHtml(html) {
      if (!enabled || !client) return html
      return html.replace(
        '</head>',
        `    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}"\n            crossorigin="anonymous"></script>\n</head>`
      )
    }
  }
}

export default defineConfig(({ mode }) => {
  // Read .env files for the dev proxy only. On Vercel the function reads the
  // key from process.env instead.
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = process.env.OPENWEATHER_API_KEY || env.OPENWEATHER_API_KEY

  // The Android build sets SNOWGLOBE_PLATFORM=native, which drops the AdSense
  // loader; that build monetises through AdMob instead.
  const platform = process.env.SNOWGLOBE_PLATFORM || env.SNOWGLOBE_PLATFORM || 'web'
  // Same publisher as public/ads.txt. Overridable so a fork can point the
  // build at its own account.
  const adClient =
    process.env.VITE_ADSENSE_CLIENT || env.VITE_ADSENSE_CLIENT || 'ca-pub-4752576373489354'

  return {
    plugins: [
      react(),
      openWeatherProxy(apiKey),
      cleanUrlPages({ '/privacy': 'public/privacy.html' }),
      adsenseTag({ client: adClient, enabled: platform !== 'native' })
    ],
    server: {
      port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
      open: true
    }
  }
})
