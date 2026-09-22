import React, { useCallback, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import './ForecastCards.css'

/**
 * A horizontally scrolled strip with a scrollbar that is actually there.
 *
 * The native bar is not usable for this. macOS defaults to overlay scrollbars,
 * which take no layout space and fade out whenever the strip is not moving, so
 * there is nothing on screen to say the row continues past the edge of the
 * panel. Styling `::-webkit-scrollbar` does not override the system setting,
 * and setting `scrollbar-width` makes Chrome ignore those rules altogether.
 *
 * So the native bar is hidden and this draws one: always visible while there
 * is anything to scroll to, and draggable, because people will try.
 *
 * The thumb is written straight to the DOM rather than held in state. A scroll
 * event fires many times a second and every one of them would otherwise
 * re-render every card in the strip.
 */
function ScrollStrip({ children, className = '', testId, axis = 'x' }) {
  const vertical = axis === 'y'
  const scrollerRef = useRef(null)
  const trackRef = useRef(null)
  const thumbRef = useRef(null)
  const draggingRef = useRef(null)

  const sync = useCallback(() => {
    const scroller = scrollerRef.current
    const track = trackRef.current
    const thumb = thumbRef.current
    if (!scroller || !track || !thumb) return

    const total = vertical ? scroller.scrollHeight : scroller.scrollWidth
    const visible = vertical ? scroller.clientHeight : scroller.clientWidth
    const position = vertical ? scroller.scrollTop : scroller.scrollLeft

    const scrollable = total > visible + 1
    track.style.display = scrollable ? '' : 'none'
    if (!scrollable) return

    const size = Math.max((visible / total) * 100, 12)
    // The thumb has a real size, so it can only travel the track minus its
    // own length. Scaling by that keeps its far edge landing on the track's
    // far edge at the end of the scroll.
    const travel = 100 - size
    const progress = position / (total - visible)
    const shift = progress * travel * (100 / size)

    if (vertical) {
      thumb.style.height = `${size}%`
      thumb.style.transform = `translateY(${shift}%)`
    } else {
      thumb.style.width = `${size}%`
      thumb.style.transform = `translateX(${shift}%)`
    }
  }, [vertical])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return undefined

    sync()
    scroller.addEventListener('scroll', sync, { passive: true })

    const observer = new ResizeObserver(sync)
    observer.observe(scroller)
    // The children decide the scroll width, so watch them too.
    Array.from(scroller.children).forEach((child) => observer.observe(child))

    return () => {
      scroller.removeEventListener('scroll', sync)
      observer.disconnect()
    }
  }, [sync, children])

  const startDrag = useCallback(
    (event) => {
      const scroller = scrollerRef.current
      const track = trackRef.current
      if (!scroller || !track) return
      draggingRef.current = {
        start: vertical ? event.clientY : event.clientX,
        startScroll: vertical ? scroller.scrollTop : scroller.scrollLeft,
        trackLength: vertical ? track.clientHeight : track.clientWidth
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()
    },
    [vertical]
  )

  const onDrag = useCallback(
    (event) => {
      const drag = draggingRef.current
      const scroller = scrollerRef.current
      if (!drag || !scroller) return

      const total = vertical ? scroller.scrollHeight : scroller.scrollWidth
      const visible = vertical ? scroller.clientHeight : scroller.clientWidth
      const moved = (vertical ? event.clientY : event.clientX) - drag.start
      // A pixel of thumb is worth however many pixels of content the track
      // stands in for.
      const next = Math.max(
        0,
        Math.min(total - visible, drag.startScroll + (moved / drag.trackLength) * total)
      )

      if (vertical) scroller.scrollTop = next
      else scroller.scrollLeft = next
    },
    [vertical]
  )

  const endDrag = useCallback((event) => {
    draggingRef.current = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  return (
    <div className={`scroll-strip scroll-strip--${axis} ${className}`.trim()}>
      <div
        className={vertical ? 'forecast-rows' : 'forecast-scroller'}
        ref={scrollerRef}
        data-testid={testId}
      >
        {children}
      </div>
      <div className="scroll-strip__track" ref={trackRef} data-testid={testId && `${testId}-bar`}>
        <div
          className="scroll-strip__thumb"
          ref={thumbRef}
          onPointerDown={startDrag}
          onPointerMove={onDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          role="scrollbar"
          aria-orientation={vertical ? 'vertical' : 'horizontal'}
          aria-label="Scroll the forecast"
          tabIndex={-1}
        />
      </div>
    </div>
  )
}

ScrollStrip.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  testId: PropTypes.string,
  /** 'x' for a row of cards, 'y' for a column of them. */
  axis: PropTypes.oneOf(['x', 'y'])
}

export default ScrollStrip
