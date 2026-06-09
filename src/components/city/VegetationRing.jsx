import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import PropTypes from 'prop-types'

// Richer, multi-layer tree with rounded canopy tiers
function Tree({ position, trunkHeight, foliageScale, windDirection = 0, windSpeed = 0 }) {
  const canopyRef = useRef()
  const randomRotation = useMemo(() => Math.random() * Math.PI * 2, [])

  const windRadians = (windDirection * Math.PI) / 180
  const windX = Math.sin(windRadians)
  const windZ = Math.cos(windRadians)
  const windStrength = Math.min(windSpeed / 15, 1)

  useFrame((state) => {
    if (!canopyRef.current) return
    const time = state.clock.elapsedTime
    const swayAmount = windStrength * 0.15
    const swayFrequency = 0.8 + windStrength * 0.4
    const baseSway = Math.sin(time * swayFrequency) * swayAmount
    const sCurvePhase = Math.sin(time * swayFrequency * 1.3 + Math.PI / 4) * swayAmount * 0.6
    const totalSway = baseSway + sCurvePhase
    canopyRef.current.rotation.z = totalSway * windX
    canopyRef.current.rotation.x = -totalSway * windZ
  })

  const trunkWidth = 0.18 * foliageScale
  const r = foliageScale * 0.52   // canopy sphere radius base

  // Four green shades for variety
  const greens = ['#2d7a2f', '#3a9c3c', '#4db84f', '#56cc58', '#3f8f3d']
  const g = (i) => greens[i % greens.length]

  return (
    <group position={position} rotation={[0, randomRotation, 0]}>
      {/* Trunk */}
      <mesh castShadow receiveShadow position={[0, trunkHeight / 2, 0]}>
        <cylinderGeometry args={[trunkWidth * 0.6, trunkWidth, trunkHeight, 7]} />
        <meshStandardMaterial color="#7a4f28" roughness={0.85} metalness={0.0} />
      </mesh>

      {/* Canopy — 5 overlapping spheres for a full, rounded crown */}
      <group ref={canopyRef} position={[0, trunkHeight + r * 0.6, 0]}>
        {/* Main central sphere */}
        <mesh castShadow position={[0, 0, 0]}>
          <sphereGeometry args={[r * 1.05, 7, 6]} />
          <meshStandardMaterial color={g(1)} roughness={0.82} metalness={0.0} />
        </mesh>
        {/* Four offset side lobes for a lush, irregular silhouette */}
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2
          return (
            <mesh key={i} castShadow position={[Math.cos(a) * r * 0.55, -r * 0.15, Math.sin(a) * r * 0.55]}>
              <sphereGeometry args={[r * 0.82, 6, 5]} />
              <meshStandardMaterial color={g(i)} roughness={0.85} metalness={0.0} />
            </mesh>
          )
        })}
        {/* Top highlight lobe — slightly lighter */}
        <mesh castShadow position={[0, r * 0.65, 0]}>
          <sphereGeometry args={[r * 0.6, 6, 5]} />
          <meshStandardMaterial color={g(4)} roughness={0.78} metalness={0.0} />
        </mesh>
      </group>

      {/* Grass tuft at base */}
      <mesh receiveShadow position={[0, 0.04, 0]}>
        <cylinderGeometry args={[trunkWidth * 3.5, trunkWidth * 4, 0.08, 7]} />
        <meshStandardMaterial color="#3d7a32" roughness={0.95} metalness={0.0} />
      </mesh>
    </group>
  )
}

Tree.propTypes = {
  position: PropTypes.arrayOf(PropTypes.number).isRequired,
  trunkHeight: PropTypes.number.isRequired,
  foliageScale: PropTypes.number.isRequired,
  windDirection: PropTypes.number,
  windSpeed: PropTypes.number
}

// Lush rounded bush — sphere clusters instead of boxes
function Bush({ position, scale }) {
  const greens = ['#2e7d32', '#388e3c', '#43a047', '#4caf50', '#66bb6a']
  const lobeCount = Math.max(5, Math.round(scale * 3))

  return (
    <group position={position}>
      {/* Central body */}
      <mesh castShadow receiveShadow position={[0, scale * 0.32, 0]}>
        <sphereGeometry args={[scale * 0.38, 7, 6]} />
        <meshStandardMaterial color={greens[1]} roughness={0.88} metalness={0.0} />
      </mesh>
      {/* Outer lobes */}
      {[...Array(lobeCount)].map((_, i) => {
        const a = (i / lobeCount) * Math.PI * 2
        const r = scale * 0.28 + (i % 2) * scale * 0.06
        return (
          <mesh key={i} castShadow position={[Math.cos(a) * r, scale * 0.22, Math.sin(a) * r]}>
            <sphereGeometry args={[scale * 0.26, 6, 5]} />
            <meshStandardMaterial color={greens[i % greens.length]} roughness={0.9} metalness={0.0} />
          </mesh>
        )
      })}
      {/* Ground disc */}
      <mesh receiveShadow position={[0, 0.03, 0]}>
        <cylinderGeometry args={[scale * 0.55, scale * 0.55, 0.06, 7]} />
        <meshStandardMaterial color="#3d7a32" roughness={0.95} metalness={0.0} />
      </mesh>
    </group>
  )
}

Bush.propTypes = {
  position: PropTypes.arrayOf(PropTypes.number).isRequired,
  scale: PropTypes.number.isRequired
}

function VegetationRing({ trees = [], bushes = [], windDirection = 0, windSpeed = 0 }) {
  return (
    <group>
      {trees.map((tree) => (
        <Tree
          key={tree.key}
          position={tree.position}
          trunkHeight={tree.trunkHeight}
          foliageScale={tree.foliageScale}
          windDirection={windDirection}
          windSpeed={windSpeed}
        />
      ))}
      {bushes.map((bush) => (
        <Bush key={bush.key} position={bush.position} scale={bush.scale} />
      ))}
    </group>
  )
}

VegetationRing.propTypes = {
  trees: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      position: PropTypes.arrayOf(PropTypes.number).isRequired,
      trunkHeight: PropTypes.number.isRequired,
      foliageScale: PropTypes.number.isRequired
    })
  ),
  bushes: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      position: PropTypes.arrayOf(PropTypes.number).isRequired,
      scale: PropTypes.number.isRequired
    })
  ),
  windDirection: PropTypes.number,
  windSpeed: PropTypes.number
}

export default VegetationRing
