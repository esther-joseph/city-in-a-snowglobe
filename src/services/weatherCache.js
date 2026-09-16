/**
 * A small time-to-live cache for weather payloads, backed by localStorage.
 *
 * Two things it buys us:
 *
 *  - Fewer upstream calls. OpenWeather's free tier is metered per day, and its
 *    own data only refreshes every ten minutes or so, which makes anything
 *    shorter than that a wasted call.
 *  - Something to show when the network is gone. An expired entry is still a
 *    better first paint than an error, so a failed fetch falls back to it.
 *
 * The Vercel edge cache in front of /api/openweather covers repeat visitors;
 * this covers the same visitor coming back to the same city.
 */

export const CACHE_TTL = 15 * 60 * 1000

// Past this an entry is not even worth showing as a fallback — a day-old sky
// is a lie rather than a stale truth.
export const STALE_LIMIT = 24 * 60 * 60 * 1000

const PREFIX = 'snowglobe:weather:'

/**
 * localStorage is not merely empty in some browsers — reading the property
 * throws outright (Safari with cookies blocked, embedded webviews with storage
 * disabled). Every access goes through here.
 * @returns {Storage|null}
 */
function storage() {
  try {
    const store = globalThis.localStorage
    // Presence is not permission: a disabled store throws on use, not access.
    const probe = `${PREFIX}probe`
    store.setItem(probe, '1')
    store.removeItem(probe)
    return store
  } catch {
    return null
  }
}

/**
 * @param {string} city
 * @param {string} units
 * @returns {string} Cache key for one city's complete payload.
 */
export function cacheKey(city, units = 'imperial') {
  return `${PREFIX}${units}:${String(city).toLowerCase().trim()}`
}

/**
 * @param {string} key
 * @returns {{ data: unknown, age: number }|null}
 */
export function readEntry(key) {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(key)
    if (!raw) return null
    const { timestamp, data } = JSON.parse(raw)
    if (typeof timestamp !== 'number' || data === undefined) {
      store.removeItem(key)
      return null
    }
    return { data, age: Date.now() - timestamp }
  } catch {
    // Corrupt entry — drop it rather than letting it throw on every read.
    try {
      store.removeItem(key)
    } catch {
      /* nothing left to do */
    }
    return null
  }
}

/** @returns {unknown|null} The entry if it is still inside the TTL. */
export function readFresh(key, ttl = CACHE_TTL) {
  const entry = readEntry(key)
  return entry && entry.age < ttl ? entry.data : null
}

/** @returns {unknown|null} The entry if it is old but not yet absurd. */
export function readStale(key, limit = STALE_LIMIT) {
  const entry = readEntry(key)
  return entry && entry.age < limit ? entry.data : null
}

/**
 * Store a payload. Quota failures prune our own keys and retry once; if it
 * still will not fit, the cache is simply skipped — it is an optimisation, not
 * a dependency.
 */
export function writeEntry(key, data) {
  const store = storage()
  if (!store) return false
  const record = JSON.stringify({ timestamp: Date.now(), data })
  try {
    store.setItem(key, record)
    return true
  } catch {
    clearAll(key)
    try {
      store.setItem(key, record)
      return true
    } catch {
      return false
    }
  }
}

/**
 * Drop every entry this module owns, optionally keeping one.
 * @param {string} [except]
 */
export function clearAll(except) {
  const store = storage()
  if (!store) return
  const doomed = []
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index)
    if (key && key.startsWith(PREFIX) && key !== except) doomed.push(key)
  }
  doomed.forEach((key) => {
    try {
      store.removeItem(key)
    } catch {
      /* ignore */
    }
  })
}
