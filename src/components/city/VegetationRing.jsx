import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import PropTypes from 'prop-types'

function Tree({ position, trunkHeight, foliageScale, windDirection = 0, windSpeed = 0 }) {
  const canopyRef = useRef()
  
  // Random Y-axis rotation (0 to 2π) for each tree
  const randomRotation = useMemo(() => Math.random() * Math.PI * 2, [])
  
  // Convert wind direction from degrees to radians
  const windRadians = (windDirection * Math.PI) / 180
  // Calculate wind vector (direction the wind is blowing)
  const windX = Math.sin(windRadians)
  const windZ = Math.cos(windRadians)
  
  // Wind strength factor (0-1)
  const windStrength = Math.min(windSpeed / 15, 1) // Normalize to 0-1, max at 15 m/s
  
  useFrame((state) => {
    if (!canopyRef.current) return
    const time = state.clock.elapsedTime
    // S-curve swaying: use sine wave with phase offset for smooth s-curve motion
    const swayAmount = windStrength * 0.15 // Maximum sway angle in radians
    const swayFrequency = 0.8 + windStrength * 0.4 // Sway speed based on wind
    
    // Create s-curve by using sine with different phases for different parts
    // Base sway in wind direction
    const baseSway = Math.sin(time * swayFrequency) * swayAmount
    
    // Add secondary oscillation for s-curve effect (sine wave with phase offset)
    const sCurvePhase = Math.sin(time * swayFrequency * 1.3 + Math.PI / 4) * swayAmount * 0.6
    
    // Combine for smooth s-curve motion
    const totalSway = baseSway + sCurvePhase
    
    // Apply rotation in wind direction
    canopyRef.current.rotation.z = totalSway * windX
    canopyRef.current.rotation.x = -totalSway * windZ // Negative for correct direction
  })
  const trunkWidth = 0.16 * foliageScale
  const branchHeight = trunkHeight * 0.72
  const branchLength = trunkHeight * 0.34
  const branchAngle = Math.PI / 5
  const leafSize = foliageScale * 0.42

  const leafClusters = useMemo(() => {
    const clusters = []
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2
      const radius = 0.35 * leafSize + Math.random() * 0.25 * leafSize
      clusters.push({
        position: [
          Math.cos(angle) * radius,
          trunkHeight * 0.55 + Math.random() * trunkHeight * 0.45,
          Math.sin(angle) * radius
        ],
        scale: 0.8 + Math.random() * 0.5,
        colorIdx: i % 3
      })
    }
    clusters.push({
      position: [0, trunkHeight + leafSize * 0.3, 0],
      scale: 1.2,
      colorIdx: 1
    })
    return clusters
  }, [trunkHeight, leafSize])

  return (
    <group position={position} rotation={[0, randomRotation, 0]}>
      {/* Blocky trunk */}
      <mesh castShadow receiveShadow position={[0, trunkHeight / 2, 0]} scale={[1, 1.1, 1]}>
        <boxGeometry args={[trunkWidth * 1.2, trunkHeight, trunkWidth * 1.2]} />
        <meshStandardMaterial color="#9b6a3a" roughness={0.65} metalness={0.08} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, trunkHeight + leafSize * 0.45, 0]}>
        <boxGeometry args={[leafSize * 2.1, leafSize * 1.25, leafSize * 2.1]} />
        <meshStandardMaterial color="#417a36" roughness={0.4} metalness={0.05} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, trunkHeight + leafSize * 1.05, 0]}>
        <boxGeometry args={[leafSize * 1.65, leafSize * 1.1, leafSize * 1.65]} />
        <meshStandardMaterial color="#3a8f3c" roughness={0.35} metalness={0.05} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, trunkHeight + leafSize * 1.55, 0]}>
        <boxGeometry args={[leafSize * 1.25, leafSize * 1.05, leafSize * 1.25]} />
        <meshStandardMaterial color="#48a24a" roughness={0.32} metalness={0.05} />
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

function Bush({ position, scale }) {
  const blockCount = Math.max(4, Math.round(scale * 2.2))
  const blockIndices = new Array(blockCount).fill(0)

  return (
    <group position={position}>
      {blockIndices.map((_, index) => {
        const angle = (index / blockCount) * Math.PI * 2
        const radius = scale * 0.35 + Math.random() * scale * 0.18
        const x = Math.cos(angle) * radius + (Math.random() - 0.5) * scale * 0.2
        const z = Math.sin(angle) * radius + (Math.random() - 0.5) * scale * 0.2
        const y = Math.random() * scale * 0.2
        const blockScale = 0.45 + Math.random() * 0.25
        const colors = ['#3f8f3d', '#357b34', '#4aa347']

        return (
          <mesh
            key={`bush-block-${index}`}
            position={[x, y, z]}
            castShadow
            receiveShadow
            scale={[blockScale, blockScale, blockScale]}
          >
            <boxGeometry args={[scale * 0.7, scale * 0.7, scale * 0.7]} />
            <meshStandardMaterial
              color={colors[index % colors.length]}
              roughness={0.55}
              metalness={0.05}
            />
          </mesh>
        )
      })}
      <mesh position={[0, scale * 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[scale * 0.9, scale * 0.4, scale * 0.9]} />
        <meshStandardMaterial color="#4aa347" roughness={0.5} metalness={0.05} />
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

