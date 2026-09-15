import { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'

// Port of the orientation maths from three's retired DeviceOrientationControls:
// device euler angles (YXZ) rotated into the camera's frame, then corrected for
// the current screen orientation.
const ZEE = new THREE.Vector3(0, 0, 1)
const EULER = new THREE.Euler()
const SCREEN_TRANSFORM = new THREE.Quaternion()
// -PI/2 around X: the device frame looks along +Z, the camera along -Z.
const DEVICE_TO_CAMERA = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5))

function applyOrientation(quaternion, alpha, beta, gamma, screenAngle) {
  EULER.set(beta, alpha, -gamma, 'YXZ')
  quaternion.setFromEuler(EULER)
  quaternion.multiply(DEVICE_TO_CAMERA)
  quaternion.multiply(SCREEN_TRANSFORM.setFromAxisAngle(ZEE, -screenAngle))
}

const toRadians = (degrees) => (degrees || 0) * (Math.PI / 180)

/**
 * Drives the r3f camera from the device's motion sensors.
 * @param {{ onHeading?: (alphaRadians: number) => void }} props
 */
function DeviceOrientationCamera({ onHeading }) {
  const camera = useThree((state) => state.camera)
  const orientation = useRef({ alpha: 0, beta: 0, gamma: 0, screen: 0 })
  const headingReported = useRef(false)

  useEffect(() => {
    const readScreenAngle = () =>
      toRadians(window.screen?.orientation?.angle ?? window.orientation ?? 0)

    const handleOrientation = (event) => {
      orientation.current = {
        alpha: toRadians(event.alpha),
        beta: toRadians(event.beta),
        gamma: toRadians(event.gamma),
        screen: readScreenAngle()
      }
      if (!headingReported.current) {
        headingReported.current = true
        onHeading?.(orientation.current.alpha)
      }
    }

    const handleScreenChange = () => {
      orientation.current = { ...orientation.current, screen: readScreenAngle() }
    }

    window.addEventListener('deviceorientation', handleOrientation, true)
    window.addEventListener('orientationchange', handleScreenChange)
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true)
      window.removeEventListener('orientationchange', handleScreenChange)
    }
  }, [onHeading])

  useFrame(() => {
    const { alpha, beta, gamma, screen } = orientation.current
    applyOrientation(camera.quaternion, alpha, beta, gamma, screen)
  })

  return null
}

DeviceOrientationCamera.propTypes = {
  onHeading: PropTypes.func
}

export default DeviceOrientationCamera
