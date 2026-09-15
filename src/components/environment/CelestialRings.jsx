import React, { useMemo } from 'react'
import PropTypes from 'prop-types'
import * as THREE from 'three'

/**
 * Golden armillary rings.
 *
 * One ring carries the sun and another the moon, each tilted so its body rides
 * on the band, with a horizon ring between them — the arrangement that makes a
 * globe read as an astronomical instrument rather than an ornament.
 *
 * A ring's plane is the one containing both the body's direction and world up,
 * which is what a meridian ring does on a real armillary sphere: the band runs
 * up over the top of the globe and back under it, passing through the body.
 */
const UP = new THREE.Vector3(0, 1, 0)
const TORUS_NORMAL = new THREE.Vector3(0, 0, 1)
// A high metalness with no environment map renders almost black, which is how
// the first pass came out. Mostly dielectric with a warm emissive floor keeps
// the bands reading as polished brass in both day and night lighting.
const GOLD = '#e8bf5a'
const GOLD_EMISSIVE = '#8a6a1f'

function ringTransform(target) {
  const direction = new THREE.Vector3(...target)
  const radius = direction.length() || 1
  direction.normalize()

  // Perpendicular to both the body and up: the normal of the plane the two
  // share. Directly overhead there is no such plane, so pick one.
  const normal = new THREE.Vector3().crossVectors(direction, UP)
  if (normal.lengthSq() < 1e-6) normal.set(1, 0, 0)
  normal.normalize()

  const quaternion = new THREE.Quaternion().setFromUnitVectors(TORUS_NORMAL, normal)
  return { radius, quaternion }
}

function Band({ target, tube, opacity, segments = 96 }) {
  const { radius, quaternion } = useMemo(() => ringTransform(target), [target])

  return (
    <mesh quaternion={quaternion} castShadow={false} receiveShadow={false}>
      <torusGeometry args={[radius, tube, 10, segments]} />
      <meshStandardMaterial
        color={GOLD}
        emissive={GOLD_EMISSIVE}
        emissiveIntensity={0.55}
        metalness={0.4}
        roughness={0.32}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  )
}

Band.propTypes = {
  target: PropTypes.arrayOf(PropTypes.number).isRequired,
  tube: PropTypes.number.isRequired,
  opacity: PropTypes.number,
  segments: PropTypes.number
}

Band.defaultProps = { opacity: 1, segments: 96 }

function CelestialRings({ sunPosition, moonPosition, scale = 1 }) {
  const tube = 0.55 * scale

  // The horizon band sits between the two orbits and stays level.
  const horizonTarget = useMemo(() => {
    const sunRadius = new THREE.Vector3(...sunPosition).length()
    const moonRadius = new THREE.Vector3(...moonPosition).length()
    return [((sunRadius + moonRadius) / 2) * 0.98, 0, 0]
  }, [sunPosition, moonPosition])

  return (
    <group>
      {/* Sun ring */}
      <Band target={sunPosition} tube={tube} />
      {/* Moon ring */}
      <Band target={moonPosition} tube={tube * 0.85} />
      {/* Horizon ring — level, so it reads as the instrument's base circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[horizonTarget[0], tube * 0.7, 10, 120]} />
        <meshStandardMaterial
          color={GOLD}
          emissive={GOLD_EMISSIVE}
          emissiveIntensity={0.45}
          metalness={0.4}
          roughness={0.36}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  )
}

CelestialRings.propTypes = {
  sunPosition: PropTypes.arrayOf(PropTypes.number).isRequired,
  moonPosition: PropTypes.arrayOf(PropTypes.number).isRequired,
  scale: PropTypes.number
}

export default CelestialRings
