import React, { useRef, useMemo, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { Icosahedron, Sphere } from '@react-three/drei'
import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import {
  SurfaceFieldContext,
  useBuiltSurfaceField,
  useSurfaceField
} from '../utils/surfaceField'
import { USDZ_ROOT_NAME } from '../utils/usdzExport'
import { starGeometry } from '../utils/starGeometry'
import { FALL_RADIUS, insideGlass } from '../utils/globeInterior'
import {
  CloudFieldContext,
  createCloudField,
  publishCloud,
  sampleUnderCloud,
  seedUnderClouds,
  useCloudField
} from '../utils/cloudField'

const DOWN_VECTOR = new THREE.Vector3(0, -1, 0)

/**
 * The longest frame the drifting sky will act on.
 *
 * requestAnimationFrame stops while a tab is hidden, so coming back delivers a
 * single delta covering the whole absence — minutes, sometimes. Anything
 * driven by delta then moves a minute's worth in one step. Clamping it means
 * the sky resumes where it was rather than teleporting.
 */
export const MAX_FRAME_SECONDS = 1 / 20

/**
 * Wrap a coordinate into [-limit, limit], keeping the overshoot.
 *
 * Clamping to the boundary instead — `if (x > limit) x = -limit` — is what
 * piled the whole sky into one clump: after a long frame every cloud is past
 * the edge, and every one of them lands on exactly the same coordinate.
 * Subtracting the span preserves the spacing between them however far they
 * have travelled.
 *
 * @param {number} value
 * @param {number} limit
 * @returns {number}
 */
export function wrapCoordinate(value, limit) {
  const span = limit * 2
  return (((value + limit) % span) + span) % span - limit
}

/**
 * The map of what is underneath: how wide it reaches and how fine it is.
 *
 * Wide enough to cover the ground the weather is allowed to land on, and fine
 * enough that a roof is a roof rather than a smudge. Every cell is a raycast
 * against the whole city, so this is a square of them, not a number to raise
 * without reason.
 */
const SURFACE_SPAN = 80
const SURFACE_RESOLUTION = 44

// How long the snow tumbles after a shake.
const SHAKE_TUMBLE_DURATION = 3200

function RainParticles({ performanceScale = 1 }) {
  const instancedMeshRef = useRef()
  const field = useCloudField()
  const surface = useSurfaceField()
  const seeded = useRef(false)
  const count = Math.max(500, Math.round(1600 * performanceScale))
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

    // Inside the glass, on the off chance there are no clouds to fall from:
    // forced rain with the clouds suppressed still has to rain somewhere.
    const reach = Math.min(domeRadius, FALL_RADIUS)
    const sampleXZ = () => {
      const theta = Math.random() * Math.PI * 2
      const radius = Math.sqrt(Math.random()) * reach
      return [Math.cos(theta) * radius, Math.sin(theta) * radius]
    }
    
    // Where they start before the first frame has told anyone where the
    // clouds are. They are recycled under one within a second of falling.
    for (let i = 0; i < count; i++) {
      const [x, z] = sampleXZ()
      positions[i * 3] = x
      positions[i * 3 + 1] = Math.random() * verticalSpan + baseHeight
      positions[i * 3 + 2] = z
      velocities[i] = Math.random() * 0.22 + 0.18
    }

    return { positions, velocities, sampleXZ, verticalSpan, baseHeight, domeRadius }
  }, [count, domeRadius])

  /**
   * Where the next drop comes from.
   *
   * Out of a cloud, if there is one: rain that falls from clear sky beside
   * the cloud it is supposed to be coming from is the thing being fixed here.
   * The old patch of sky is the fallback, for forced rain with the clouds
   * turned off, which still has to rain.
   */
  const spawn = useCallback(() => {
    const under = sampleUnderCloud(field)
    const from = under || {
      x: particles.sampleXZ()[0],
      y: particles.verticalSpan + particles.baseHeight,
      z: particles.sampleXZ()[1]
    }

    // Above whatever is under it. A cloud can hang lower than the rooftops
    // it is over — on a clear day with the rain forced on, they sit at
    // twenty-eight and the towers reach twenty-four — and a drop born inside
    // a tower has already landed. It lands again on the very next frame, and
    // the next, so a few hundred drops stuck like that fill the whole ripple
    // pool every frame and the rain stops reading as rain.
    const roof = surface?.current ? surface.current.sample(from.x, from.z) : 0
    return from.y > roof + 2 ? from : { ...from, y: roof + 4 }
  }, [field, particles, surface])

  /**
   * The rings a drop leaves where it lands.
   *
   * There used to be ten of them, taken in turn, which for sixteen hundred
   * drops meant almost every one landed without a mark. And they all appeared
   * at the same height, on the ground, whatever the drop had actually hit.
   *
   * They are instanced now — one mesh, hundreds of rings, one draw call — and
   * each one is placed at the height of whatever stopped the drop, so the
   * rain marks the rooftops and the canopy and the water in the fountain as
   * well as the street.
   */
  const rippleCount = Math.max(120, Math.round(420 * performanceScale))
  const rippleMeshRef = useRef()
  const ripples = useMemo(
    () => ({
      // How far through its life each ring is. Past one, it is not drawn.
      age: new Float32Array(rippleCount).fill(2),
      position: new Float32Array(rippleCount * 3),
      spread: new Float32Array(rippleCount),
      // A ring buffer: at this rate the oldest ring is always the one worth
      // giving up, and a free-slot search would be a scan per landing.
      next: 0
    }),
    [rippleCount]
  )

  const rippleAlpha = useMemo(() => new Float32Array(rippleCount), [rippleCount])

  const rippleGeometry = useMemo(() => {
    // Thin: a ring of disturbed water, not a washer.
    const ring = new THREE.RingGeometry(0.78, 1, 14)
    ring.rotateX(-Math.PI / 2)
    ring.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(rippleAlpha, 1))
    return ring
  }, [rippleAlpha])

  /**
   * Unlit, and one alpha per ring.
   *
   * A ring that fades has to carry its own transparency, and a material's
   * opacity is one number for every instance sharing it. So the fade rides on
   * an instanced attribute, which is the cheapest way to have hundreds of
   * them fading independently.
   */
  const rippleMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uColor: { value: new THREE.Color('#bfeaff') } },
        vertexShader: /* glsl */ `
          attribute float aAlpha;
          varying float vAlpha;
          void main() {
            vAlpha = aAlpha;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          varying float vAlpha;
          void main() {
            if (vAlpha <= 0.0) discard;
            gl_FragColor = vec4(uColor, vAlpha);
          }
        `
      }),
    []
  )

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

  /** Start a ring where a drop stopped, on whatever stopped it. */
  const triggerRipple = useCallback(
    (x, y, z) => {
      const slot = ripples.next
      ripples.next = (slot + 1) % rippleCount
      ripples.age[slot] = 0
      ripples.position[slot * 3] = x
      // A hair above the surface, or it fights the surface for every pixel.
      ripples.position[slot * 3 + 1] = y + 0.05
      ripples.position[slot * 3 + 2] = z
      // Not every drop lands the same way. Small: this is one drop, not a
      // stone in a pond, and at a metre and a half across they read as
      // puddles opening in the grass.
      ripples.spread[slot] = 0.22 + Math.random() * 0.18
    },
    [ripples, rippleCount]
  )

  useFrame(() => {
    if (!instancedMeshRef.current) return

    const positions = particles.positions

    // The first frame that knows where the clouds are fills the column under
    // them, rather than leaving the sky full of drops that started nowhere.
    if (!seeded.current) seeded.current = seedUnderClouds(field, positions, count)

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] -= particles.velocities[i]
      
      // Whatever is under this drop: a roof, a canopy, a bench, the water in
      // the fountain, or the street. Falling to zero and marking the ground
      // put every ripple under the thing the drop had actually hit.
      const ground = surface?.current
        ? surface.current.sample(positions[i * 3], positions[i * 3 + 2])
        : 0

      if (positions[i * 3 + 1] <= ground) {
        triggerRipple(positions[i * 3], ground, positions[i * 3 + 2])
        const from = spawn()
        positions[i * 3] = from.x
        // A little way back up inside the cloud, by a different amount each
        // time. Sent back to exactly the same height, the whole shower falls
        // in step: every drop lands on the same frame, every ring appears and
        // fades together, and between those bursts nothing lands at all.
        positions[i * 3 + 1] = from.y - Math.random() * 6
        positions[i * 3 + 2] = from.z
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

  const rippleMatrix = useMemo(() => new THREE.Matrix4(), [])
  const rippleScale = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, delta) => {
    const mesh = rippleMeshRef.current
    if (!mesh) return

    // A ring lives under a second: long enough to read as a splash, short
    // enough that the pool comes round again before the rain outruns it.
    const step = delta / 0.75
    let live = 0

    for (let i = 0; i < rippleCount; i += 1) {
      const age = ripples.age[i]
      if (age >= 1) {
        rippleAlpha[i] = 0
        continue
      }

      const next = age + step
      ripples.age[i] = next
      live += 1

      // Spreading out and dying away as it goes, the way a ring on water
      // loses height as the square of how far it has travelled.
      const reach = 0.05 + next * ripples.spread[i]
      rippleScale.set(reach, 1, reach)
      rippleMatrix.identity()
      rippleMatrix.setPosition(
        ripples.position[i * 3],
        ripples.position[i * 3 + 1],
        ripples.position[i * 3 + 2]
      )
      rippleMatrix.scale(rippleScale)
      mesh.setMatrixAt(i, rippleMatrix)
      rippleAlpha[i] = Math.max(0, (1 - next) * (1 - next)) * 0.75
    }

    mesh.instanceMatrix.needsUpdate = true
    mesh.geometry.attributes.aAlpha.needsUpdate = true
    mesh.count = live > 0 ? rippleCount : 0
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
      <instancedMesh
        ref={rippleMeshRef}
        args={[rippleGeometry, rippleMaterial, rippleCount]}
        frustumCulled={false}
      />
    </>
  )
}

/**
 * Falling snow that settles on whatever is beneath it.
 *
 * Two point clouds: flakes in flight, and snow already lying on a surface.
 * When a falling flake reaches the surface height for its column — roof,
 * canopy, bush or grass — its position is copied into the settled cloud and
 * the flake recycles to the top. The settled cloud is a ring buffer, so the
 * blanket builds up, holds, and slowly refreshes instead of growing forever.
 *
 * Surface heights come from a grid sampled once (utils/surfaceHeightField),
 * because raycasting thousands of flakes every frame is not affordable. The
 * grid is nearest-neighbour, so beside a tall building it can report the roof
 * height for a column that is actually open air; a short confirming raycast at
 * the moment of landing (budgeted per frame) keeps snow off thin air.
 */
const MAX_LANDING_RAYS_PER_FRAME = 8
const LANDING_RAY_REACH = 12

function SnowParticles({ performanceScale = 1 }) {
  const points = useRef()
  const clouds = useCloudField()
  const seeded = useRef(false)
  const settledPoints = useRef()
  const scene = useThree((state) => state.scene)
  const count = Math.max(900, Math.round(2600 * performanceScale))
  const settledCapacity = Math.max(600, Math.round(1600 * performanceScale))
  const heightField = useSurfaceField()
  const surfaceTarget = useRef(null)
  const landingRay = useMemo(() => new THREE.Raycaster(), [])
  const rayOrigin = useMemo(() => new THREE.Vector3(), [])
  const rayHit = useMemo(() => new THREE.Vector3(), [])

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count)
    const horizontalSpan = 80
    const verticalSpan = 45

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const reach = Math.sqrt(Math.random()) * FALL_RADIUS
      positions[i * 3] = Math.cos(angle) * reach
      positions[i * 3 + 1] = Math.random() * verticalSpan + 5
      positions[i * 3 + 2] = Math.sin(angle) * reach
      velocities[i] = Math.random() * 0.18 + 0.06
    }

    return { positions, velocities, horizontalSpan, verticalSpan }
  }, [count])

  const settled = useMemo(() => {
    const positions = new Float32Array(settledCapacity * 3)
    // Park unused slots far below the globe: until a flake lands in one, an
    // untouched slot would otherwise sit at the origin, right on the fountain.
    for (let i = 0; i < settledCapacity; i += 1) positions[i * 3 + 1] = -9999
    return { positions, next: 0, filled: 0 }
  }, [settledCapacity])

  // Nothing has landed yet, so draw nothing.
  const attachSettled = (node) => {
    settledPoints.current = node
    node?.geometry.setDrawRange(0, 0)
  }

  // The city, for the confirming raycast on a cell where the surface jumps.
  useEffect(() => {
    const timer = setTimeout(() => {
      surfaceTarget.current = scene.getObjectByName(USDZ_ROOT_NAME) || scene
    }, 1200)
    return () => clearTimeout(timer)
  }, [scene])

  /**
   * Put a flake back in the sky it came from.
   *
   * Out of a cloud where there is one, and otherwise over the old patch of
   * sky, which is what forced snow with the clouds turned off falls from.
   */
  const recycle = (positions, index) => {
    const under = sampleUnderCloud(clouds)
    if (under) {
      positions[index * 3] = under.x
      positions[index * 3 + 1] = under.y
      positions[index * 3 + 2] = under.z
      return
    }
    const angle = Math.random() * Math.PI * 2
    const reach = Math.sqrt(Math.random()) * FALL_RADIUS
    positions[index * 3] = Math.cos(angle) * reach
    positions[index * 3 + 1] = particles.verticalSpan + 5
    positions[index * 3 + 2] = Math.sin(angle) * reach
  }

  /**
   * Exact height of whatever is under this flake, or null when the column is
   * actually open air and the grid was wrong.
   */
  const confirmLanding = (x, y, z) => {
    const target = surfaceTarget.current
    if (!target || !points.current) return null

    rayOrigin.set(x, y + 0.5, z)
    points.current.localToWorld(rayOrigin)
    landingRay.set(rayOrigin, DOWN_VECTOR)
    landingRay.far = LANDING_RAY_REACH

    const hits = landingRay.intersectObject(target, true)
    if (hits.length === 0) return null

    rayHit.copy(hits[0].point)
    points.current.worldToLocal(rayHit)
    return rayHit.y
  }

  useFrame((state) => {
    if (!points.current) return

    const positions = points.current.geometry.attributes.position.array
    if (!seeded.current) seeded.current = seedUnderClouds(clouds, positions, count)
    const time = state.clock.elapsedTime
    const field = heightField.current
    let settledChanged = false
    let raysLeft = MAX_LANDING_RAYS_PER_FRAME

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] -= particles.velocities[i]
      positions[i * 3] += Math.sin(time + i) * 0.01

      if (field) {
        const gridY = field.sample(positions[i * 3], positions[i * 3 + 2])
        if (positions[i * 3 + 1] <= gridY) {
          let surfaceY = gridY

          // A ray is only worth spending where the grid is ambiguous: a roof
          // edge or a wall. Over a flat roof or open grass the sampled height
          // is already right.
          if (field.isEdge(positions[i * 3], positions[i * 3 + 2])) {
            // Out of budget this frame: keep falling and try again next frame
            // rather than risk resting on thin air beside a roof.
            if (raysLeft === 0) continue
            raysLeft -= 1
            const exactY = confirmLanding(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
            // Nothing under this flake after all — it really is open air.
            if (exactY === null) continue
            surfaceY = exactY
          }

          const slot = settled.next * 3
          settled.positions[slot] = positions[i * 3]
          // Sit just proud of the surface so the flake is not z-fought away.
          settled.positions[slot + 1] = surfaceY + 0.06
          settled.positions[slot + 2] = positions[i * 3 + 2]
          settled.next = (settled.next + 1) % settledCapacity
          settled.filled = Math.min(settled.filled + 1, settledCapacity)
          settledChanged = true
          recycle(positions, i)
          continue
        }
      }

      // Out through the side rather than the bottom: a flake sways as it
      // falls, and a long enough fall in a steady sway carries it into the
      // glass. Put it back under a cloud.
      if (
        positions[i * 3 + 1] < -5 ||
        !insideGlass(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
      ) {
        recycle(positions, i)
      }
    }

    points.current.geometry.attributes.position.needsUpdate = true

    if (settledChanged && settledPoints.current) {
      settledPoints.current.geometry.attributes.position.needsUpdate = true
      settledPoints.current.geometry.setDrawRange(0, settled.filled)
    }
  })

  return (
    <group>
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

      {/* Snow already lying on something: larger and brighter than a flake in
          flight, so a covered roof reads as a patch rather than a speck. */}
      <points ref={attachSettled} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={settledCapacity}
            array={settled.positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial size={0.52} color="#FFFFFF" opacity={0.95} transparent sizeAttenuation />
      </points>
    </group>
  )
}

function ThunderboltParticles({ performanceScale = 1 }) {
  const field = useCloudField()
  const seeded = useRef(false)
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
      const angle = Math.random() * Math.PI * 2
      const reach = Math.sqrt(Math.random()) * FALL_RADIUS
      positions[i * 3] = Math.cos(angle) * reach
      positions[i * 3 + 1] = Math.random() * verticalSpan + baseHeight
      positions[i * 3 + 2] = Math.sin(angle) * reach
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
    if (!seeded.current) {
      // Below the cloud that throws it, not the ground: a bolt lives in the
      // few units under a cloud and vanishes well before it lands.
      seeded.current = seedUnderClouds(field, positions, count, { floor: vanishThreshold })
    }
    const time = state.clock.elapsedTime
    const color = new THREE.Color()
    
    for (let i = 0; i < count; i++) {
      intensities[i] = Math.max(0, intensities[i] - delta * 0.23)
      
      positions[i * 3 + 1] -= velocities[i]
      
      if (positions[i * 3 + 1] < vanishThreshold) {
        // Out of a cloud. A bolt that starts in clear sky is a flare.
        const from = sampleUnderCloud(field)
        const angle = Math.random() * Math.PI * 2
        const reach = Math.sqrt(Math.random()) * FALL_RADIUS
        positions[i * 3] = from ? from.x : Math.cos(angle) * reach
        positions[i * 3 + 1] = from ? from.y : verticalSpan + baseHeight
        positions[i * 3 + 2] = from ? from.z : Math.sin(angle) * reach
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

  // White unless something is falling out of them. Rain and thunder darken the
  // cloud, snow only dulls it slightly.
  const cloudTone = useMemo(() => {
    const condition = `${weatherType || ''} ${weatherData?.weather?.[0]?.description || ''}`.toLowerCase()
    if (condition.includes('thunder') || condition.includes('storm')) return '#5f6674'
    if (condition.includes('rain') || condition.includes('drizzle')) return '#949cab'
    if (condition.includes('snow') || condition.includes('sleet')) return '#c8cedb'
    return '#ffffff'
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
    // Over the city, not a ring around the edge of the sky. They used to be
    // placed at a radius of forty-odd, which put every cloud out by the glass
    // with nothing above the city; now that the rain comes out of them, a
    // cloud out there is a column of rain falling past the ornament. So they
    // are kept over the ground the rain is allowed to land on.
    const spread = FALL_RADIUS * 0.82
    // Raise clouds higher when raining to be above rain particles (rain is at y=25-50)
    const isRaining = weatherType.includes('rain') || weatherType.includes('drizzle')
    const minHeight = isRaining ? 35 : 28
    const heightJitter = 10
    return Array.from({ length: cloudCount }).map((_, index) => {
      const angle = (index / cloudCount) * Math.PI * 2 + Math.random() * 0.4
      // Rooted, so they spread evenly across the disc rather than crowding
      // its rim.
      const radius = Math.sqrt(Math.random()) * spread
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
  const field = useCloudField()

  useFrame((state, delta) => {
    const step = Math.min(delta, MAX_FRAME_SECONDS)
    const moveX = driftVector.x * step * 12
    const moveZ = driftVector.z * step * 12
    const wrapRadius = 52
    const time = state.clock.elapsedTime

    cloudRefs.forEach((ref, index) => {
      const cloud = ref.current
      if (!cloud) return

      const config = cloudConfigs[index]
      // Per-cloud drift is a speed, so it is scaled by the frame like the
      // wind is. Added raw, it ran three times faster at 60fps than at 20.
      cloud.position.x += moveX + config.speed * step * 1.8
      cloud.position.z += moveZ
      // An offset from the height the cloud was placed at, not an addition to
      // wherever it has drifted to: `+=` integrated the sine and let clouds
      // wander several units up or down over a minute.
      cloud.position.y = config.position[1] + Math.sin(time * 0.25 + index) * 0.8

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

      cloud.position.x = wrapCoordinate(cloud.position.x, wrapRadius)
      cloud.position.z = wrapCoordinate(cloud.position.z, wrapRadius)

      // Where this one is now, for whatever is falling out of it.
      publishCloud(field, index, cloud, config.scale)
    })

    if (field) field.clouds.length = cloudRefs.length
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
            <meshStandardMaterial color={cloudTone} roughness={1} metalness={0} />
          </Icosahedron>
          {cloud.puffs.map((puff) => (
            <group key={puff.key} position={puff.offset} scale={puff.scale}>
              <Sphere args={[0.6, 16, 16]}>
                <meshStandardMaterial color={cloudTone} roughness={1} metalness={0} />
              </Sphere>
              <Icosahedron args={[0.45, 1]}>
                <meshStandardMaterial color={cloudTone} roughness={1} metalness={0} />
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
    const step = Math.min(delta, MAX_FRAME_SECONDS)
    starRef.current.position.x += driftVector.x * step * 10 + speed * step * 1.2
    starRef.current.position.z += driftVector.z * step * 10
    const time = state.clock.elapsedTime
    const twinkle = 0.25 + Math.sin(time * twinkleSpeed + twinklePhase) * 0.18
    const scaleValue = baseScale + twinkle
    starRef.current.scale.set(scaleValue, scaleValue, scaleValue)
    starRef.current.rotation.z += delta * 0.35

    starRef.current.position.x = wrapCoordinate(starRef.current.position.x, wrapRadius)
    starRef.current.position.z = wrapCoordinate(starRef.current.position.z, wrapRadius)
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

/**
 * One map of what is underneath, for everything that lands on it.
 *
 * Built against an anchor of its own, so the heights are measured in the same
 * space the falling things live in, and only while something is actually
 * falling: it is two thousand raycasts against the whole city, and a clear
 * day has no use for it.
 */
function SurfaceFieldProvider({ active, children }) {
  const anchor = useRef()
  const field = useBuiltSurfaceField({
    anchor,
    span: SURFACE_SPAN,
    resolution: SURFACE_RESOLUTION
  })

  return (
    <SurfaceFieldContext.Provider value={active ? field : null}>
      <group ref={anchor} />
      {children}
    </SurfaceFieldContext.Provider>
  )
}

SurfaceFieldProvider.propTypes = {
  active: PropTypes.bool,
  children: PropTypes.node
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

  // Where the clouds are, written by the cloud layer every frame and read by
  // everything that falls out of them.
  // Nothing may fall outside the glass, and the glass is at its narrowest
  // down where the rain lands rather than up where it starts.
  const cloudField = useMemo(() => createCloudField(FALL_RADIUS), [])

  // A dev aid: lets a test ask what the sky is doing without reaching into
  // the scene graph for it.
  useEffect(() => {
    if (import.meta.env.DEV) window.__cloudField = cloudField
  }, [cloudField])

  useEffect(() => {
    if (!shakeTrigger) return
    // Timed from the trigger stamp, not from now: the scene remounts on every
    // App render, and restarting the tumble on an unchanged trigger is what
    // made the globe spin at random long after the button was pressed.
    if (Date.now() - shakeTrigger >= SHAKE_TUMBLE_DURATION) return
    shakeStateRef.current = {
      active: true,
      start: shakeTrigger,
      duration: SHAKE_TUMBLE_DURATION
    }
  }, [shakeTrigger])

  useFrame((state, delta) => {
    const group = shakeGroupRef.current
    const shakeState = shakeStateRef.current
    if (!group || !shakeState.active) return
    const elapsed = Date.now() - shakeState.start
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
    <CloudFieldContext.Provider value={cloudField}>
      <SurfaceFieldProvider active={hasRain || forceRain || hasSnow || forceSnow}>
        {/* Not a surface: the map of what is underneath has to be built
            without the weather in it, or the rain lands on itself. */}
        <group ref={shakeGroupRef} userData={{ transient: true }}>
          {(hasRain || forceRain) && <RainParticles performanceScale={performanceScale} />}
          {(hasSnow || forceSnow) && <SnowParticles performanceScale={performanceScale} />}
          {hasCuteClouds && (
            <CloudLayer
              weatherType={weatherType}
              windDirection={windDirection}
              windSpeed={windSpeed}
              weatherData={weatherData}
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
      </SurfaceFieldProvider>
    </CloudFieldContext.Provider>
  )
}

export default WeatherEffects
