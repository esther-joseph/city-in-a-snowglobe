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
