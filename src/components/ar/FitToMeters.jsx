import React, { useRef } from 'react'
import PropTypes from 'prop-types'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

const box = new THREE.Box3()
const size = new THREE.Vector3()
const center = new THREE.Vector3()

/**
 * Put a shrunken scene's lamps back where they were.
 *
 * Three works out how bright a point or spot light lands on a surface from
 * the distance between them in world space, and that distance shrinks with
 * everything else. Scale a city down to sit on a table and every lamp in it
 * is suddenly a hand's breadth from the wall it was lighting from across a
 * park: the same plate reads 36 at full size and a blown-out 255 at a
 * twentieth of it, which is why the globe in AR came out gold and white with
 * no city visible inside it.
 *
 * Irradiance falls as the square of the distance, so the intensity comes down
 * by the square of the scale. The reach is a plain world-space radius, so it
 * comes down by the scale itself. Directional, ambient and hemisphere lights
 * have no falloff and are left alone.
 *
 * The values are rewritten every frame rather than once, because they are
 * props: the sun and the street lamps brighten and dim with the hour, and
 * React writes the new value straight onto the light. Anything that does not
 * match what was written last time is taken as a fresh value to work from.
 *
 * @param {THREE.Object3D} root
 * @param {number} factor - What the scene was scaled by.
 */
export function compensateLights(root, factor) {
  root.traverse((object) => {
    // Only the lights that fall off with distance carry these two.
    if (!object.isLight || object.distance === undefined) return

    const memo = object.userData.fitToMeters || (object.userData.fitToMeters = {})
    if (memo.intensity !== object.intensity) memo.nativeIntensity = object.intensity
    if (memo.distance !== object.distance) memo.nativeDistance = object.distance

    object.intensity = memo.nativeIntensity * factor * factor
    object.distance = memo.nativeDistance * factor
    memo.intensity = object.intensity
    memo.distance = object.distance
  })
}

/**
 * A group at a fixed scale, with its lamps kept honest.
 *
 * The other half of the same problem. Immersive AR scales the park up rather
 * than down, undoing the shrink the globe applies to it, and a light whose
 * subject has moved further away is as wrong as one whose subject has come
 * closer: without this the park at its own size is lit about a thirteenth as
 * brightly as the globe on the table.
 *
 * The scale is given rather than measured, which is the only difference
 * between this and FitToMeters below.
 */
export function LightsAtScale({ factor, children }) {
  const group = useRef(null)

  useFrame(() => {
    if (group.current) compensateLights(group.current, factor)
  })

  return (
    <group ref={group} scale={factor}>
      {children}
    </group>
  )
}

LightsAtScale.propTypes = {
  factor: PropTypes.number.isRequired,
  children: PropTypes.node
}

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
  const factor = useRef(1)

  useFrame(() => {
    if (!inner.current || !outer.current) return

    if (!measured.current) {
      box.setFromObject(inner.current)
      if (box.isEmpty()) return

      box.getSize(size)
      const largest = Math.max(size.x, size.y, size.z)
      if (!Number.isFinite(largest) || largest <= 0) return

      factor.current = targetDiameter / largest
      outer.current.scale.setScalar(factor.current)
      box.getCenter(center)
      inner.current.position.set(-center.x, -box.min.y, -center.z)
      measured.current = true
    }

    // Every frame, and on the lights that have arrived by now: the park is
    // built in stages, so its lamps turn up several frames after the measure.
    compensateLights(inner.current, factor.current)
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
