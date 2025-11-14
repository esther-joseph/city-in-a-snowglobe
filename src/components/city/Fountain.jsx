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

function Fountain() {
  const columnPositions = useMemo(() => {
    const positions = []
    const count = 14
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      positions.push([
        Math.cos(angle) * 3.1,
        0.65,
        Math.sin(angle) * 3.1
      ])
    }
    return positions
  }, [])

  return (
    <group>
      {/* Lower plinth */}
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <cylinderGeometry args={[4.1, 4.4, 0.3, 64]} />
        <meshStandardMaterial color="#bfb09c" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.35, 0]} receiveShadow>
        <cylinderGeometry args={[3.6, 3.9, 0.4, 64]} />
        <meshStandardMaterial color="#cfc3b1" roughness={0.78} />
      </mesh>

      {/* Decorative columns */}
      {columnPositions.map((pos, idx) => (
        <group key={`column-${idx}`} position={[pos[0], 0, pos[2]]}>
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.18, 0.25, 0.9, 12]} />
            <meshStandardMaterial color="#d8ccbb" roughness={0.65} metalness={0.15} />
          </mesh>
          <mesh position={[0, 0.92, 0]} castShadow receiveShadow>
            <sphereGeometry args={[0.14, 16, 16]} />
            <meshStandardMaterial color="#ebe1d0" roughness={0.45} />
          </mesh>
        </group>
      ))}

      {/* Base bowl */}
      <mesh position={[0, 0.25, 0]} receiveShadow>
        <cylinderGeometry args={[3.5, 3.7, 0.5, 64]} />
        <meshStandardMaterial color="#c4b8a6" roughness={0.8} />
      </mesh>
      <WaterSurface radius={3.25} position={[0, 0.43, 0]} color="#6bc8ef" />
      <mesh position={[0, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.3, 0.08, 24, 96]} />
        <meshStandardMaterial color="#b8ac9c" roughness={0.6} />
      </mesh>

      {/* Pedestal */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <cylinderGeometry args={[1.8, 2.1, 1.1, 48]} />
        <meshStandardMaterial color="#d6cab8" roughness={0.7} />
      </mesh>
      {[0.55, 0.95].map((offset, idx) => (
        <mesh key={`pedestal-ring-${idx}`} position={[0, 0.6 + idx * 0.5, 0]} castShadow>
          <torusGeometry args={[1.9 - idx * 0.2, 0.04, 12, 64]} />
          <meshStandardMaterial color="#cbbfab" roughness={0.6} />
        </mesh>
      ))}

      {/* Middle bowl */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[1.4, 1.6, 0.8, 48]} />
        <meshStandardMaterial color="#d1c4b3" roughness={0.7} />
      </mesh>
      <WaterSurface radius={1.55} position={[0, 1.98, 0]} color="#7dd8ff" />
      <mesh position={[0, 2.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.6, 0.06, 16, 64]} />
        <meshStandardMaterial color="#b8ac9c" roughness={0.6} />
      </mesh>

      {/* Middle spray */}
      <FountainSpray origin={[0, 1.98, 0]} radiusRange={[0.2, 0.55]} heightRange={[0.8, 1.3]} count={120} />

      {/* Upper pedestal */}
      <mesh position={[0, 2.35, 0]} castShadow>
        <cylinderGeometry args={[0.75, 0.95, 0.7, 32]} />
        <meshStandardMaterial color="#dcd1c0" roughness={0.65} />
      </mesh>
      <mesh position={[0, 2.78, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.9, 0.04, 16, 48]} />
        <meshStandardMaterial color="#c0b29d" roughness={0.55} />
      </mesh>

      {/* Upper bowl */}
      <mesh position={[0, 2.6, 0]} castShadow>
        <cylinderGeometry args={[0.6, 0.8, 0.7, 32]} />
        <meshStandardMaterial color="#d8ccb9" roughness={0.65} />
      </mesh>
      <WaterSurface radius={0.52} position={[0, 2.95, 0]} color="#8be2ff" transmission={0.96} />
      <mesh position={[0, 3.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.58, 0.05, 16, 64]} />
        <meshStandardMaterial color="#b8ac9c" roughness={0.55} />
      </mesh>

      {/* Finial */}
      <mesh position={[0, 3.35, 0]} castShadow>
        <sphereGeometry args={[0.25, 24, 24]} />
        <meshStandardMaterial color="#e2d6c3" roughness={0.5} />
      </mesh>
      {[0.15, 0.28].map((offset, idx) => (
        <mesh key={`finial-ring-${idx}`} position={[0, 3.25 + idx * 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.35 - idx * 0.08, 0.02, 12, 48]} />
          <meshStandardMaterial color="#cfc3b2" roughness={0.45} />
        </mesh>
      ))}

      {/* Crown spray */}
      <FountainSpray origin={[0, 3.1, 0]} radiusRange={[0.05, 0.25]} heightRange={[0.9, 1.4]} count={140} />
    </group>
  )
}

export default Fountain

