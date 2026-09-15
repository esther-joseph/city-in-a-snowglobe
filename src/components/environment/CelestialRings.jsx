import React, { useMemo } from 'react'
import PropTypes from 'prop-types'
import * as THREE from 'three'
import { Text } from '@react-three/drei'

/**
 * Golden armillary rings.
 *
 * A meridian ring carries whichever body is in the sky — the sun by day, the
 * moon by night — with a level horizon ring below it, the arrangement that
 * makes a globe read as an astronomical instrument rather than an ornament.
 *
 * A ring's plane is the one containing both the body's direction and world up,
 * which is what a meridian ring does on a real armillary sphere: the band runs
 * up over the top of the globe and back under it, passing through the body.
 */
const UP = new THREE.Vector3(0, 1, 0)
// The scene's compass: north is -Z, east is +X. Everything astronomical in the
// app agrees on this, so a bearing can be drawn straight onto the ring.
const CARDINALS = [
  { label: 'N', bearing: 0 },
  { label: 'E', bearing: 90 },
  { label: 'S', bearing: 180 },
  { label: 'W', bearing: 270 }
]
const INTERCARDINALS = [45, 135, 225, 315]

const bearingToPoint = (bearing, radius) => [
  Math.sin(bearing * (Math.PI / 180)) * radius,
  0,
  -Math.cos(bearing * (Math.PI / 180)) * radius
]
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
    <mesh name="celestial-ring" quaternion={quaternion} castShadow={false} receiveShadow={false}>
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

/** A bead riding on the compass ring at a body's true bearing. */
function BodyMarker({ bearing, radius, color, emissive, size, name }) {
  const [x, , z] = bearingToPoint(bearing, radius)
  return (
    <mesh name={name} position={[x, size * 0.9, z]}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={0.8}
        roughness={0.35}
        metalness={0.2}
      />
    </mesh>
  )
}

BodyMarker.propTypes = {
  name: PropTypes.string.isRequired,
  bearing: PropTypes.number.isRequired,
  radius: PropTypes.number.isRequired,
  color: PropTypes.string.isRequired,
  emissive: PropTypes.string.isRequired,
  size: PropTypes.number.isRequired
}

function CelestialRings({
  sunPosition,
  moonPosition,
  isNight = false,
  sunAzimuth = null,
  sunAltitude = null,
  moonAzimuth = null,
  moonAltitude = null,
  scale = 1
}) {
  const tube = 0.55 * scale

  // The horizon band sits between the two orbits and stays level.
  const horizonTarget = useMemo(() => {
    const sunRadius = new THREE.Vector3(...sunPosition).length()
    const moonRadius = new THREE.Vector3(...moonPosition).length()
    return [((sunRadius + moonRadius) / 2) * 0.98, 0, 0]
  }, [sunPosition, moonPosition])

  return (
    <group>
      {/* Only the band belonging to the body currently in the sky */}
      {isNight ? (
        <Band target={moonPosition} tube={tube * 0.85} />
      ) : (
        <Band target={sunPosition} tube={tube} />
      )}
      {/* Cardinal marks: the horizon ring doubles as a compass rose, read
          against true north for the city being shown */}
      {CARDINALS.map(({ label, bearing }) => {
        const [x, , z] = bearingToPoint(bearing, horizonTarget[0] * 1.1)
        // Upright and facing outward, so the letters stay legible from any
        // orbit angle instead of lying flat and foreshortening away.
        return (
          <Text
            key={label}
            position={[x, 2.4 * scale, z]}
            rotation={[0, Math.PI - bearing * (Math.PI / 180), 0]}
            fontSize={6.4 * scale}
            color={label === 'N' ? '#fff0c4' : GOLD}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.22 * scale}
            outlineColor="#2e2007"
          >
            {label}
          </Text>
        )
      })}

      {/* Quarter ticks between them */}
      {INTERCARDINALS.map((bearing) => {
        const [x, , z] = bearingToPoint(bearing, horizonTarget[0] * 1.035)
        return (
          <mesh
            key={`tick-${bearing}`}
            position={[x, 0, z]}
            rotation={[0, -bearing * (Math.PI / 180), 0]}
          >
            <boxGeometry args={[0.5 * scale, 0.5 * scale, 2.6 * scale]} />
            <meshStandardMaterial color={GOLD} emissive={GOLD_EMISSIVE} emissiveIntensity={0.4} />
          </mesh>
        )
      })}

      {/* Where the sun and moon actually stand, as bearings on the rose. Each
          shows only while its body is above the horizon. */}
      {sunAzimuth !== null && sunAltitude > 0 && (
        <BodyMarker
          name="compass-marker-sun"
          bearing={sunAzimuth}
          radius={horizonTarget[0]}
          color="#ffd27d"
          emissive="#ff9d2e"
          size={2.6 * scale}
        />
      )}
      {moonAzimuth !== null && moonAltitude > 0 && (
        <BodyMarker
          name="compass-marker-moon"
          bearing={moonAzimuth}
          radius={horizonTarget[0]}
          color="#e9edf6"
          emissive="#9fb2d8"
          size={2.2 * scale}
        />
      )}

      {/* Horizon ring — level, so it reads as the instrument's base circle */}
      <mesh name="celestial-ring-horizon" rotation={[-Math.PI / 2, 0, 0]}>
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
  /** Which band to show: the moon's after dark, the sun's otherwise. */
  isNight: PropTypes.bool,
  /** True bearings and altitudes, for the compass marks. */
  sunAzimuth: PropTypes.number,
  sunAltitude: PropTypes.number,
  moonAzimuth: PropTypes.number,
  moonAltitude: PropTypes.number,
  scale: PropTypes.number
}

export default CelestialRings
