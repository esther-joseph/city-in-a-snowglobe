import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

// Animated water surface – gentle opacity ripple
function WaterBasin({ position, radius, color = '#42bce0', baseOpacity = 0.74 }) {
  const matRef = useRef()
  useFrame(({ clock }) => {
    if (!matRef.current) return
    const t = clock.getElapsedTime()
    matRef.current.opacity = baseOpacity + Math.sin(t * 2.4) * 0.07
  })
  return (
    <mesh position={position} receiveShadow>
      <cylinderGeometry args={[radius, radius, 0.065, 36]} />
      <meshPhysicalMaterial
        ref={matRef}
        color={color}
        transparent
        opacity={baseOpacity}
        roughness={0.04}
        metalness={0.0}
        transmission={0.48}
        clearcoat={1.0}
        clearcoatRoughness={0.04}
        ior={1.33}
      />
    </mesh>
  )
}

// Vertical water jet – bobs in height and fades
function WaterJet({ position, height = 1.1, idx = 0 }) {
  const meshRef = useRef()
  const matRef = useRef()
  useFrame(({ clock }) => {
    if (!meshRef.current || !matRef.current) return
    const t = clock.getElapsedTime()
    meshRef.current.scale.y = 0.86 + Math.sin(t * 3.8 + idx * 1.3) * 0.14
    matRef.current.opacity = 0.50 + Math.sin(t * 2.7 + idx * 0.9) * 0.15
  })
  return (
    <mesh ref={meshRef} position={position} castShadow>
      <cylinderGeometry args={[0.022, 0.058, height, 7]} />
      <meshPhysicalMaterial
        ref={matRef}
        color="#b8ecff"
        transparent
        opacity={0.58}
        roughness={0.04}
        transmission={0.58}
        clearcoat={1.0}
        clearcoatRoughness={0.04}
      />
    </mesh>
  )
}

// Expanding ripple ring on water surface
function Ripple({ position, maxR = 1.6, speed = 0.55, delay = 0 }) {
  const ref = useRef()
  const matRef = useRef()
  useFrame(({ clock }) => {
    if (!ref.current || !matRef.current) return
    const t = ((clock.getElapsedTime() * speed + delay) % 1.0)
    const s = 0.08 + t * 0.92
    ref.current.scale.set(s, 1, s)
    matRef.current.opacity = (1.0 - t) * 0.46
  })
  return (
    <mesh ref={ref} position={position} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[maxR, 0.030, 6, 40]} />
      <meshBasicMaterial ref={matRef} color="#c4eeff" transparent opacity={0.4} depthWrite={false} />
    </mesh>
  )
}

function Fountain() {
  return (
    <group>
      {/* ── Outer basin ── */}
      {/* Outer wall ring */}
      <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.55, 2.80, 0.36, 32]} />
        <meshStandardMaterial color="#9a8a76" roughness={0.82} metalness={0.12} />
      </mesh>
      {/* Outer basin floor */}
      <mesh position={[0, 0.26, 0]} receiveShadow>
        <cylinderGeometry args={[2.52, 2.52, 0.08, 32]} />
        <meshStandardMaterial color="#766050" roughness={0.88} metalness={0.08} />
      </mesh>
      {/* Outer water */}
      <WaterBasin position={[0, 0.34, 0]} radius={2.44} color="#3abcde" baseOpacity={0.76} />
      {/* Ripples – 3 phase-offset rings */}
      <Ripple position={[0, 0.37, 0]} maxR={1.85} speed={0.52} delay={0.00} />
      <Ripple position={[0, 0.37, 0]} maxR={1.85} speed={0.52} delay={0.33} />
      <Ripple position={[0, 0.37, 0]} maxR={1.85} speed={0.52} delay={0.66} />

      {/* ── Central stem ── */}
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.24, 0.36, 0.60, 16]} />
        <meshStandardMaterial color="#bfaf9a" roughness={0.72} metalness={0.14} />
      </mesh>

      {/* ── Middle tier ── */}
      <mesh position={[0, 1.04, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.28, 1.48, 0.22, 24]} />
        <meshStandardMaterial color="#b0a08a" roughness={0.78} metalness={0.10} />
      </mesh>
      <WaterBasin position={[0, 1.17, 0]} radius={1.22} color="#50cef0" baseOpacity={0.72} />
      <Ripple position={[0, 1.20, 0]} maxR={0.92} speed={0.68} delay={0.15} />
      <Ripple position={[0, 1.20, 0]} maxR={0.92} speed={0.68} delay={0.65} />

      {/* Middle stem */}
      <mesh position={[0, 1.48, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.14, 0.22, 0.52, 12]} />
        <meshStandardMaterial color="#c8b89e" roughness={0.70} metalness={0.14} />
      </mesh>

      {/* ── Upper tier ── */}
      <mesh position={[0, 1.77, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.64, 0.78, 0.20, 18]} />
        <meshStandardMaterial color="#d4c4ac" roughness={0.72} metalness={0.10} />
      </mesh>
      <WaterBasin position={[0, 1.88, 0]} radius={0.58} color="#68dcff" baseOpacity={0.68} />
      <Ripple position={[0, 1.91, 0]} maxR={0.44} speed={0.82} delay={0.0} />

      {/* Top stem */}
      <mesh position={[0, 2.12, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.07, 0.13, 0.46, 10]} />
        <meshStandardMaterial color="#ddd0b8" roughness={0.65} metalness={0.15} />
      </mesh>

      {/* ── Water jets ── */}
      {/* Central crown jet */}
      <WaterJet position={[0, 2.40, 0]} height={1.15} idx={0} />
      {/* 4 arcing jets from upper tier */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        return (
          <WaterJet
            key={`jet-${i}`}
            position={[Math.cos(a) * 0.62, 1.74, Math.sin(a) * 0.62]}
            height={0.60}
            idx={i + 1}
          />
        )
      })}
      {/* 6 outer jets from middle tier rim */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2
        return (
          <WaterJet
            key={`outer-jet-${i}`}
            position={[Math.cos(a) * 1.05, 1.03, Math.sin(a) * 1.05]}
            height={0.42}
            idx={i + 5}
          />
        )
      })}

      {/* ── Finial orb ── */}
      <mesh position={[0, 3.0, 0]} castShadow>
        <sphereGeometry args={[0.11, 12, 12]} />
        <meshStandardMaterial
          color="#fff2c0"
          emissive="#ffd060"
          emissiveIntensity={1.8}
          roughness={0.12}
          metalness={0.08}
        />
      </mesh>

      {/* Underwater glow */}
      <pointLight position={[0, 0.42, 0]} intensity={0.9} distance={4.5} color="#40c8ff" decay={2} />
      {/* Top ambient light for jets */}
      <pointLight position={[0, 2.6, 0]} intensity={0.6} distance={3.5} color="#a8e8ff" decay={2} />
    </group>
  )
}

export default Fountain
