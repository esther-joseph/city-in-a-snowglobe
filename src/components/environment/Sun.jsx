import React, { useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import { useFrame } from '@react-three/fiber'
import { createGlowTexture } from '../../utils/glowTexture'

/**
 * The sun as a soft glow rather than a lit ball: a golden core sitting in a
 * camera-facing halo that shades out through champagne and fades to nothing.
 *
 * The halo is a radial-gradient sprite rather than nested spheres — shells
 * give a hard edge and, added over a bright sky, wash out to white, which is
 * how the gold got lost.
 *
 * The whole thing breathes very slightly — a few percent over six seconds — so
 * it feels alive without drawing attention to itself.
 */
const BREATH_PERIOD = 6
const BREATH_DEPTH = 0.035

function Sun({
  position = [0, 0, 0],
  auraColor = '#ffb347',
  sunColor = '#ffd27d',
  glowColor = '#f7e4c0',
  auraIntensity = 1,
  scale = 1
}) {
  const radius = 3.2 * scale
  const coreRef = useRef(null)
  const haloRef = useRef(null)
  const lightRef = useRef(null)

  // Gold at the centre, champagne through the middle, gone by the edge.
  const glowTexture = useMemo(
    () =>
      createGlowTexture([
        { stop: 0, color: sunColor, alpha: 0.95 },
        { stop: 0.22, color: auraColor, alpha: 0.6 },
        { stop: 0.5, color: glowColor, alpha: 0.24 },
        { stop: 1, color: glowColor, alpha: 0 }
      ]),
    [sunColor, auraColor, glowColor]
  )

  useFrame((state) => {
    const breath = Math.sin((state.clock.elapsedTime / BREATH_PERIOD) * Math.PI * 2)
    const swell = 1 + breath * BREATH_DEPTH

    if (coreRef.current) coreRef.current.material.emissiveIntensity = 1.5 + breath * 0.18
    if (haloRef.current) {
      haloRef.current.scale.setScalar(radius * 6.4 * swell)
      haloRef.current.material.opacity = 0.9 + breath * 0.08
    }
    if (lightRef.current) lightRef.current.intensity = auraIntensity * (1 + breath * 0.05)
  })

  return (
    <group position={position}>
      <pointLight
        ref={lightRef}
        position={[0, 0, 0]}
        intensity={auraIntensity}
        color={auraColor}
        distance={180 * scale}
      />

      {/* Golden core */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial
          color={sunColor}
          emissive={sunColor}
          emissiveIntensity={1.5}
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* Gold falling away to champagne, always facing the viewer */}
      <sprite ref={haloRef} scale={radius * 6.4}>
        <spriteMaterial
          map={glowTexture}
          transparent
          opacity={0.9}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
    </group>
  )
}

Sun.propTypes = {
  position: PropTypes.arrayOf(PropTypes.number),
  auraColor: PropTypes.string,
  sunColor: PropTypes.string,
  /** Outermost halo — the champagne the gold fades into. */
  glowColor: PropTypes.string,
  auraIntensity: PropTypes.number,
  scale: PropTypes.number
}

export default Sun
