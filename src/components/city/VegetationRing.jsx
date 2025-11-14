import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import PropTypes from 'prop-types'

function Tree({ position, trunkHeight, foliageScale, windDirection = 0, windSpeed = 0 }) {
  const groupRef = useRef()
  
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
    if (!groupRef.current) return
    
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
    groupRef.current.rotation.z = totalSway * windX
    groupRef.current.rotation.x = -totalSway * windZ // Negative for correct direction
  })
  // Minimalist tree: Y-shaped trunk with three spherical leaves
  const trunkWidth = 0.15 * foliageScale
  const branchHeight = trunkHeight * 0.7
  const branchLength = trunkHeight * 0.3
  const branchAngle = Math.PI / 6 // 30 degrees
  const leafSize = foliageScale * 0.4

  return (
    <group ref={groupRef} position={position} rotation={[0, randomRotation, 0]}>
      {/* Main trunk */}
      <mesh castShadow receiveShadow position={[0, trunkHeight / 2, 0]}>
        <cylinderGeometry args={[trunkWidth * 0.6, trunkWidth, trunkHeight, 8]} />
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
        <cylinderGeometry args={[trunkWidth * 0.4, trunkWidth * 0.5, branchLength, 6]} />
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
        <cylinderGeometry args={[trunkWidth * 0.4, trunkWidth * 0.5, branchLength, 6]} />
        <meshStandardMaterial color="#d4a574" roughness={0.6} metalness={0.1} />
      </mesh>
      
      {/* Top leaf (central, largest) - medium green */}
      <mesh castShadow receiveShadow position={[0, trunkHeight + leafSize * 0.3, 0]}>
        <sphereGeometry args={[leafSize, 16, 16]} />
        <meshStandardMaterial color="#4a9e4a" roughness={0.3} metalness={0.05} />
      </mesh>
      
      {/* Left leaf - lighter green */}
      <mesh 
        castShadow 
        receiveShadow 
        position={[
          -Math.sin(branchAngle) * branchLength,
          branchHeight + leafSize * 0.25,
          -Math.cos(branchAngle) * branchLength
        ]}
      >
        <sphereGeometry args={[leafSize * 0.85, 16, 16]} />
        <meshStandardMaterial color="#5db85d" roughness={0.3} metalness={0.05} />
      </mesh>
      
      {/* Right leaf - darker green */}
      <mesh 
        castShadow 
        receiveShadow 
        position={[
          Math.sin(branchAngle) * branchLength,
          branchHeight + leafSize * 0.25,
          -Math.cos(branchAngle) * branchLength
        ]}
      >
        <sphereGeometry args={[leafSize * 0.85, 16, 16]} />
        <meshStandardMaterial color="#3d8f3d" roughness={0.3} metalness={0.05} />
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
  const blobCount = Math.max(3, Math.round(scale * 2.2))
  const blobIndices = new Array(blobCount).fill(0)

  return (
    <group position={position}>
      {blobIndices.map((_, index) => {
        const angle = (index / blobCount) * Math.PI * 2
        const radius = scale * 0.35 + Math.random() * scale * 0.25
        const x = Math.cos(angle) * radius + (Math.random() - 0.5) * scale * 0.18
        const z = Math.sin(angle) * radius + (Math.random() - 0.5) * scale * 0.18
        const y = Math.random() * scale * 0.25
        const blobScale = 0.6 + Math.random() * 0.55

        return (
          <mesh
            key={`bush-blob-${index}`}
            position={[x, y, z]}
            castShadow
            receiveShadow
            scale={[blobScale, blobScale * 1.1, blobScale]}
          >
            <icosahedronGeometry args={[scale * 0.5, 1]} />
            <meshStandardMaterial
              color={index % 2 === 0 ? '#3f8f3d' : '#357b34'}
              roughness={0.6}
              metalness={0.05}
            />
          </mesh>
        )
      })}
      <mesh position={[0, scale * 0.25, 0]} castShadow receiveShadow>
        <icosahedronGeometry args={[scale * 0.6, 1]} />
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

