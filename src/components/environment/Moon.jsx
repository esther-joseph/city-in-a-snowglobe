import React, { useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import { useFrame } from '@react-three/fiber'
import { createGlowTexture } from '../../utils/glowTexture'

/**
 * The moon as a silver glow that pulses.
 *
 * Where the sun only breathes, the moon has a visible swell: the halo widens
 * and brightens over about five seconds and settles back, and the moonlight
 * falling on the city rises and falls with it, so the pulse is felt in the
 * scene rather than only seen in the sky.
 */
const PULSE_PERIOD = 4.5
const PULSE_DEPTH = 0.16

function Moon({
  position = [0, 0, 0],
  moonColor = '#f2f6ff',
  auraColor = '#6f7ab1',
  silverColor = '#dfe6f5',
  auraIntensity = 0.2,
  lightIntensity = 0.1,
  scale = 1
}) {
  const radius = 3 * scale
  const coreRef = useRef(null)
  const haloRef = useRef(null)
  const lightRef = useRef(null)

  // Silver at the centre, cooling towards the edge before it fades out.
  const glowTexture = useMemo(
    () =>
      createGlowTexture([
        { stop: 0, color: moonColor, alpha: 0.9 },
        { stop: 0.24, color: silverColor, alpha: 0.5 },
        { stop: 0.55, color: auraColor, alpha: 0.2 },
        { stop: 1, color: auraColor, alpha: 0 }
      ]),
    [moonColor, silverColor, auraColor]
  )

  useFrame((state) => {
    const pulse = Math.sin((state.clock.elapsedTime / PULSE_PERIOD) * Math.PI * 2)
    const swell = 1 + pulse * PULSE_DEPTH

    if (coreRef.current) coreRef.current.material.emissiveIntensity = 0.9 + pulse * 0.35
    if (haloRef.current) {
      haloRef.current.scale.setScalar(radius * 5.6 * swell)
      haloRef.current.material.opacity = 0.8 + pulse * 0.2
    }
    if (lightRef.current) {
      lightRef.current.intensity = (auraIntensity + lightIntensity) * (1 + pulse * 0.28)
    }
  })

  return (
    <group position={position}>
      <pointLight
        ref={lightRef}
        position={[0, 0, 0]}
        intensity={auraIntensity + lightIntensity}
        color={moonColor}
        distance={160 * scale}
      />

      {/* Silver body */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial
          color={moonColor}
          emissive={moonColor}
          emissiveIntensity={0.85}
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* Silver close in, cooler and dimmer further out */}
      <sprite ref={haloRef} scale={radius * 5.6}>
        <spriteMaterial
          map={glowTexture}
          transparent
          opacity={0.85}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
    </group>
  )
}

Moon.propTypes = {
  position: PropTypes.arrayOf(PropTypes.number),
  moonColor: PropTypes.string,
  auraColor: PropTypes.string,
  /** Inner halo — the silver sheen closest to the body. */
  silverColor: PropTypes.string,
  auraIntensity: PropTypes.number,
  lightIntensity: PropTypes.number,
  scale: PropTypes.number
}

export default Moon
