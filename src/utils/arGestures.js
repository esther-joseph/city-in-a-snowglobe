import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Turning and resizing the globe with a finger.
 *
 * In AR the globe is an object sitting in the room, and the two things anyone
 * tries on an object on a table are to turn it round and to make it bigger.
 * There is no orbit control in AR: the camera is the phone, and moving it
 * means walking. So the gestures move the globe instead.
 *
 * One finger dragged sideways turns it on its own axis. Two fingers pinched
 * resize it. Nothing is bound to a vertical drag: tipping a snow globe over
 * is not something anyone wants, and a vertical component in a one-finger
 * drag is almost always someone trying to scroll.
 *
 * It listens on the window rather than on the canvas, because in a session
 * with dom-overlay the canvas is not what receives the touches — the overlay
 * is, and the controls live there.
 */

/** How far the globe turns per pixel dragged: a full turn across a phone. */
const SPIN_PER_PIXEL = (Math.PI * 2) / 780

/** Small enough to hold in a hand, big enough to stand inside of. */
export const SCALE_RANGE = { min: 0.4, max: 4 }

/** A drag under this is a tap, and taps belong to the buttons. */
const DRAG_SLOP = 6

/**
 * @param {number} scale
 * @returns {number} The same, held inside what the globe can usefully be.
 */
export function clampScale(scale) {
  return Math.min(SCALE_RANGE.max, Math.max(SCALE_RANGE.min, scale))
}

/**
 * How far apart two touches are.
 *
 * @param {TouchList|Array<{ clientX: number, clientY: number }>} touches
 * @returns {number}
 */
export function pinchSpan(touches) {
  if (!touches || touches.length < 2) return 0
  return Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY
  )
}

/**
 * Where a gesture leaves the globe.
 *
 * Pure, and exported on its own, because the arithmetic is the part worth
 * checking: a pinch is a ratio of spans and a drag is a distance in pixels,
 * and neither should be able to leak into the other.
 *
 * @param {Object} start - What was true when the gesture began.
 * @param {Object} now - Where the fingers are.
 * @returns {{ scale: number, spin: number }}
 */
export function gestureResult(start, now) {
  if (start.span > 0 && now.span > 0) {
    // Pinching: the globe grows by however much the fingers spread, and does
    // not turn. A hand opening rotates a little as it goes and nobody means
    // it to.
    return { scale: clampScale(start.scale * (now.span / start.span)), spin: start.spin }
  }

  // Dragging: sideways only.
  return { scale: start.scale, spin: start.spin + (now.x - start.x) * SPIN_PER_PIXEL }
}

/** Does this touch belong to something that handles its own taps? */
function onAControl(target) {
  return Boolean(target?.closest?.('button, a, input, select, textarea, [role="button"]'))
}

/**
 * @param {Object} options
 * @param {boolean} options.enabled - Only while AR is up.
 * @returns {{ scale: number, spin: number, reset: () => void, touched: boolean }}
 */
export function useARGestures({ enabled }) {
  const [state, setState] = useState({ scale: 1, spin: 0, touched: false })
  const gesture = useRef(null)
  const live = useRef(state)
  live.current = state

  const reset = useCallback(() => setState({ scale: 1, spin: 0, touched: false }), [])

  useEffect(() => {
    if (!enabled) return undefined

    const begin = (event) => {
      if (onAControl(event.target)) return
      const touches = event.touches
      gesture.current = {
        x: touches[0].clientX,
        span: pinchSpan(touches),
        scale: live.current.scale,
        spin: live.current.spin,
        moved: false
      }
    }

    const move = (event) => {
      const start = gesture.current
      if (!start) return

      const touches = event.touches
      const now = { x: touches[0].clientX, span: pinchSpan(touches) }

      // A second finger landing mid-drag starts a pinch from where it is,
      // rather than snapping the globe to whatever span it opened at.
      if (start.span === 0 && now.span > 0) {
        gesture.current = { ...start, span: now.span, scale: live.current.scale }
        return
      }
      // And lifting one leaves a drag that starts here, not back where the
      // first finger landed.
      if (start.span > 0 && now.span === 0) {
        gesture.current = { ...start, span: 0, x: now.x, spin: live.current.spin }
        return
      }

      if (!start.moved && Math.abs(now.x - start.x) < DRAG_SLOP && now.span === 0) return
      start.moved = true

      // The page must not scroll or zoom underneath the gesture.
      if (event.cancelable) event.preventDefault()

      const next = gestureResult(start, now)
      setState({ ...next, touched: true })
    }

    const end = (event) => {
      if (event.touches.length === 0) gesture.current = null
    }

    // Not passive: a pinch on the overlay would otherwise zoom the page.
    const options = { passive: false }
    window.addEventListener('touchstart', begin, options)
    window.addEventListener('touchmove', move, options)
    window.addEventListener('touchend', end, options)
    window.addEventListener('touchcancel', end, options)

    return () => {
      gesture.current = null
      window.removeEventListener('touchstart', begin, options)
      window.removeEventListener('touchmove', move, options)
      window.removeEventListener('touchend', end, options)
      window.removeEventListener('touchcancel', end, options)
    }
  }, [enabled])

  useEffect(() => {
    // A dev aid, so the gestures can be driven from a test without reaching
    // into the scene graph.
    if (import.meta.env.DEV) window.__arGesture = state
  }, [state])

  return { ...state, reset }
}

export default useARGestures
