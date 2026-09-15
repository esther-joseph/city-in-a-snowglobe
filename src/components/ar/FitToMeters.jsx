import React, { useRef } from 'react'
import PropTypes from 'prop-types'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

const box = new THREE.Box3()
const size = new THREE.Vector3()
const center = new THREE.Vector3()

/**
 * Scales its children so their largest dimension matches a real-world size,
 * and drops them so their base sits on the group origin.
 *
 * The scene is modelled in arbitrary units sized for an orbiting desktop
 * camera; anything shown against a live camera feed has to be in metres or the
 * globe swallows the room. Measured once, on the first frame where the
 * children have bounds.
 */
function FitToMeters({ targetDiameter = 0.5, children }) {
  const outer = useRef(null)
  const inner = useRef(null)
  const measured = useRef(false)

  useFrame(() => {
    if (measured.current || !inner.current || !outer.current) return

    box.setFromObject(inner.current)
    if (box.isEmpty()) return

    box.getSize(size)
    const largest = Math.max(size.x, size.y, size.z)
    if (!Number.isFinite(largest) || largest <= 0) return

    outer.current.scale.setScalar(targetDiameter / largest)
    box.getCenter(center)
    inner.current.position.set(-center.x, -box.min.y, -center.z)
    measured.current = true
  })

  return (
    <group ref={outer}>
      <group ref={inner}>{children}</group>
    </group>
  )
}

FitToMeters.propTypes = {
  targetDiameter: PropTypes.number,
  children: PropTypes.node
}

export default FitToMeters
