/**
 * The element an immersive session is allowed to draw the page into.
 *
 * WebXR's dom-overlay feature does not composite the page over the camera
 * view. It composites *one element* — the overlay root named at session
 * request — and its descendants, and shows nothing else. Everything outside
 * that element is simply not on screen for as long as the session runs.
 *
 * @react-three/xr creates a root of its own when it is not given one: an
 * empty div appended to the body. Which is what was happening here, and why
 * the AR controls went missing on a phone. The session dutifully composited
 * an empty div, and the HUD — a sibling of it, in the app's own tree — was
 * outside the one element the session was showing.
 *
 * So the app makes the root itself, hands it to the store, and renders the
 * HUD into it through a portal. The library still owns showing and hiding it
 * with the session; this is only about which element it is.
 */

/**
 * @param {Document} [doc]
 * @returns {HTMLElement}
 */
export function createOverlayRoot(doc = document) {
  const root = doc.createElement('div')
  root.id = 'ar-dom-overlay'
  root.dataset.testid = 'ar-dom-overlay'

  // The viewport, and nothing of its own to look at. Fixed children inside a
  // composited overlay are laid out against this, and anything not explicitly
  // interactive lets the tap through to the session beneath.
  Object.assign(root.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    // Transparent, and stated rather than assumed.
    //
    // Chrome implements dom-overlay by fullscreening this element, and the
    // user-agent stylesheet gives a fullscreened element a black background.
    // Left at the default the overlay is an opaque black sheet with the HUD
    // on it and the camera nowhere to be seen — which is not what anybody
    // means by augmented reality.
    background: 'transparent',
    // Above the app's own chrome, since in a session it is the only thing on
    // screen anyway, and out of a session the library keeps it display: none.
    zIndex: '1000'
  })

  return root
}

/**
 * The one the store is given, made once per page.
 *
 * Module scope rather than a ref: createXRStore is called at module scope
 * too, because the store must outlive any component that mounts a canvas.
 */
export const arOverlayRoot = typeof document === 'undefined' ? null : createOverlayRoot()

/**
 * Where the HUD should be rendered.
 *
 * Only a session that is actually compositing the DOM needs the portal. The
 * camera fallback is an ordinary page with an ordinary overlay on top of it,
 * and rendering that into a hidden root would lose it completely.
 *
 * @param {{ compositing?: boolean, root?: HTMLElement|null }} [where]
 * @returns {HTMLElement|null} The element to portal into, or null to render
 *   in place.
 */
export function hudPortalTarget({ compositing = false, root = arOverlayRoot } = {}) {
  return compositing ? root ?? null : null
}
