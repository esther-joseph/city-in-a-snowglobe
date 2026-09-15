import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'

/**
 * Live rear-camera feed painted behind the transparent canvas.
 *
 * This is the fallback for devices with no immersive-ar session (iPhone and
 * iPad). There is no world tracking here — pairing it with
 * DeviceOrientationCamera gives a "magic window" rather than an anchored scene.
 */
function CameraFeedBackground({ onError }) {
  const videoRef = useRef(null)

  useEffect(() => {
    let stream = null
    let cancelled = false

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop())
          return
        }
        stream = mediaStream
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }
      })
      .catch((error) => {
        console.warn('Camera feed unavailable:', error)
        onError?.(error)
      })

    return () => {
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [onError])

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        zIndex: 0,
        pointerEvents: 'none'
      }}
    />
  )
}

CameraFeedBackground.propTypes = {
  onError: PropTypes.func
}

export default CameraFeedBackground
