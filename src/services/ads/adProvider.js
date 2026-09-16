/**
 * Which ad network is answering, and whether ads should run at all.
 *
 * Kept out of the components so the decision is made once and can be tested
 * on its own.
 */

import { AD_CLIENT } from './adConfig'

const SCRIPT_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'
const OPT_OUT_KEY = 'snowglobe:ads'

/**
 * @returns {'web'|'native'|'none'}
 */
export function adPlatform() {
  if (typeof window === 'undefined') return 'none'
  // Capacitor sets this on the webview. The Play build must never load
  // AdSense; it goes through AdMob instead.
  if (window.Capacitor?.isNativePlatform?.()) return 'native'
  return 'web'
}

/**
 * Ads are off when the reader has opted out, when a test or a screenshot run
 * asks for a clean page, or while the camera is showing: an ad laid over a
 * live AR view invites the accidental clicks that get a publisher account
 * suspended, and it covers the thing the reader pointed the camera at.
 *
 * @param {Object} [context]
 * @param {string} [context.renderMode] - '3d' or 'ar'.
 * @returns {boolean}
 */
export function adsEnabled({ renderMode = '3d' } = {}) {
  if (typeof window === 'undefined') return false
  if (renderMode === 'ar') return false

  try {
    if (new URLSearchParams(window.location.search).get('ads') === 'off') return false
    if (window.localStorage?.getItem(OPT_OUT_KEY) === 'off') return false
  } catch {
    // A blocked storage or an exotic URL is not a reason to fail the render.
  }

  return true
}

/** Turn ads off (or back on) for this browser, for a consent banner to call. */
export function setAdsEnabled(enabled) {
  try {
    window.localStorage?.setItem(OPT_OUT_KEY, enabled ? 'on' : 'off')
  } catch {
    /* nothing we can do */
  }
}

/**
 * Make sure the AdSense loader is present.
 *
 * The production page gets the tag injected at build time (see the adsenseTag
 * plugin in vite.config.js), which is what AdSense's site verification reads.
 * This covers `vite dev`, where no such transform has run.
 */
export function loadAdSense() {
  if (typeof document === 'undefined' || !AD_CLIENT) return
  if (document.querySelector(`script[src^="${SCRIPT_SRC}"]`)) return

  const script = document.createElement('script')
  script.async = true
  script.crossOrigin = 'anonymous'
  script.src = `${SCRIPT_SRC}?client=${AD_CLIENT}`
  document.head.appendChild(script)
}

/**
 * Ask AdSense to fill one <ins>.
 *
 * Pushing twice for the same element throws "All ins elements in the DOM with
 * class=adsbygoogle already have ads in them", which React's StrictMode double
 * mount would otherwise cause on every slot in development.
 *
 * @param {HTMLElement} element
 * @returns {boolean} Whether a push was made.
 */
export function fillAdSlot(element) {
  if (!element || element.dataset.adsbygoogleStatus) return false
  try {
    window.adsbygoogle = window.adsbygoogle || []
    window.adsbygoogle.push({})
    return true
  } catch (error) {
    console.warn('AdSense slot could not be filled:', error?.message || error)
    return false
  }
}
