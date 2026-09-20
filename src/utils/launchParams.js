/**
 * How the app was launched.
 *
 * The home-screen icon and its shortcuts open real URLs, so the launch state
 * lives in the query string rather than in storage. Everything here is
 * optional; an ordinary visit reads as all-defaults.
 *
 *   ?city=Kyoto     start on that city instead of the default
 *   ?panel=open     open the weather panel straight away (the "Change city"
 *                   shortcut)
 *   ?view=3d        boot to the 3D canvas — the default, accepted so the
 *                   manifest's start_url is explicit about it
 *   ?cover=off      skip the loading screen's hold. For the test suite and
 *                   the store-artwork capture, both of which would otherwise
 *                   spend fifteen seconds per page load waiting on it — and
 *                   in the capture's case photograph it.
 *   ?source=pwa     how it was launched; for analytics, not behaviour
 *
 * There is deliberately no ?view=ar. A WebXR session can only begin from a
 * user gesture, so a link cannot put the device into AR; the launch would just
 * fail on arrival. AR stays a button.
 */

export function launchParams(search = typeof window !== 'undefined' ? window.location.search : '') {
  let params
  try {
    params = new URLSearchParams(search)
  } catch {
    return { city: null, panelOpen: false, skipCover: false, view: '3d', source: null }
  }

  const city = params.get('city')?.trim()

  return {
    city: city || null,
    panelOpen: params.get('panel') === 'open',
    skipCover: params.get('cover') === 'off',
    // Always 3D: ?view=ar is accepted and ignored, for the reason above.
    view: '3d',
    source: params.get('source')
  }
}
