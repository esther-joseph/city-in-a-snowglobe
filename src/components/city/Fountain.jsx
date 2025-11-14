import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function FountainSpray({ origin = [0, 0, 0], radiusRange = [0.15, 0.35], heightRange = [1.2, 1.6], velocityRange = [0.85, 1.4], count = 160 }) {
  const pointsRef = useRef()

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = radiusRange[0] + Math.random() * (radiusRange[1] - radiusRange[0])
      const speed = velocityRange[0] + Math.random() * (velocityRange[1] - velocityRange[0])
      positions[i * 3] = origin[0] + Math.cos(angle) * radius
      positions[i * 3 + 1] = origin[1]
      positions[i * 3 + 2] = origin[2] + Math.sin(angle) * radius
      velocities[i * 3] = Math.cos(angle) * speed * 0.18
      velocities[i * 3 + 1] = heightRange[0] + Math.random() * (heightRange[1] - heightRange[0])
      velocities[i * 3 + 2] = Math.sin(angle) * speed * 0.18
    }

    return { positions, velocities }
  }, [count, heightRange, origin, radiusRange, velocityRange])

  useFrame((state, delta) => {
    if (!pointsRef.current) return
    const { positions, velocities } = pointsRef.current.userData

    for (let i = 0; i < count; i++) {
      positions[i * 3] += velocities[i * 3] * delta
      positions[i * 3 + 1] += velocities[i * 3 + 1] * delta
      positions[i * 3 + 2] += velocities[i * 3 + 2] * delta

      velocities[i * 3 + 1] -= 2.6 * delta

      if (positions[i * 3 + 1] < origin[1]) {
        const angle = Math.random() * Math.PI * 2
        const radius = radiusRange[0] + Math.random() * (radiusRange[1] - radiusRange[0])
        const speed = velocityRange[0] + Math.random() * (velocityRange[1] - velocityRange[0])
        positions[i * 3] = origin[0] + Math.cos(angle) * radius
        positions[i * 3 + 1] = origin[1]
        positions[i * 3 + 2] = origin[2] + Math.sin(angle) * radius
        velocities[i * 3] = Math.cos(angle) * speed * 0.18
        velocities[i * 3 + 1] = heightRange[0] + Math.random() * (heightRange[1] - heightRange[0])
        velocities[i * 3 + 2] = Math.sin(angle) * speed * 0.18
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef} userData={particles}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={particles.positions}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#8be2ff"
        size={0.06}
        transparent
        opacity={0.8}
        depthWrite={false}
      />
    </points>
  )
}

function WaterSurface({ radius, position = [0, 0, 0], color = '#6ec6ff', transmission = 0.95 }) {
  const meshRef = useRef()
  const materialRef = useRef()

  const geometry = useMemo(() => {
    const geo = new THREE.CircleGeometry(radius, 64)
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [radius])

  useEffect(() => () => geometry.dispose(), [geometry])

  // Ripple effect removed

  return (
    <mesh ref={meshRef} position={position} geometry={geometry} receiveShadow>
      <meshPhysicalMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={0.76}
        transmission={transmission}
        roughness={0.12}
        metalness={0.05}
        thickness={0.6}
        clearcoat={0.4}
        clearcoatRoughness={0.25}
      />
    </mesh>
  )
}

function RippleRings({
  radius,
  position = [0, 0, 0],
  count = 4,
  maxScale = 1.75,
  interval = 2.4,
  speedMultiplier = 1,
  color = '#b8f4ff',
  opacity = 0.28
}) {
  const ringRefs = useRef([])
  const geometry = useMemo(() => {
    const inner = radius * 0.82
    const outer = inner + radius * 0.18
    const geo = new THREE.RingGeometry(inner, outer, 64)
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [radius])

  useEffect(() => () => geometry.dispose(), [geometry])

  const offsets = useMemo(
    () => Array.from({ length: count }).map((_, index) => -((index / count) * interval)),
    [count, interval]
  )

  useFrame((state) => {
    const t = state.clock.elapsedTime * speedMultiplier
    ringRefs.current.forEach((ring, index) => {
      if (!ring) return
      const elapsed = (t + offsets[index]) % interval
      const progress = elapsed / interval
      const scale = 1 + progress * (maxScale - 1)
      ring.scale.set(scale, scale, scale)
      const material = ring.material
      if (material) {
        material.opacity = opacity * (1 - progress)
      }
    })
  })

  return (
    <group position={position}>
      {Array.from({ length: count }).map((_, index) => (
        <mesh
          key={`ripple-${index}`}
          ref={(node) => {
            ringRefs.current[index] = node
          }}
          geometry={geometry}
        >
          <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

function TierWater({
  radius,
  height,
  color,
  transmission = 0.9,
  rippleColor = '#b8f4ff',
  rippleCount = 4,
  rippleSpeed = 1.1,
  rippleOpacity = 0.24
}) {
  return (
    <group>
      <WaterSurface radius={radius} position={[0, height, 0]} color={color} transmission={transmission} />
      <RippleRings
        radius={radius * 0.86}
        position={[0, height + 0.01, 0]}
        count={rippleCount}
        maxScale={1.6}
        speedMultiplier={rippleSpeed}
        color={rippleColor}
        opacity={rippleOpacity}
      />
    </group>
  )
}

function Fountain() {
  return (
    <group>
      {/* Base tier */}
      <mesh position={[0, 0.25, 0]} receiveShadow>
        <cylinderGeometry args={[3.5, 3.7, 0.5, 48]} />
        <meshStandardMaterial color="#c4b8a6" roughness={0.8} />
      </mesh>
      <TierWater
        radius={3.25}
        height={0.43}
        color="#68c1ea"
        transmission={0.9}
        rippleCount={5}
        rippleSpeed={0.9}
        rippleOpacity={0.2}
      />
      <FountainSpray
        origin={[0, 0.45, 0]}
        radiusRange={[0.55, 1.1]}
        heightRange={[0.35, 0.7]}
        velocityRange={[0.45, 0.85]}
        count={80}
      />
      <mesh position={[0, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.3, 0.08, 16, 64]} />
        <meshStandardMaterial color="#b8ac9c" roughness={0.6} />
      </mesh>

      {/* Middle tier */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[1.4, 1.6, 0.8, 32]} />
        <meshStandardMaterial color="#d1c4b3" roughness={0.7} />
      </mesh>
      <TierWater
        radius={1.55}
        height={1.98}
        color="#79d2fb"
        transmission={0.94}
        rippleCount={4}
        rippleSpeed={1.2}
        rippleOpacity={0.3}
      />
      <FountainSpray
        origin={[0, 1.98, 0]}
        radiusRange={[0.2, 0.55]}
        heightRange={[0.7, 1.1]}
        velocityRange={[0.65, 1.05]}
        count={90}
      />
      <mesh position={[0, 2.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.6, 0.06, 16, 48]} />
        <meshStandardMaterial color="#b8ac9c" roughness={0.6} />
      </mesh>

      {/* Upper tier */}
      <mesh position={[0, 2.6, 0]} castShadow>
        <cylinderGeometry args={[0.6, 0.8, 0.7, 16]} />
        <meshStandardMaterial color="#d8ccb9" roughness={0.65} />
      </mesh>
      <TierWater
        radius={0.52}
        height={2.95}
        color="#8fe6ff"
        transmission={0.97}
        rippleCount={3}
        rippleSpeed={1.6}
        rippleOpacity={0.35}
      />
      <FountainSpray
        origin={[0, 2.95, 0]}
        radiusRange={[0.08, 0.22]}
        heightRange={[0.95, 1.35]}
        velocityRange={[0.85, 1.25]}
        count={120}
      />
      <mesh position={[0, 3.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.58, 0.05, 16, 48]} />
        <meshStandardMaterial color="#b8ac9c" roughness={0.55} />
      </mesh>

      {/* Finial */}
      <mesh position={[0, 3.35, 0]} castShadow>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color="#e2d6c3" roughness={0.5} />
      </mesh>
    </group>
  )
}

export default Fountain

