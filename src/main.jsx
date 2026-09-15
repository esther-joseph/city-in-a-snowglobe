import React from 'react'
import ReactDOM from 'react-dom/client'
import { SpeedInsights } from '@vercel/speed-insights/react'
import App from './App'

/**
 * Speed Insights only makes sense for the Vercel deployment: it loads its
 * script from /_vercel/speed-insights and posts back to the same origin. The
 * Capacitor builds run from a local webview origin where that endpoint does
 * not exist, and dev builds would only add console noise, so it is mounted for
 * the deployed web app alone.
 */
const isNativeApp =
  typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.())
const collectSpeedInsights = import.meta.env.PROD && !isNativeApp

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    {collectSpeedInsights && <SpeedInsights />}
  </React.StrictMode>,
)
