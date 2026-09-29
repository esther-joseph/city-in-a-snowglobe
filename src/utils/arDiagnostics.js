/**
 * A short account of what the AR session did, kept where a phone can show it.
 *
 * Sessions fail on devices and not on desks. The interesting ones cannot be
 * reproduced from a laptop at all — they need a camera, a room, and a phone
 * held in somebody's hand — and by the time anyone can say what happened the
 * evidence is a console nobody was attached to.
 *
 * So the app keeps its own account: when the session started, when it ended,
 * how long that was, whether the app asked for it, whether anyone was looking
 * at the screen, and anything that was thrown while it ran. It survives a
 * reload because it is written to sessionStorage, and it is readable from the
 * page as window.__arLog, so what gets reported back is what happened rather
 * than what it looked like.
 */

const KEY = 'snowglobe:ar-log'
/** Enough to see a pattern, few enough to never be a storage problem. */
const KEEP = 12

/** A session that ends this fast did not end because anybody wandered off. */
export const TOO_SHORT_MS = 6000

function read() {
  try {
    const raw = window.sessionStorage?.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function write(entries) {
  try {
    window.sessionStorage?.setItem(KEY, JSON.stringify(entries))
  } catch {
    // A blocked storage is not a reason to fail a session.
  }
}

/**
 * Note something that happened, with the time it happened.
 *
 * @param {string} what
 * @param {object} [detail]
 */
export function noteAR(what, detail = {}) {
  const entry = { what, at: new Date().toISOString(), ...detail }
  // Trimmed once, here, so what is stored and what is readable from the page
  // are the same list. They were not, and the page's could run one over.
  const entries = [...read(), entry].slice(-KEEP)
  write(entries)

  if (typeof window !== 'undefined') window.__arLog = entries
  return entry
}

/** Everything noted so far, oldest first. */
export function readARLog() {
  const entries = read()
  if (typeof window !== 'undefined') window.__arLog = entries
  return entries
}

/**
 * What to tell somebody whose session has just stopped on its own.
 *
 * Only for the ones worth explaining. A session that ran for a while and
 * ended is somebody finishing; there is nothing to say about that, and
 * saying something would be noise on every ordinary exit.
 *
 * @param {{ ranMs?: number, endedByApp?: boolean, hidden?: boolean, error?: string|null }} how
 * @returns {string|null} A line for the reader, or null to stay quiet.
 */
export function explainSessionEnd({ ranMs = 0, endedByApp = false, hidden = false, error = null } = {}) {
  if (endedByApp) return null
  if (ranMs >= TOO_SHORT_MS) return null

  const seconds = Math.max(0.1, ranMs / 1000).toFixed(1)

  if (error) {
    return `AR stopped after ${seconds}s: ${error}`
  }

  if (hidden) {
    return `AR stopped after ${seconds}s while the screen was away from you. If this keeps happening, it is worth reporting.`
  }

  return `AR stopped on its own after ${seconds}s. The view is back to 3D; trying again is safe.`
}

/**
 * Whether the app should start over rather than carry on.
 *
 * A reload is for an interruption — the phone went down, a call came in —
 * where the 3D view has been rebuilt on a page nobody was watching. It is
 * emphatically not for a session that dies the moment it opens: reloading
 * into a failure that happens every time is a loop, and a loop is worse than
 * the failure, because the failure at least leaves a working 3D view and a
 * message on the screen.
 *
 * @param {{ ranMs?: number, endedByApp?: boolean, hidden?: boolean }} how
 * @returns {boolean}
 */
export function shouldStartOver({ ranMs = 0, endedByApp = false, hidden = false } = {}) {
  if (endedByApp) return false
  if (!hidden) return false
  return ranMs >= TOO_SHORT_MS
}
