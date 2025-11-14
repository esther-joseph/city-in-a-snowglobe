import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Icosahedron } from '@react-three/drei'
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
      {/* Root flare */}
      <mesh castShadow receiveShadow position={[0, trunkHeight * 0.08, 0]}>
        <cylinderGeometry args={[trunkWidth * 1.8, trunkWidth * 1.1, trunkHeight * 0.16, 16]} />
        <meshStandardMaterial color="#c79257" roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Main trunk */}
      <mesh castShadow receiveShadow position={[0, trunkHeight / 2, 0]}>
        <cylinderGeometry args={[trunkWidth * 0.55, trunkWidth * 0.8, trunkHeight, 18]} />
        <meshStandardMaterial color="#d4a574" roughness={0.6} metalness={0.1} />
      </mesh>
      
      {/* Left branch */}
      <mesh 
        castShadow 
        receiveShadow 
        position={[
          -Math.sin(branchAngle) * branchLength / 2,
          branchHeight,
          -Math.cos(branchAngle) * branchLength / 2
        ]}
        rotation={[0, branchAngle, -Math.PI / 6]}
      >
        <cylinderGeometry args={[trunkWidth * 0.35, trunkWidth * 0.45, branchLength, 12]} />
        <meshStandardMaterial color="#d4a574" roughness={0.6} metalness={0.1} />
      </mesh>
      
      {/* Right branch */}
      <mesh 
        castShadow 
        receiveShadow 
        position={[
          Math.sin(branchAngle) * branchLength / 2,
          branchHeight,
          -Math.cos(branchAngle) * branchLength / 2
        ]}
        rotation={[0, -branchAngle, Math.PI / 6]}
      >
        <cylinderGeometry args={[trunkWidth * 0.35, trunkWidth * 0.45, branchLength, 12]} />
        <meshStandardMaterial color="#d4a574" roughness={0.6} metalness={0.1} />
      </mesh>
      
      {/* Foliage clusters */}
      <group ref={canopyRef}>
        {leafClusters.map((cluster, idx) => {
          const colors = ['#4a9e4a', '#5db85d', '#3d8f3d']
          return (
            <Icosahedron
              key={`leaf-cluster-${idx}`}
              args={[leafSize * 0.85, 1]}
              position={cluster.position}
              scale={[cluster.scale, cluster.scale * 1.1, cluster.scale]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color={colors[cluster.colorIdx]} roughness={0.25} metalness={0.04} />
            </Icosahedron>
          )
        })}
      </group>
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
  const blobCount = Math.max(6, Math.round(scale * 3))
  const blobIndices = new Array(blobCount).fill(0)

  return (
    <group position={position}>
      {blobIndices.map((_, index) => {
        const angle = (index / blobCount) * Math.PI * 2
        const radius = scale * 0.3 + Math.random() * scale * 0.22
        const x = Math.cos(angle) * radius + (Math.random() - 0.5) * scale * 0.18
        const z = Math.sin(angle) * radius + (Math.random() - 0.5) * scale * 0.18
        const y = Math.random() * scale * 0.25
        const blobScale = 0.55 + Math.random() * 0.45

        return (
          <mesh
            key={`bush-blob-${index}`}
            position={[x, y, z]}
            castShadow
            receiveShadow
            scale={[blobScale, blobScale * 1.15, blobScale]}
          >
            <sphereGeometry args={[scale * 0.45, 20, 20]} />
            <meshStandardMaterial
              color={index % 2 === 0 ? '#3f8f3d' : '#357b34'}
              roughness={0.6}
              metalness={0.05}
            />
          </mesh>
        )
      })}
      <mesh position={[0, scale * 0.25, 0]} castShadow receiveShadow>
        <sphereGeometry args={[scale * 0.55, 24, 24]} />
        <meshStandardMaterial color="#46a043" roughness={0.55} metalness={0.08} />
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

