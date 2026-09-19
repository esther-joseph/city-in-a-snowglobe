import React, { useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { starGeometry } from '../utils/starGeometry'
import './LoadingScreen.css'

/**
 * What the reader looks at while the globe is still being assembled.
 *
 * It covers the app completely on purpose. The scene underneath mounts with no
 * weather and no place, so for a moment it shows a city under a default sky at
 * whatever time the machine happens to think it is — which is wrong, and looks
 * like a bug rather than a wait. Better to show nothing of it until the sky is
 * the reader's own.
 */

const AMBER = '#f0bf55'

/** One star on a tilted circular orbit, like an electron shell. */
function OrbitingStar({ tilt, radius, speed, phase, scale }) {
  const groupRef = useRef()
  const starRef = useRef()

  useFrame((state) => {
    const time = state.clock.elapsedTime
    if (groupRef.current) groupRef.current.rotation.y = time * speed + phase
    if (starRef.current) {
      // Turning on its own axis as well, so the spikes catch the light
      // separately from the orbit.
      starRef.current.rotation.x = time * 0.9
      starRef.current.rotation.z = time * 0.6
    }
  })

  return (
    <group rotation={tilt}>
      <group ref={groupRef}>
        <mesh ref={starRef} geometry={starGeometry} position={[radius, 0, 0]} scale={scale}>
          <meshStandardMaterial
            color="#ffd966"
            emissive="#ffefa1"
            emissiveIntensity={0.9}
            roughness={0.35}
            metalness={0.1}
          />
        </mesh>
      </group>
      {/* The shell the star runs on. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.012, 8, 96]} />
        <meshBasicMaterial color={AMBER} transparent opacity={0.28} />
      </mesh>
    </group>
  )
}

OrbitingStar.propTypes = {
  tilt: PropTypes.arrayOf(PropTypes.number).isRequired,
  radius: PropTypes.number.isRequired,
  speed: PropTypes.number.isRequired,
  phase: PropTypes.number.isRequired,
  scale: PropTypes.number.isRequired
}

/** The nucleus: a larger star, turning slowly. */
function CoreStar() {
  const ref = useRef()
  useFrame((state, delta) => {
    if (!ref.current) return
    ref.current.rotation.y += delta * 0.5
    ref.current.rotation.x += delta * 0.22
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.6) * 0.06
    ref.current.scale.setScalar(pulse * 1.35)
  })

  return (
    <mesh ref={ref} geometry={starGeometry}>
      <meshStandardMaterial
        color="#ffe9a8"
        emissive={AMBER}
        emissiveIntensity={1.15}
        roughness={0.3}
        metalness={0.15}
      />
    </mesh>
  )
}

/** Three shells at different tilts — the atomic-model arrangement. */
const SHELLS = [
  { tilt: [0, 0, 0], radius: 1.35, speed: 1.15, phase: 0, scale: 0.42 },
  { tilt: [Math.PI / 3, 0, Math.PI / 5], radius: 1.7, speed: -0.85, phase: 1.9, scale: 0.36 },
  { tilt: [-Math.PI / 3.4, 0, -Math.PI / 4], radius: 2.05, speed: 0.62, phase: 3.6, scale: 0.3 }
]

function LoadingScreen({ message = 'Waking the globe…', progress = 0, visible = true }) {
  const clamped = Math.max(0, Math.min(1, progress))

  // The canvas is deliberately small and cheap: this runs while the main scene
  // is still compiling its shaders, so it must not compete for the GPU.
  const camera = useMemo(() => ({ position: [0, 0.6, 5.2], fov: 42 }), [])

  return (
    <div
      className={`loading-screen${visible ? '' : ' loading-screen--leaving'}`}
      role="status"
      aria-live="polite"
      aria-label={message}
      data-testid="loading-screen"
    >
      <div className="loading-screen__stage">
        <Canvas camera={camera} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
          <ambientLight intensity={0.55} />
          <directionalLight position={[3, 4, 5]} intensity={1.1} />
          <pointLight position={[0, 0, 0]} intensity={2.2} distance={6} color={AMBER} />
          <CoreStar />
          {SHELLS.map((shell, index) => (
            <OrbitingStar key={`shell-${index}`} {...shell} />
          ))}
        </Canvas>
      </div>

      <p className="loading-screen__message">{message}</p>

      <div
        className="loading-screen__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
      >
        <span className="loading-screen__fill" style={{ transform: `scaleX(${clamped})` }} />
      </div>

      <p className="loading-screen__hint">City In A Snowglobe</p>
    </div>
  )
}

LoadingScreen.propTypes = {
  message: PropTypes.string,
  progress: PropTypes.number,
  visible: PropTypes.bool
}

export default LoadingScreen
