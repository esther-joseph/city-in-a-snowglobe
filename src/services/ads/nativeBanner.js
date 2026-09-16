/**
 * AdMob banners for the Play Store build.
 *
 * The plugin is an optional dependency: the web build does not have it
 * installed, and a static import would fail the bundle, so the specifier is
 * held in a variable to keep Vite from trying to resolve it. Every function
 * here is a no-op when the plugin is absent.
 *
 * To turn this on for the store build:
 *   npm i @capacitor-community/admob && npx cap sync android
 *   VITE_ADMOB_UNIT_DRAWER=ca-app-pub-…/… npm run android:bundle
 */

const PLUGIN = '@capacitor-community/admob'

let pluginPromise = null

async function admob() {
  if (!pluginPromise) {
    pluginPromise = import(/* @vite-ignore */ PLUGIN)
      .then((module) => module.AdMob ?? null)
      .catch(() => null)
  }
  return pluginPromise
}

/**
 * @param {{ unit: string, size?: string, position?: string }} config
 * @returns {Promise<boolean>} Whether a banner was shown.
 */
export async function showNativeBanner({ unit, size = 'BANNER', position = 'BOTTOM_CENTER' }) {
  const AdMob = await admob()
  if (!AdMob || !unit) return false

  try {
    await AdMob.initialize()
    await AdMob.showBanner({
      adId: unit,
      adSize: size,
      position,
      margin: 0
    })
    return true
  } catch (error) {
    console.warn('AdMob banner failed to show:', error?.message || error)
    return false
  }
}

export async function hideNativeBanner() {
  const AdMob = await admob()
  if (!AdMob) return
  try {
    await AdMob.hideBanner()
  } catch {
    /* the banner was never shown */
  }
}
