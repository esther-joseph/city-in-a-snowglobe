import React, { useRef, useMemo, useEffect, useCallback } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { Icosahedron, Sphere } from '@react-three/drei'
import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'

function RainParticles({ performanceScale = 1 }) {
  const instancedMeshRef = useRef()
  const rippleRefs = useRef([])
  const count = Math.max(500, Math.round(1600 * performanceScale))
  const rippleCount = performanceScale < 0.85 ? 6 : 10
  const domeRadius = performanceScale < 0.85 ? 28 : 32

  const dropGeometry = useMemo(() => {
    const shape = new THREE.Shape()
    const height = 1.1
    const width = 0.38
    shape.moveTo(0, height)
    shape.quadraticCurveTo(width * 0.55, height * 0.55, 0, 0)
    shape.quadraticCurveTo(-width * 0.55, height * 0.55, 0, height)
    const extrudeSettings = {
      depth: 0.25,
      bevelEnabled: true,
      bevelSize: 0.04,
      bevelThickness: 0.05,
      bevelSegments: 2
    }
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
    geometry.center()
    return geometry
  }, [count])

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count)
    const verticalSpan = 45
    const baseHeight = 35

    const sampleXZ = () => {
      const theta = Math.random() * Math.PI * 2
      const radius = Math.sqrt(Math.random()) * domeRadius
      return [Math.cos(theta) * radius, Math.sin(theta) * radius]
    }
    
    for (let i = 0; i < count; i++) {
      const [x, z] = sampleXZ()
      positions[i * 3] = x
      positions[i * 3 + 1] = Math.random() * verticalSpan + baseHeight
      positions[i * 3 + 2] = z
      velocities[i] = Math.random() * 0.22 + 0.18
    }

    return { positions, velocities, sampleXZ, verticalSpan, baseHeight, domeRadius }
  }, [count, domeRadius])

  const ripplePool = useMemo(() => {
    const pool = []
    for (let i = 0; i < rippleCount; i++) {
      pool.push({
        active: false,
        start: 0,
        duration: 1200,
        radius: 0.5,
        mesh: null
      })
    }
    return pool
  }, [rippleCount])

  useEffect(() => {
    if (!instancedMeshRef.current) return
    const matrix = new THREE.Matrix4()
    for (let i = 0; i < count; i++) {
      matrix.identity()
      matrix.setPosition(
        particles.positions[i * 3],
        particles.positions[i * 3 + 1],
        particles.positions[i * 3 + 2]
      )
      matrix.scale(new THREE.Vector3(0.8, 0.8, 0.8))
      instancedMeshRef.current.setMatrixAt(i, matrix)
    }
    instancedMeshRef.current.instanceMatrix.needsUpdate = true
  }, [particles, count])

  const triggerRipple = useCallback((x, z) => {
    const now = performance.now()
    const ripple = ripplePool.find((r) => !r.active)
    if (!ripple) return
    ripple.active = true
    ripple.start = now
    ripple.radius = 0.65 + Math.random() * 0.35
    ripple.position = [x, 0.05, z]
  }, [ripplePool])

  useFrame(() => {
    if (!instancedMeshRef.current) return
    
    const positions = particles.positions
    
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] -= particles.velocities[i]
      
      if (positions[i * 3 + 1] < 0) {
        triggerRipple(positions[i * 3], positions[i * 3 + 2])
        positions[i * 3 + 1] = particles.verticalSpan + particles.baseHeight
        const [x, z] = particles.sampleXZ()
        positions[i * 3] = x
        positions[i * 3 + 2] = z
      }
    }
    
    const matrix = new THREE.Matrix4()
    for (let i = 0; i < count; i++) {
      matrix.identity()
      matrix.setPosition(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
      matrix.scale(new THREE.Vector3(0.8, 0.8, 0.8))
      instancedMeshRef.current.setMatrixAt(i, matrix)
    }
    instancedMeshRef.current.instanceMatrix.needsUpdate = true
  })

  useFrame(() => {
    ripplePool.forEach((ripple, index) => {
      if (!rippleRefs.current[index]) return
      const mesh = rippleRefs.current[index]
      if (!mesh) return
      if (!ripple.active) {
        mesh.visible = false
        return
      }
      const now = performance.now()
      const elapsed = now - ripple.start
      if (elapsed > ripple.duration) {
        ripple.active = false
        mesh.visible = false
        return
      }
      const progress = elapsed / ripple.duration
      const scale = ripple.radius + progress * 1.35
      mesh.visible = true
      mesh.position.set(ripple.position[0], ripple.position[1], ripple.position[2])
      mesh.scale.set(scale, scale, scale)
      mesh.material.opacity = 0.35 * (1 - progress)
    })
  })

  return (
    <>
      <instancedMesh ref={instancedMeshRef} args={[dropGeometry, null, count]}>
        <meshStandardMaterial
          color="#35b6ff"
          emissive="#c5f2ff"
          emissiveIntensity={0.75}
          transparent
          opacity={0.85}
          roughness={0.12}
          metalness={0.06}
          toneMapped={false}
        />
      </instancedMesh>
      {ripplePool.map((_, index) => (
        <mesh
          key={`rain-ripple-${index}`}
          ref={(ref) => {
            rippleRefs.current[index] = ref
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <ringGeometry args={[0.35, 0.5, 32]} />
          <meshBasicMaterial color="#9adfff" transparent opacity={0.35} />
        </mesh>
      ))}
    </>
  )
}

function SnowParticles({ performanceScale = 1 }) {
  const points = useRef()
  const count = Math.max(900, Math.round(2600 * performanceScale))

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count)
    const horizontalSpan = 80
    const verticalSpan = 45
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * horizontalSpan
      positions[i * 3 + 1] = Math.random() * verticalSpan + 5
      positions[i * 3 + 2] = (Math.random() - 0.5) * horizontalSpan
      velocities[i] = Math.random() * 0.18 + 0.06
    }
    
    return { positions, velocities, horizontalSpan, verticalSpan }
  }, [])

  useFrame((state) => {
    if (!points.current) return
    
    const positions = points.current.geometry.attributes.position.array
    const time = state.clock.elapsedTime
    
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] -= particles.velocities[i]
      positions[i * 3] += Math.sin(time + i) * 0.01
      
      if (positions[i * 3 + 1] < -5) {
        positions[i * 3 + 1] = particles.verticalSpan + 5
        positions[i * 3] = (Math.random() - 0.5) * particles.horizontalSpan
        positions[i * 3 + 2] = (Math.random() - 0.5) * particles.horizontalSpan
      }
    }
    
    points.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.18}
        color="#FFFFFF"
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  )
}

function ThunderboltParticles({ performanceScale = 1 }) {
  const instancedMeshRef = useRef()
  const count = Math.max(10, Math.round(25 * performanceScale))
  const lightningModel = useLoader(
    FBXLoader,
    new URL('../models/lightining-bolt/Lightning Bolt.fbx', import.meta.url).href
  )

  const boltGeometry = useMemo(() => {
    let extractedGeometry = null
    lightningModel?.traverse((child) => {
      if (!extractedGeometry && child.isMesh && child.geometry) {
        extractedGeometry = child.geometry.clone()
      }
    })

    if (!extractedGeometry) {
      const fallback = starGeometry.clone()
      fallback.scale(2.4, 2.4, 2.4)
      fallback.computeVertexNormals()
      return fallback
    }

    extractedGeometry.center()
    const scaleMatrix = new THREE.Matrix4().makeScale(0.65, 0.65, 0.65)
    extractedGeometry.applyMatrix4(scaleMatrix)
    extractedGeometry.computeVertexNormals()
    return extractedGeometry
  }, [lightningModel])

  const boltMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#fff45c',
        emissive: '#fff682',
        emissiveIntensity: 3.1,
        roughness: 0.25,
        metalness: 0.12,
        transparent: true,
        vertexColors: false,
        depthWrite: false,
        depthTest: false,
        toneMapped: false
      }),
    []
  )

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count)
    const intensities = new Float32Array(count)
    const flashPhase = new Float32Array(count)
    const horizontalSpan = 80
    const verticalSpan = 55
    const baseHeight = 34
    const vanishThreshold = -5 // halfway past globe equator
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * horizontalSpan
      positions[i * 3 + 1] = Math.random() * verticalSpan + baseHeight
      positions[i * 3 + 2] = (Math.random() - 0.5) * horizontalSpan
      velocities[i] = Math.random() * 0.12 + 0.06
      intensities[i] = 0
      flashPhase[i] = Math.random() * Math.PI * 2
    }

    return {
      positions,
      velocities,
      intensities,
      flashPhase,
      horizontalSpan,
      verticalSpan,
      baseHeight,
      vanishThreshold
    }
  }, [])

  useEffect(() => {
    if (!instancedMeshRef.current) return
    const matrix = new THREE.Matrix4()
    for (let i = 0; i < count; i++) {
      matrix.identity()
      matrix.setPosition(
        particles.positions[i * 3],
        particles.positions[i * 3 + 1],
        particles.positions[i * 3 + 2]
      )
      instancedMeshRef.current.setMatrixAt(i, matrix)
    }
    instancedMeshRef.current.instanceMatrix.needsUpdate = true
  }, [particles, count])

  useFrame((state, delta) => {
    if (!instancedMeshRef.current) return
    
    const {
      positions,
      velocities,
      intensities,
      flashPhase,
      horizontalSpan,
      verticalSpan,
      baseHeight,
      vanishThreshold
    } = particles
    const time = state.clock.elapsedTime
    const color = new THREE.Color()
    
    for (let i = 0; i < count; i++) {
      intensities[i] = Math.max(0, intensities[i] - delta * 0.23)
      
      positions[i * 3 + 1] -= velocities[i]
      
      if (positions[i * 3 + 1] < vanishThreshold) {
        positions[i * 3 + 1] = verticalSpan + baseHeight
        positions[i * 3] = (Math.random() - 0.5) * horizontalSpan
        positions[i * 3 + 2] = (Math.random() - 0.5) * horizontalSpan
        velocities[i] = Math.random() * 0.12 + 0.06
        intensities[i] = 1
      } else if (Math.random() < 0.012) {
        intensities[i] = 1
      }

      const burst = intensities[i] + Math.abs(Math.sin(time * 1.5 + flashPhase[i])) * 0.45

      const matrix = new THREE.Matrix4()
      matrix.identity()
      matrix.setPosition(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
      const burstScale = 1.2 + burst * 0.9
      matrix.scale(new THREE.Vector3(burstScale, burstScale, burstScale))
      instancedMeshRef.current.setMatrixAt(i, matrix)

      color.setHSL(0.14, 1, 0.42 + burst * 0.3)
      instancedMeshRef.current.setColorAt(i, color)
    }
    instancedMeshRef.current.instanceMatrix.needsUpdate = true
    if (instancedMeshRef.current.instanceColor) {
      instancedMeshRef.current.instanceColor.needsUpdate = true
    }
  })

  return (
    <instancedMesh ref={instancedMeshRef} args={[boltGeometry, boltMaterial, count]} />
  )
}

function Thunderbolts({ weatherType, weatherDescription, forceThunder = false, performanceScale = 1 }) {
  const hasThunder = forceThunder || weatherType?.includes('thunder') || weatherDescription?.includes('thunder')
  if (!hasThunder) return null

  return <ThunderboltParticles performanceScale={performanceScale} />
}

function CloudLayer({
  weatherType,
  windDirection,
  windSpeed,
  weatherData,
  validateNightSpread = false,
  performanceScale = 1
}) {
  const density = useMemo(() => {
    // Get cloud coverage percentage from API (0-100)
    const cloudCoverage = weatherData?.clouds?.all ?? 0
    const cloudCoverageFactor = cloudCoverage / 100 // Normalize to 0-1
    
    // Base density from weather type
    // Increased rain density significantly for more dramatic effect
    let baseDensity = 0.4
    if (weatherType.includes('storm')) baseDensity = 1
    else if (weatherType.includes('rain') || weatherType.includes('drizzle')) baseDensity = 0.95
    else if (weatherType.includes('cloud')) baseDensity = 0.6
    
    // When raining, prioritize base density more heavily for denser clouds
    const isRaining = weatherType.includes('rain') || weatherType.includes('drizzle')
    const weatherWeight = isRaining ? 0.7 : 0.4 // Give rain condition 70% weight
    const coverageWeight = isRaining ? 0.3 : 0.6 // Cloud coverage has less weight when raining
    
    // Combine weather type with cloud coverage for more accurate density
    const combinedDensity = baseDensity * weatherWeight + cloudCoverageFactor * coverageWeight
    
    // Ensure density is between 0.2 and 1.0
    return Math.max(0.2, Math.min(1.0, combinedDensity))
  }, [weatherType, weatherData])

  const windVector = useMemo(() => {
    if (!windDirection && windDirection !== 0) return { x: 0.05, z: 0.03 }
    const radians = (windDirection * Math.PI) / 180
    const speedFactor = 0.05 + Math.min(windSpeed, 15) / 60
    return {
      x: Math.sin(radians) * speedFactor,
      z: Math.cos(radians) * speedFactor
    }
  }, [windDirection, windSpeed])

  const cloudConfigs = useMemo(() => {
    const densityBoost = performanceScale < 1 ? 1 : 1.4
    const cloudCount = Math.max(
      8,
      Math.round((12 + density * 18) * (performanceScale < 1 ? 0.85 : densityBoost))
    )
    const baseRadius = 40
    const radiusJitter = 11
    // Raise clouds higher when raining to be above rain particles (rain is at y=25-50)
    const isRaining = weatherType.includes('rain') || weatherType.includes('drizzle')
    const minHeight = isRaining ? 35 : 28
    const heightJitter = 10
    return Array.from({ length: cloudCount }).map((_, index) => {
      const angle = (index / cloudCount) * Math.PI * 2 + Math.random() * 0.4
      const radius = baseRadius + Math.random() * radiusJitter
      const height = minHeight + Math.random() * heightJitter
      const baseScale = 2 + Math.random() * 1.4 * density
      const puffCount = 5 + Math.floor(Math.random() * 4 + density * 3)

      const puffs = Array.from({ length: puffCount }).map((__, puffIndex) => {
        const puffScale = 0.65 + Math.random() * 0.45
        const puffOffsetAngle = (puffIndex / puffCount) * Math.PI * 2
        const puffRadius = 0.6 + Math.random() * 0.3
        return {
          key: `cloud-${index}-puff-${puffIndex}`,
          scale: puffScale,
          offset: [
            Math.cos(puffOffsetAngle) * puffRadius,
            (Math.random() - 0.5) * 0.45,
            Math.sin(puffOffsetAngle) * puffRadius
          ],
          wobblePhase: {
            x: Math.random() * Math.PI * 2,
            y: Math.random() * Math.PI * 2,
            z: Math.random() * Math.PI * 2
          }
        }
      })

      return {
        key: `cloud-${index}`,
        position: [Math.cos(angle) * radius, height, Math.sin(angle) * radius],
        scale: baseScale,
        opacity: 0.28 + density * 0.22 + Math.random() * 0.08,
        speed: 0.35 + Math.random() * 0.25,
        wobble: {
          x: Math.random() * Math.PI * 2,
          y: Math.random() * Math.PI * 2,
          z: Math.random() * Math.PI * 2
        },
        puffs
      }
    })
  }, [density, weatherType, performanceScale])

  const cloudRefs = useMemo(
    () => cloudConfigs.map(() => React.createRef()),
    [cloudConfigs.length]
  )

  const driftVector = useMemo(() => ({ x: windVector.x, z: windVector.z }), [windVector])

  const cloudSpreadReloadRef = useRef(false)

  useEffect(() => {
    if (!validateNightSpread || cloudSpreadReloadRef.current) return
    if (!cloudConfigs?.length) return
    const radii = cloudConfigs.map((cloud) => Math.hypot(cloud.position[0], cloud.position[2]))
    const spread = Math.max(...radii) - Math.min(...radii)
    if (!Number.isFinite(spread) || spread < 5) {
      cloudSpreadReloadRef.current = true
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
    }
  }, [validateNightSpread, cloudConfigs])

  useFrame((state, delta) => {
    const moveX = driftVector.x * delta * 12
    const moveZ = driftVector.z * delta * 12
    const wrapRadius = 52
    const time = state.clock.elapsedTime

    cloudRefs.forEach((ref, index) => {
      const cloud = ref.current
      if (!cloud) return

      const config = cloudConfigs[index]
      cloud.position.x += moveX + config.speed * 0.03
      cloud.position.z += moveZ
      cloud.position.y += Math.sin(time * 0.25 + index) * 0.02

      const wobble = config.wobble
      cloud.children.forEach((child, childIndex) => {
        if (childIndex === 0) return
        const puff = config.puffs[childIndex - 1]
        const offset = puff.offset
        const wobblePhase = puff.wobblePhase
        child.position.x =
          offset[0] + Math.sin(time * 0.6 + wobble.x + wobblePhase.x) * 0.12
        child.position.z =
          offset[2] + Math.cos(time * 0.55 + wobble.z + wobblePhase.z) * 0.12
        child.position.y =
          offset[1] + Math.sin(time * 0.7 + wobble.y + wobblePhase.y) * 0.08
        child.rotation.y += delta * 0.12
      })

      if (cloud.position.x > wrapRadius) cloud.position.x = -wrapRadius
      if (cloud.position.x < -wrapRadius) cloud.position.x = wrapRadius
      if (cloud.position.z > wrapRadius) cloud.position.z = -wrapRadius
      if (cloud.position.z < -wrapRadius) cloud.position.z = wrapRadius
    })
  })


  return (
    <group>
      {cloudConfigs.map((cloud, index) => (
        <group
          key={cloud.key}
          ref={cloudRefs[index]}
          position={cloud.position}
          scale={[cloud.scale * 2.6, cloud.scale * 1.9, cloud.scale * 2.6]}
        >
          <Icosahedron args={[0.95, 1]}>
            <meshStandardMaterial
              color="#ffffff"
              transparent
              opacity={cloud.opacity}
              roughness={0.22}
              metalness={0.02}
            />
          </Icosahedron>
          {cloud.puffs.map((puff) => (
            <group key={puff.key} position={puff.offset} scale={puff.scale}>
              <Sphere args={[0.6, 16, 16]}>
                <meshStandardMaterial
                  color="#fefeff"
                  transparent
                  opacity={cloud.opacity * 0.95}
                  roughness={0.3}
                  metalness={0.02}
                />
              </Sphere>
              <Icosahedron args={[0.45, 1]}>
          <meshStandardMaterial
                  color="#ffffff"
            transparent
                  opacity={cloud.opacity * 0.85}
                  roughness={0.25}
                  metalness={0.015}
          />
              </Icosahedron>
            </group>
          ))}
        </group>
      ))}
    </group>
  )
}

function StarLayer({ windDirection, windSpeed, performanceScale = 1 }) {
  const windVector = useMemo(() => {
    if (!windDirection && windDirection !== 0) return { x: 0.03, z: 0.05 }
    const radians = (windDirection * Math.PI) / 180
    const speedFactor = 0.03 + Math.min(windSpeed || 0, 12) / 70
    return {
      x: Math.sin(radians) * speedFactor,
      z: Math.cos(radians) * speedFactor
    }
  }, [windDirection, windSpeed])

  const driftVector = useMemo(() => ({ x: windVector.x, z: windVector.z }), [windVector])

  const starConfigs = useMemo(() => {
    const count = Math.max(10, Math.round(26 * performanceScale))
    return Array.from({ length: count }).map((_, index) => {
      const angle = (index / count) * Math.PI * 2 + Math.random() * 0.4
      const radius = 34 + Math.random() * 26
      const height = 39 + Math.random() * 6
      const baseScale = 0.55 + Math.random() * 0.6
      return {
        key: `night-star-${index}`,
        position: [Math.cos(angle) * radius, height, Math.sin(angle) * radius],
        baseScale,
        speed: 0.2 + Math.random() * 0.35,
        twinkleSpeed: 0.8 + Math.random() * 1.4,
        twinklePhase: Math.random() * Math.PI * 2,
        initialXRotation: Math.random() * Math.PI * 2, // Random x-orientation
        initialYRotation: Math.random() * Math.PI * 2, // Random y-orientation
        initialZRotation: Math.random() * Math.PI * 2 // Random z-orientation
      }
    })
  }, [performanceScale])

  const starSpreadReloadRef = useRef(false)

  useEffect(() => {
    if (starSpreadReloadRef.current) return
    if (!starConfigs?.length) return
    const radii = starConfigs.map((star) => Math.hypot(star.position[0], star.position[2]))
    const spread = Math.max(...radii) - Math.min(...radii)
    if (!Number.isFinite(spread) || spread < 5) {
      starSpreadReloadRef.current = true
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
    }
  }, [starConfigs])

  return (
    <group>
      {starConfigs.map((star) => (
        <CuteStarInstance
          key={star.key}
          config={star}
          driftVector={driftVector}
          wrapRadius={68}
        />
      ))}
    </group>
  )
}

const starGeometry = (() => {
  // Create a stellated octahedron (stella octangula) - a proper stellated polyhedron
  // This creates a star shape with 8 spikes extending from a central octahedron
  const baseRadius = 0.3
  const spikeLength = 0.4
  
  // Create vertices for a stellated octahedron
  // An octahedron has 6 vertices, we'll create spikes from each face
  const vertices = []
  const indices = []
  
  // Base octahedron vertices (6 vertices)
  const octahedronVerts = [
    [0, baseRadius, 0],      // Top
    [0, -baseRadius, 0],     // Bottom
    [baseRadius, 0, 0],      // Right
    [-baseRadius, 0, 0],     // Left
    [0, 0, baseRadius],      // Front
    [0, 0, -baseRadius]      // Back
  ]
  
  // For each face of the octahedron, create a spike
  // An octahedron has 8 triangular faces
  const faces = [
    // Top faces
    [0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2],
    // Bottom faces
    [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5]
  ]
  
  let vertexIndex = 0
  
  // Create spikes by extending each face outward
  faces.forEach((face, faceIndex) => {
    // Calculate face center
    const v0 = octahedronVerts[face[0]]
    const v1 = octahedronVerts[face[1]]
    const v2 = octahedronVerts[face[2]]
    
    const centerX = (v0[0] + v1[0] + v2[0]) / 3
    const centerY = (v0[1] + v1[1] + v2[1]) / 3
    const centerZ = (v0[2] + v1[2] + v2[2]) / 3
    
    // Normalize to get direction
    const length = Math.sqrt(centerX * centerX + centerY * centerY + centerZ * centerZ)
    const nx = centerX / length
    const ny = centerY / length
    const nz = centerZ / length
    
    // Spike tip
    const spikeTip = [
      nx * (baseRadius + spikeLength),
      ny * (baseRadius + spikeLength),
      nz * (baseRadius + spikeLength)
    ]
    
    // Add the three base vertices and spike tip
    const baseV0 = vertexIndex++
    const baseV1 = vertexIndex++
    const baseV2 = vertexIndex++
    const tip = vertexIndex++
    
    vertices.push(...v0, ...v1, ...v2, ...spikeTip)
    
    // Create three triangular faces from base to tip
    indices.push(baseV0, baseV1, tip)
    indices.push(baseV1, baseV2, tip)
    indices.push(baseV2, baseV0, tip)
  })
  
  // Create geometry
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  
  return geometry
})()

function CuteStarInstance({ config, driftVector, wrapRadius }) {
  const starRef = useRef()

  // Set initial x, y, and z rotations
  useEffect(() => {
    if (starRef.current) {
      if (config.initialXRotation !== undefined) {
        starRef.current.rotation.x = config.initialXRotation
      }
      if (config.initialYRotation !== undefined) {
        starRef.current.rotation.y = config.initialYRotation
      }
      if (config.initialZRotation !== undefined) {
        starRef.current.rotation.z = config.initialZRotation
      }
    }
  }, [config.initialXRotation, config.initialYRotation, config.initialZRotation])

  useFrame((state, delta) => {
    if (!starRef.current) return
    const { speed, baseScale, twinkleSpeed, twinklePhase } = config
    starRef.current.position.x += driftVector.x * delta * 10 + speed * 0.02
    starRef.current.position.z += driftVector.z * delta * 10
    const time = state.clock.elapsedTime
    const twinkle = 0.25 + Math.sin(time * twinkleSpeed + twinklePhase) * 0.18
    const scaleValue = baseScale + twinkle
    starRef.current.scale.set(scaleValue, scaleValue, scaleValue)
    starRef.current.rotation.z += delta * 0.35

    if (starRef.current.position.x > wrapRadius) starRef.current.position.x = -wrapRadius
    if (starRef.current.position.x < -wrapRadius) starRef.current.position.x = wrapRadius
    if (starRef.current.position.z > wrapRadius) starRef.current.position.z = -wrapRadius
    if (starRef.current.position.z < -wrapRadius) starRef.current.position.z = wrapRadius
  })

  return (
    <group ref={starRef} position={config.position}>
      <mesh geometry={starGeometry}>
        <meshStandardMaterial
          color="#ffd966"
          emissive="#ffefa1"
          emissiveIntensity={0.85}
          roughness={0.35}
          metalness={0.1}
        />
      </mesh>
    </group>
  )
}

function WeatherEffects({
  weatherData,
  forceClouds = false,
  suppressClouds = false,
  enableNightStars = false,
  forceThunder = false,
  forceSnow = false,
  forceRain = false,
  shakeTrigger = 0,
  performanceTier = 'default'
}) {
  const performanceScale = performanceTier === 'mobile-ar' ? 0.6 : 1
  const starPerformanceScale = performanceTier === 'mobile-ar' ? 0.5 : 1
  const thunderPerformanceScale = performanceTier === 'mobile-ar' ? 0.7 : 1
  const baseWeatherType = weatherData?.weather?.[0]?.main?.toLowerCase?.() || ''
  const baseWeatherDescription = weatherData?.weather?.[0]?.description?.toLowerCase?.() || ''
  const weatherType = forceSnow
    ? 'snow'
    : forceThunder
      ? 'thunderstorm'
      : baseWeatherType
  const weatherDescription = forceSnow
    ? 'snow'
    : forceThunder
      ? 'thunderstorm'
      : baseWeatherDescription
  const windSpeed = weatherData?.wind?.speed || 0
  const windDirection = weatherData?.wind?.deg

  const hasRain = weatherType.includes('rain') || weatherType.includes('drizzle') || forceRain
  const hasSnow = weatherType.includes('snow') || forceSnow
  const hasCuteClouds =
    !suppressClouds &&
    (forceClouds ||
    forceThunder || // Show clouds when thunder is forced
    forceSnow || // Show clouds when snow is forced
    hasRain || // Show clouds when raining
    weatherType.includes('cloud') ||
    weatherDescription.includes('scattered') ||
    weatherDescription.includes('broken clouds') ||
    weatherDescription.includes('few clouds') ||
    weatherDescription.includes('overcast'))
  const hasWind = false

  const hasThunderstorm = weatherType.includes('thunder') || weatherDescription.includes('thunder') || forceThunder

  const shakeGroupRef = useRef()
  const shakeStateRef = useRef({ active: false, start: 0, duration: 0 })

  useEffect(() => {
    if (!shakeTrigger) return
    shakeStateRef.current = {
      active: true,
      start: performance.now(),
      duration: 3200
    }
  }, [shakeTrigger])

  useFrame((state, delta) => {
    const group = shakeGroupRef.current
    const shakeState = shakeStateRef.current
    if (!group || !shakeState.active) return
    const elapsed = performance.now() - shakeState.start
    if (elapsed >= shakeState.duration) {
      shakeState.active = false
      group.rotation.set(0, 0, 0)
      return
    }
    const progress = elapsed / shakeState.duration
    const intensity = Math.pow(1 - progress, 2)
    const spinSpeed = 12 * intensity + 2
    group.rotation.y += delta * spinSpeed
    group.rotation.x = Math.sin(progress * Math.PI * 6) * 0.2 * intensity
    group.rotation.z = Math.cos(progress * Math.PI * 4) * 0.15 * intensity
  })

  return (
    <group ref={shakeGroupRef}>
      {(hasRain || forceRain) && <RainParticles performanceScale={performanceScale} />}
      {(hasSnow || forceSnow) && <SnowParticles performanceScale={performanceScale} />}
      {hasCuteClouds && (
        <CloudLayer
          weatherType={weatherType}
          windDirection={windDirection}
          windSpeed={windSpeed}
          weatherData={weatherData}
          validateNightSpread={enableNightStars}
          performanceScale={performanceScale}
        />
      )}
      {(hasThunderstorm || forceThunder) && (
        <Thunderbolts 
          weatherType={weatherType} 
          weatherDescription={weatherDescription} 
          forceThunder={forceThunder}
          performanceScale={thunderPerformanceScale}
        />
      )}
      {enableNightStars && (
        <StarLayer
          windDirection={windDirection}
          windSpeed={windSpeed}
          performanceScale={starPerformanceScale}
        />
      )}
    </group>
  )
}

export default WeatherEffects
