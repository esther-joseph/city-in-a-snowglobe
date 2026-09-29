/**
 * The full-screen ad, for the Play Store build only.
 *
 * There is no web equivalent of this and there is not going to be. AdSense
 * does not let a publisher place an interstitial; the only full-screen format
 * Google serves is the Vignette, and that is placed by Auto ads on Google's
 * own trigger, not on a state change in someone's app. A full-screen display
 * unit thrown up between two screens is a manual interstitial, which is the
 * kind of thing an account is closed for rather than warned about.
 *
 * AdMob is a different product with different rules, and this is the
 * placement it exists for: a break the person chose, between two screens,
 * with nothing of theirs interrupted.
 *
 * Which break matters. Not on the way *into* AR — an immersive session has to
 * be requested inside a live user gesture, and a gesture does not survive
 * somebody reading an ad and dismissing it, so the session would simply be
 * refused. On the way out, then: they have finished looking, there is a
 * transition to cover anyway, and nothing is waiting on a permission.
 *
 * The plugin is an optional dependency, held in a variable so Vite does not
 * try to resolve it for the web bundle. Everything here is a no-op without
 * it, which is what the web build gets.
 */

const PLUGIN = '@capacitor-community/admob'

/** How long between two of these, at the very least. */
export const MIN_GAP_MS = 4 * 60 * 1000

let pluginPromise = null
let lastShown = 0

async function admob() {
  if (!pluginPromise) {
    pluginPromise = import(/* @vite-ignore */ PLUGIN)
      .then((module) => module.AdMob ?? null)
      .catch(() => null)
  }
  return pluginPromise
}

/**
 * Whether enough has passed since the last one.
 *
 * Somebody stepping in and out of AR four times to look at the park from four
 * angles is exploring, not consuming four ad breaks. A full-screen ad every
 * time they come back out would make the feature unusable, and AdMob's own
 * policies say as much about frequency.
 *
 * @param {{ last?: number, now?: number, gap?: number }} [when]
 * @returns {boolean}
 */
export function interstitialIsDue({ last = lastShown, now = Date.now(), gap = MIN_GAP_MS } = {}) {
  // Never the first time either: the first exit from AR is the moment someone
  // decides what they think of the feature.
  if (!last) return false
  return now - last >= gap
}

/**
 * Note that the feature has been used, without showing anything.
 *
 * Called on the first exit, so that the clock the frequency cap reads from
 * starts at a real moment rather than at page load.
 */
export function markInterstitialPoint(now = Date.now()) {
  if (!lastShown) lastShown = now
}

/**
 * Fetch one in the background, so the exit is not spent waiting on a network.
 *
 * Called when AR is entered: by the time anyone comes back out, it is there.
 *
 * @param {{ unit?: string }} config
 * @returns {Promise<boolean>}
 */
export async function prepareInterstitial({ unit } = {}) {
  const AdMob = await admob()
  if (!AdMob || !unit) return false

  try {
    await AdMob.initialize()
    await AdMob.prepareInterstitial({ adId: unit })
    return true
  } catch {
    // No fill, no network, no plugin configured: none of these are worth
    // failing a screen change over.
    return false
  }
}

/**
 * Show it, if one is due and one is ready.
 *
 * @param {{ unit?: string }} config
 * @param {{ now?: () => number }} [clock]
 * @returns {Promise<boolean>} Whether an ad was actually shown.
 */
export async function showInterstitial({ unit } = {}, { now = () => Date.now() } = {}) {
  if (!unit) return false

  const at = now()
  if (!interstitialIsDue({ now: at })) {
    markInterstitialPoint(at)
    return false
  }

  const AdMob = await admob()
  if (!AdMob) return false

  try {
    await AdMob.showInterstitial()
    lastShown = at
    return true
  } catch {
    return false
  }
}

/** For the tests, which need a clock that has not already run. */
export function resetInterstitialClock(to = 0) {
  lastShown = to
}
