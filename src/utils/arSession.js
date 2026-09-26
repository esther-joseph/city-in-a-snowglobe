/**
 * Starting the immersive session.
 *
 * `store.enterAR()` needs the <XR> component to have connected itself to the
 * renderer first, and that does not happen until React has committed the AR
 * canvas and three.js has built it. Calling it in the same tick as the state
 * change fails with:
 *
 *   not connected to three.js. You either might be missing the <XR> component
 *   or the canvas is not yet loaded?
 *
 * One animation frame is not reliably enough either, so this retries until the
 * store is connected. The store exposes no public "ready" signal, and reaching
 * into its internals to find one would break on any upgrade, so the retry is
 * driven by the error the store itself reports.
 *
 * The retry window matters: requestSession needs the transient activation from
 * the tap that started this, and browsers expire that after about five
 * seconds. Two is comfortably inside it.
 */

const NOT_CONNECTED = /not connected to three\.js/i

export const ENTER_AR_TIMEOUT_MS = 2000
const RETRY_DELAY_MS = 50

/**
 * @param {{ enterAR: () => Promise<unknown> }} store
 * @param {Object} [options]
 * @param {number} [options.timeoutMs]
 * @param {() => number} [options.now] - Injectable clock, for the tests.
 * @returns {Promise<unknown>} The session, or a rejection worth showing.
 */
export async function enterARWhenReady(store, { timeoutMs = ENTER_AR_TIMEOUT_MS, now = () => Date.now() } = {}) {
  const deadline = now() + timeoutMs
  let lastError = null

  for (;;) {
    try {
      return await store.enterAR()
    } catch (error) {
      lastError = error
      // Anything other than "the canvas is not up yet" is a real refusal:
      // no WebXR, no permission, the reader declined the prompt. Retrying
      // those would just prompt again.
      if (!NOT_CONNECTED.test(String(error?.message ?? error))) throw error
      if (now() >= deadline) break
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    }
  }

  throw lastError
}

/**
 * End the session, whoever asked.
 *
 * Exiting AR means ending the XRSession, not merely switching the app back to
 * its 3D view. A session that is still running holds the camera and keeps
 * drawing, and the app draws its own scene underneath it.
 *
 * @param {{ getState?: () => { session?: XRSession } }} store
 * @returns {Promise<boolean>} Whether there was a session to end.
 */
export async function endARSession(store) {
  const session = store?.getState?.().session
  if (!session) return false
  try {
    await session.end()
  } catch {
    // Already ending, or ended by the system a moment ago. Either way the
    // caller's next step is the same.
  }
  return true
}

/**
 * Call back when a running session goes away, however it went.
 *
 * A session does not only end because the app asked. The headset's own menu
 * ends it, the system back gesture ends it, walking out of the guardian ends
 * it, and on a phone so does switching apps. Until the app hears about that
 * it keeps rendering an AR view with no camera behind it, which is what left
 * anyone leaving AR by the back button staring straight down at the fountain
 * from a foot above it.
 *
 * @param {{ subscribe: (listener: (state: any) => void) => () => void,
 *   getState: () => { session?: XRSession } }} store
 * @param {() => void} onEnd
 * @returns {() => void} Unsubscribe.
 */
export function watchARSession(store, onEnd) {
  if (!store?.subscribe) return () => {}

  let had = Boolean(store.getState?.().session)

  return store.subscribe((state) => {
    const has = Boolean(state?.session)
    if (had && !has) onEnd()
    had = has
  })
}

/**
 * Does this session draw the page's own HTML over its view?
 *
 * On a phone it does: ARCore's dom-overlay hands the session an element and
 * composites it, which is how the drawer keeps working inside AR. A headset
 * browser does not, which is the whole reason there are controls built out of
 * geometry at all.
 *
 * It has to be asked rather than guessed. dom-overlay is requested as an
 * optional feature, so a phone that refuses it needs the in-scene controls
 * too, and no amount of reading the user agent will say which happened.
 *
 * @param {{ domOverlayState?: { type?: string } }} [session]
 * @returns {boolean}
 */
export function compositesDom(session) {
  return Boolean(session?.domOverlayState?.type)
}
