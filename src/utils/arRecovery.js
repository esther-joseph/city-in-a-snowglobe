/**
 * Coming back to the app after AR was interrupted.
 *
 * Leaving the browser mid-session — a notification, the home button, a glance
 * at something else — ends the session, because the app ends it: a session
 * nobody is looking at holds the camera and keeps drawing. What is left
 * behind is a 3D view that was rebuilt while the page was hidden, which is
 * the worst moment to rebuild anything. Timers are throttled, frames stop,
 * and the staged planting that fills the park runs on frames. The scene that
 * comes back can be half built, and on some devices the WebGL context is gone
 * altogether and nothing is coming back at all.
 *
 * Reloading is the honest answer. It costs a few seconds and it is certain,
 * where nursing a half-built scene back is neither.
 *
 * What it must not cost is the city somebody was looking at. That lives in
 * React state and nowhere else, so a plain reload would land them back on New
 * York. The city goes into the URL on the way out.
 */

/**
 * Where to reload to, so the app comes back as it was.
 *
 * @param {object} [where]
 * @param {string} [where.city] - The city on screen.
 * @param {string} [where.href] - The current location; injectable for tests.
 * @returns {string} An absolute URL.
 */
export function reloadTarget({ city, href = window.location.href } = {}) {
  const url = new URL(href)

  if (city) url.searchParams.set('city', city)

  // Whatever took the app into AR is over. Coming back into a session
  // unasked would be a camera permission prompt nobody pressed anything for.
  url.searchParams.delete('view')
  // A fresh load deserves its loading screen: the scene is being built from
  // nothing, and this is exactly the wait that cover exists for.
  url.searchParams.delete('cover')

  return url.toString()
}

/**
 * Whether a failure to start a session is worth telling anybody about.
 *
 * Both of these arrive as a rejected promise and they are not the same thing.
 * A device that cannot do AR, or a reader who declined the camera, is worth a
 * notice. A session that failed because the app itself had just torn it down
 * — which is what happens every time somebody leaves the browser mid-session
 * — is not: it reads as "your device would not start an AR session" over a 3D
 * view that is working perfectly, blaming the reader's phone for something
 * the app chose to do.
 *
 * @param {{ endedByApp?: boolean }} [context]
 * @returns {boolean}
 */
export function worthWarningAbout({ endedByApp = false } = {}) {
  return !endedByApp
}
