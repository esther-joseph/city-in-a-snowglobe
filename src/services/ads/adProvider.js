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
 * Whether an ad may run here at all.
 *
 * Off while the camera is showing: an ad laid over a live AR view invites the
 * accidental clicks that get a publisher account suspended, and it covers the
 * thing the reader pointed the camera at. Off when the reader has opted out,
 * and off when a test or a screenshot run asks for a clean page.
 *
 * On the web this used to be off everywhere, after ads on the app screen cost
 * the site its approval. What that finding was about is a screen with no
 * publisher content on it — a bare canvas — and the answer to it is where the
 * slots are allowed to be, not whether the web may have any. There is exactly
 * one on this app now, at the foot of the weather drawer, under the readings,
 * the hourly and weekly forecast, the UV and the sun's path; and the drawer
 * mounts it only while it is open, because an ad served into a panel that is
 * slid off-screen is an ad in hidden content, which is its own breach. The
 * written pages carry their own in their own markup, as before.
 *
 * @param {Object} [context]
 * @param {string} [context.renderMode] - '3d' or 'ar'.
 * @param {string} [context.platform] - Injectable, for the tests.
 * @returns {boolean}
 */
export function adsEnabled({ renderMode = '3d', platform = adPlatform() } = {}) {
  if (typeof window === 'undefined') return false
  if (renderMode === 'ar') return false
  if (platform === 'none') return false

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
 * The app's own page ships without it — nothing on index.html should be
 * asking for advertising before something that carries advertising is on
 * screen — so the loader arrives with the first slot that mounts, and only
 * then. The written pages carry the tag in their own markup instead, which is
 * also what AdSense's site verification reads.
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
