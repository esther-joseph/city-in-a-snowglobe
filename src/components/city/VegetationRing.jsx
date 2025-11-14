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
  // Enhanced tree: Multiple branches with fuller foliage
  const trunkWidth = 0.15 * foliageScale
  const branchHeight = trunkHeight * 0.65
  const branchLength = trunkHeight * 0.35
  const leafSize = foliageScale * 0.4
  
  // Create multiple branches at different angles
  const branchCount = 5
  const branches = useMemo(() => {
    return Array.from({ length: branchCount }, (_, i) => {
      const angle = (i / branchCount) * Math.PI * 2
      const heightVariation = 0.15 + (i % 2) * 0.1 // Alternate heights
      const branchY = branchHeight + (trunkHeight * 0.15 * heightVariation)
      const branchAngle = Math.PI / 5 + (i % 3) * Math.PI / 12 // Vary branch angles
      // Use a seeded random based on index for consistent results
      const seed = (i * 7 + 13) % 100 / 100
      return {
        angle,
        branchY,
        branchAngle,
        length: branchLength * (0.8 + seed * 0.4)
      }
    })
  }, [branchHeight, branchLength, trunkHeight])

  return (
    <group ref={groupRef} position={position} rotation={[0, randomRotation, 0]}>
      {/* Main trunk - more polygons for texture */}
      <mesh castShadow receiveShadow position={[0, trunkHeight / 2, 0]}>
        <cylinderGeometry args={[trunkWidth * 0.6, trunkWidth, trunkHeight, 16]} />
        <meshStandardMaterial color="#d4a574" roughness={0.6} metalness={0.1} />
      </mesh>
      
      {/* Multiple branches */}
      {branches.map((branch, index) => {
        const branchWidth = trunkWidth * (0.35 - index * 0.03)
        const xOffset = Math.sin(branch.angle) * branch.length * 0.3
        const zOffset = Math.cos(branch.angle) * branch.length * 0.3
        
        return (
          <group key={`branch-${index}`}>
            {/* Primary branch */}
            <mesh 
              castShadow 
              receiveShadow 
              position={[xOffset, branch.branchY, zOffset]}
              rotation={[0, branch.angle, branch.branchAngle]}
            >
              <cylinderGeometry args={[branchWidth, branchWidth * 1.2, branch.length, 12]} />
              <meshStandardMaterial color="#d4a574" roughness={0.6} metalness={0.1} />
            </mesh>
            
            {/* Sub-branch (smaller branch off main branch) */}
            {index % 2 === 0 && (
              <mesh
                castShadow
                receiveShadow
                position={[
                  xOffset + Math.sin(branch.angle + Math.PI / 4) * branch.length * 0.6,
                  branch.branchY + branch.length * 0.3,
                  zOffset + Math.cos(branch.angle + Math.PI / 4) * branch.length * 0.6
                ]}
                rotation={[0, branch.angle + Math.PI / 3, branch.branchAngle * 0.7]}
              >
                <cylinderGeometry args={[branchWidth * 0.6, branchWidth * 0.8, branch.length * 0.5, 10]} />
                <meshStandardMaterial color="#d4a574" roughness={0.6} metalness={0.1} />
              </mesh>
            )}
          </group>
        )
      })}
      
      {/* Central top leaf cluster - multiple spheres for fullness */}
      <mesh castShadow receiveShadow position={[0, trunkHeight + leafSize * 0.2, 0]}>
        <sphereGeometry args={[leafSize * 1.1, 20, 20]} />
        <meshStandardMaterial color="#4a9e4a" roughness={0.3} metalness={0.05} />
      </mesh>
      <mesh castShadow receiveShadow position={[leafSize * 0.3, trunkHeight + leafSize * 0.15, leafSize * 0.2]}>
        <sphereGeometry args={[leafSize * 0.7, 18, 18]} />
        <meshStandardMaterial color="#4a9e4a" roughness={0.3} metalness={0.05} />
      </mesh>
      <mesh castShadow receiveShadow position={[-leafSize * 0.3, trunkHeight + leafSize * 0.15, leafSize * 0.2]}>
        <sphereGeometry args={[leafSize * 0.7, 18, 18]} />
        <meshStandardMaterial color="#4a9e4a" roughness={0.3} metalness={0.05} />
      </mesh>
      
      {/* Leaf clusters at branch ends - multiple spheres per branch */}
      {branches.map((branch, index) => {
        const leafX = Math.sin(branch.angle) * branch.length
        const leafZ = Math.cos(branch.angle) * branch.length
        const leafY = branch.branchY + branch.length * 0.4
        
        // Different green shades for variety
        const greenShades = ['#5db85d', '#3d8f3d', '#4a9e4a', '#52a852', '#45a045']
        const baseColor = greenShades[index % greenShades.length]
        
        return (
          <group key={`leaves-${index}`}>
            {/* Main leaf sphere */}
            <mesh 
              castShadow 
              receiveShadow 
              position={[leafX, leafY, leafZ]}
            >
              <sphereGeometry args={[leafSize * 0.9, 18, 18]} />
              <meshStandardMaterial color={baseColor} roughness={0.3} metalness={0.05} />
            </mesh>
            
            {/* Secondary leaf spheres for fullness */}
            <mesh 
              castShadow 
              receiveShadow 
              position={[leafX + leafSize * 0.25, leafY + leafSize * 0.15, leafZ + leafSize * 0.15]}
            >
              <sphereGeometry args={[leafSize * 0.65, 16, 16]} />
              <meshStandardMaterial color={baseColor} roughness={0.3} metalness={0.05} />
            </mesh>
            <mesh 
              castShadow 
              receiveShadow 
              position={[leafX - leafSize * 0.25, leafY + leafSize * 0.15, leafZ - leafSize * 0.15]}
            >
              <sphereGeometry args={[leafSize * 0.65, 16, 16]} />
              <meshStandardMaterial color={baseColor} roughness={0.3} metalness={0.05} />
            </mesh>
            
            {/* Additional smaller leaves for extra fullness */}
            {index % 2 === 0 && (
              <>
                <mesh 
                  castShadow 
                  receiveShadow 
                  position={[leafX + leafSize * 0.15, leafY - leafSize * 0.1, leafZ + leafSize * 0.2]}
                >
                  <sphereGeometry args={[leafSize * 0.5, 14, 14]} />
                  <meshStandardMaterial color={baseColor} roughness={0.3} metalness={0.05} />
                </mesh>
                <mesh 
                  castShadow 
                  receiveShadow 
                  position={[leafX - leafSize * 0.15, leafY - leafSize * 0.1, leafZ - leafSize * 0.2]}
                >
                  <sphereGeometry args={[leafSize * 0.5, 14, 14]} />
                  <meshStandardMaterial color={baseColor} roughness={0.3} metalness={0.05} />
                </mesh>
              </>
            )}
          </group>
        )
      })}
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
  const blobCount = Math.max(5, Math.round(scale * 3.5))
  const blobIndices = useMemo(() => {
    return new Array(blobCount).fill(0).map((_, i) => {
      // Use seeded random based on index for consistent results
      const seed1 = (i * 11 + 17) % 100 / 100
      const seed2 = (i * 13 + 23) % 100 / 100
      const seed3 = (i * 7 + 31) % 100 / 100
      const seed4 = (i * 19 + 41) % 100 / 100
      return {
        angle: (i / blobCount) * Math.PI * 2,
        radius: scale * 0.35 + seed1 * scale * 0.25,
        x: 0, // Will be calculated
        z: 0, // Will be calculated
        y: seed2 * scale * 0.3,
        blobScale: 0.6 + seed3 * 0.55,
        detail: 1 + Math.floor(seed4 * 2) // More detail levels for texture
      }
    })
  }, [blobCount, scale])

  return (
    <group position={position}>
      {blobIndices.map((blob, index) => {
        // Use seeded random for consistent positioning
        const seedX = (index * 43 + 61) % 100 / 100
        const seedZ = (index * 47 + 67) % 100 / 100
        const x = Math.cos(blob.angle) * blob.radius + (seedX - 0.5) * scale * 0.18
        const z = Math.sin(blob.angle) * blob.radius + (seedZ - 0.5) * scale * 0.18

        return (
          <mesh
            key={`bush-blob-${index}`}
            position={[x, blob.y, z]}
            castShadow
            receiveShadow
            scale={[blob.blobScale, blob.blobScale * 1.1, blob.blobScale]}
          >
            <icosahedronGeometry args={[scale * 0.5, blob.detail]} />
            <meshStandardMaterial
              color={index % 3 === 0 ? '#3f8f3d' : index % 3 === 1 ? '#357b34' : '#46a043'}
              roughness={0.6}
              metalness={0.05}
            />
          </mesh>
        )
      })}
      {/* Central larger blob with more detail */}
      <mesh position={[0, scale * 0.25, 0]} castShadow receiveShadow>
        <icosahedronGeometry args={[scale * 0.6, 2]} />
        <meshStandardMaterial color="#46a043" roughness={0.55} metalness={0.08} />
      </mesh>
      {/* Additional smaller textured blobs for fullness */}
      {Array.from({ length: 3 }).map((_, i) => {
        const angle = (i / 3) * Math.PI * 2
        const radius = scale * 0.2
        // Use seeded random for consistent positioning
        const seed1 = (i * 29 + 47) % 100 / 100
        const seed2 = (i * 31 + 53) % 100 / 100
        const seed3 = (i * 37 + 59) % 100 / 100
        return (
          <mesh
            key={`bush-extra-${i}`}
            position={[
              Math.cos(angle) * radius,
              scale * 0.15 + seed1 * scale * 0.1,
              Math.sin(angle) * radius
            ]}
            castShadow
            receiveShadow
            scale={[0.4 + seed2 * 0.3, 0.5 + seed3 * 0.3, 0.4 + seed2 * 0.3]}
          >
            <icosahedronGeometry args={[scale * 0.35, 1]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? '#3f8f3d' : '#357b34'}
              roughness={0.6}
              metalness={0.05}
            />
          </mesh>
        )
      })}
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

