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

function createBowlGeometry(radius, depth, lip = 0.2, segments = 96) {
  const innerFirst = Math.max(radius - lip * 1.25, radius * 0.45)
  const innerSecond = Math.max(radius * 0.3, 0.12)
  const profile = [
    new THREE.Vector2(radius + lip * 0.15, 0),
    new THREE.Vector2(radius, 0),
    new THREE.Vector2(innerFirst, depth * 0.45),
    new THREE.Vector2(innerSecond, depth * 0.98),
    new THREE.Vector2(0.12, depth + lip * 0.65),
    new THREE.Vector2(0, depth + lip)
  ]
  const geometry = new THREE.LatheGeometry(profile, segments)
  return geometry
}

function Fountain() {
  const baseBowlGeometry = useMemo(() => createBowlGeometry(3.2, 0.7, 0.32, 110), [])
  const middleBowlGeometry = useMemo(() => createBowlGeometry(1.55, 0.55, 0.22, 90), [])
  const upperBowlGeometry = useMemo(() => createBowlGeometry(0.65, 0.38, 0.16, 72), [])

  useEffect(() => () => {
    baseBowlGeometry.dispose()
    middleBowlGeometry.dispose()
    upperBowlGeometry.dispose()
  }, [baseBowlGeometry, middleBowlGeometry, upperBowlGeometry])

  const columnPositions = useMemo(() => {
    const count = 8
    return Array.from({ length: count }).map((_, idx) => {
      const angle = (idx / count) * Math.PI * 2
      return [Math.cos(angle) * 2.45, 0.55, Math.sin(angle) * 2.45]
    })
  }, [])

  return (
    <group>
      {/* Lower plinth */}
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[4.0, 4.2, 0.18, 72]} />
        <meshStandardMaterial color="#bab1a1" roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.25, 0]} receiveShadow>
        <cylinderGeometry args={[3.6, 3.9, 0.3, 72]} />
        <meshStandardMaterial color="#cfc6b5" roughness={0.75} />
      </mesh>

      {/* Base bowl */}
      <mesh geometry={baseBowlGeometry} position={[0, 0.25, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#d7cbb8" roughness={0.72} metalness={0.08} />
      </mesh>
      <WaterSurface radius={3.05} position={[0, 0.9, 0]} color="#6fc8ef" />
      <mesh position={[0, 0.96, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.1, 0.06, 24, 96]} />
        <meshStandardMaterial color="#beb09d" roughness={0.55} />
      </mesh>

      {/* Decorative columns */}
      {columnPositions.map((pos, idx) => (
        <group key={`column-${idx}`} position={[pos[0], 0, pos[2]]}>
          <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.15, 0.22, 0.8, 16]} />
            <meshStandardMaterial color="#e0d5c4" roughness={0.6} metalness={0.12} />
          </mesh>
          <mesh position={[0, 0.84, 0]} castShadow receiveShadow>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial color="#f1e8d8" roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* Central pedestal */}
      <mesh position={[0, 1.25, 0]} castShadow>
        <cylinderGeometry args={[1.4, 1.75, 0.9, 48]} />
        <meshStandardMaterial color="#d3c7b4" roughness={0.68} />
      </mesh>
      <mesh position={[0, 1.65, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.55, 0.05, 20, 64]} />
        <meshStandardMaterial color="#c8bba8" roughness={0.58} />
      </mesh>

      {/* Middle bowl */}
      <group position={[0, 1.55, 0]}>
        <mesh geometry={middleBowlGeometry} castShadow receiveShadow>
          <meshStandardMaterial color="#dfd3c1" roughness={0.68} metalness={0.1} />
        </mesh>
      </group>
      <WaterSurface radius={1.35} position={[0, 2.05, 0]} color="#7fd6ff" />
      <mesh position={[0, 2.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.4, 0.04, 20, 64]} />
        <meshStandardMaterial color="#c1b29e" roughness={0.55} />
      </mesh>

      {/* Middle spray */}
      <FountainSpray origin={[0, 2.05, 0]} radiusRange={[0.18, 0.45]} heightRange={[0.85, 1.25]} count={120} />

      {/* Upper pedestal */}
      <mesh position={[0, 2.45, 0]} castShadow>
        <cylinderGeometry args={[0.65, 0.85, 0.65, 32]} />
        <meshStandardMaterial color="#e4dac8" roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.82, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.78, 0.035, 16, 48]} />
        <meshStandardMaterial color="#c7b8a4" roughness={0.48} />
      </mesh>

      {/* Upper bowl */}
      <group position={[0, 2.55, 0]}>
        <mesh geometry={upperBowlGeometry} castShadow receiveShadow>
          <meshStandardMaterial color="#eadfcd" roughness={0.58} />
        </mesh>
      </group>
      <WaterSurface radius={0.55} position={[0, 2.92, 0]} color="#8ce3ff" transmission={0.95} />
      <mesh position={[0, 2.98, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.6, 0.03, 16, 48]} />
        <meshStandardMaterial color="#cdbfae" roughness={0.5} />
      </mesh>

      {/* Finial and crown spray */}
      <mesh position={[0, 3.2, 0]} castShadow>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshStandardMaterial color="#f0e6d6" roughness={0.45} />
      </mesh>
      <FountainSpray origin={[0, 3.05, 0]} radiusRange={[0.04, 0.2]} heightRange={[0.85, 1.2]} count={140} />
    </group>
  )
}

export default Fountain

