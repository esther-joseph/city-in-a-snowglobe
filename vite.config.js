import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { proxyOpenWeather, cacheHeaderFor } from './api/openweather.mjs'

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

  return {
    name: 'openweather-proxy',
    configureServer(server) {
      server.middlewares.use('/api/openweather', middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/openweather', middleware)
    }
  }
}

export default defineConfig(({ mode }) => {
  // Read .env files for the dev proxy only. On Vercel the function reads the
  // key from process.env instead.
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = process.env.OPENWEATHER_API_KEY || env.OPENWEATHER_API_KEY

  return {
    plugins: [react(), openWeatherProxy(apiKey)],
    server: {
      port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
      open: true
    }
  }
})
