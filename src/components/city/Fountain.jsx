import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import PropTypes from 'prop-types'
import * as THREE from 'three'
import {
  WATER_HEIGHT_GLSL,
  createJetStreakMaps,
  createWaterNormalMap,
  jetArc,
  taperTube
} from '../../utils/waterSurface'

/**
 * The fountain, and the water in it.
 *
 * Three things were making the water read as plastic rather than water, and
 * each one is a different fix:
 *
 *  - The pools pulsed their opacity. A surface that fades in and out reads as
 *    a flicker; what reads as water is light crawling across a surface that
 *    is not flat. So the pools now carry a scrolling normal map instead, and
 *    hold a constant opacity.
 *  - The jets were vertical cones scaled on Y. Water thrown out of a nozzle
 *    is a thrown object and follows a parabola, so the jets are now tubes
 *    swept along one, fading out as they fall.
 *  - Every ripple started dead centre. They now start where the jets actually
 *    land.
 *
 * And then the ripples themselves. They were rings of geometry expanding over
 * a flat disc: a ring on a pond rather than a pond with rings in it. The pool
 * is now a mesh whose vertices are displaced by crossing swells and by a wave
 * train running out from each place a jet comes down, with the normals worked
 * out from the same height field so the light bends where the water does.
 * The scrolling normal map stays on top of it for the chop too fine to be
 * worth a vertex.
 */

// One map, shared by every pool in every fountain. It is 256px of canvas and
// there is no reason to build it per basin.
let sharedNormalMap = null
const getWaterNormalMap = () => {
  if (!sharedNormalMap) sharedNormalMap = createWaterNormalMap({ strength: 1.6, repeat: 1.5 })
  return sharedNormalMap
}

/** Ribs and beads along a jet. One set, shared by every jet in the park. */
let sharedJetStreaks = null
const getJetStreaks = () => {
  if (!sharedJetStreaks) sharedJetStreaks = createJetStreakMaps({ strength: 1.5 })
  return sharedJetStreaks
}

/** A jet fades as it falls, so the tube is masked along its own length. */
let sharedJetFade = null
const getJetFade = () => {
  if (!sharedJetFade) {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 1
    const context = canvas.getContext('2d')
    const gradient = context.createLinearGradient(0, 0, 64, 0)
    // Solid at the nozzle, thinning as it goes, gone before it lands: real
    // water has broken into droplets by then and a tube that arrives intact
    // looks like a wire.
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.72)')
    gradient.addColorStop(0.85, 'rgba(255,255,255,0.22)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 64, 1)
    sharedJetFade = new THREE.CanvasTexture(canvas)
    sharedJetFade.wrapS = THREE.ClampToEdgeWrapping
    sharedJetFade.wrapT = THREE.ClampToEdgeWrapping
  }
  return sharedJetFade
}

/**
 * A pool with waves in it.
 *
 * The surface is a disc of vertices displaced in the vertex shader, which is
 * both the cheap way and the one that gets the light right: the normals come
 * from the slope of the same height field, so a crest catches the sun and a
 * trough does not. Everything else about the material is left to
 * MeshPhysicalMaterial, which is why this hooks into its shader rather than
 * replacing it: a hand-written water shader would have to re-earn the
 * clearcoat, the fog and the tone mapping it already has.
 *
 * `impacts` are the places a jet comes down, in the pool's own coordinates.
 */
function WaterSurface({
  position,
  radius,
  color = '#3fb8dd',
  opacity = 0.82,
  drift = 1,
  impacts = [],
  amplitude = 0.03
}) {
  const normalMap = useMemo(() => getWaterNormalMap().clone(), [])

  // At least one, because a shader cannot declare an array of none.
  const ripples = useMemo(() => {
    const points = impacts.length > 0 ? impacts : [[0, 0, 0]]
    return points.map(([x, z, strength]) => new THREE.Vector3(x, z, strength))
  }, [impacts])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmplitude: { value: amplitude },
      uRipples: { value: ripples }
    }),
    [ripples, amplitude]
  )

  const onBeforeCompile = useMemo(
    () => (shader) => {
      shader.uniforms.uTime = uniforms.uTime
      shader.uniforms.uAmplitude = uniforms.uAmplitude
      shader.uniforms.uRipples = uniforms.uRipples

      const header = `
        uniform float uTime;
        uniform float uAmplitude;
        #define RIPPLE_COUNT ${ripples.length}
        uniform vec3 uRipples[RIPPLE_COUNT];
        ${WATER_HEIGHT_GLSL}
      `

      shader.vertexShader = header + shader.vertexShader

      // The disc is built in XY and laid flat by the mesh, so the surface
      // rises along the local z.
      shader.vertexShader = shader.vertexShader.replace(
        '#include <beginnormal_vertex>',
        `
        float eps = 0.06;
        float hx = waterHeight(position.xy + vec2(eps, 0.0)) - waterHeight(position.xy - vec2(eps, 0.0));
        float hy = waterHeight(position.xy + vec2(0.0, eps)) - waterHeight(position.xy - vec2(0.0, eps));
        vec3 objectNormal = normalize(vec3(-hx / (2.0 * eps), -hy / (2.0 * eps), 1.0));
        `
      )

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        vec3 transformed = vec3(position);
        transformed.z += waterHeight(position.xy);
        `
      )
    },
    [uniforms, ripples.length]
  )

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    uniforms.uTime.value = time * drift
    normalMap.offset.set(time * 0.013 * drift, time * 0.009 * drift)
    normalMap.rotation = Math.sin(time * 0.06) * 0.25
    normalMap.needsUpdate = true
  })

  // A ring from nothing to the full radius, rather than a circle: a circle is
  // a fan of triangles meeting in the middle, with every vertex out at the
  // rim and nothing in between to raise into a wave.
  //
  // No receiveShadow. A flat disc facing a shadow-casting sun bands with acne
  // across its whole surface, and a pool of water has nothing useful to catch
  // anyway.
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius * 0.0001, radius, 72, 20]} />
      <meshPhysicalMaterial
        color={color}
        transparent
        opacity={opacity}
        roughness={0.12}
        metalness={0}
        normalMap={normalMap}
        normalScale={new THREE.Vector2(0.35, 0.35)}
        clearcoat={1}
        clearcoatRoughness={0.06}
        ior={1.33}
        side={THREE.DoubleSide}
        onBeforeCompile={onBeforeCompile}
        customProgramCacheKey={() => `water-${ripples.length}`}
        // No transmission. It costs a whole extra render pass per material,
        // and against a dark basin floor at this size it buys nothing an
        // opacity cannot.
      />
    </mesh>
  )
}

WaterSurface.propTypes = {
  position: PropTypes.arrayOf(PropTypes.number).isRequired,
  radius: PropTypes.number.isRequired,
  color: PropTypes.string,
  opacity: PropTypes.number,
  drift: PropTypes.number,
  impacts: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)),
  amplitude: PropTypes.number
}

/**
 * A jet of water, swept along the arc it would actually take.
 *
 * @param {Object} props
 * @param {number[]} props.position - The nozzle.
 * @param {number} props.angle - Which way it points, around Y.
 * @param {number} props.speed - Outward speed at the nozzle.
 * @param {number} props.rise - Upward speed at the nozzle.
 * @param {number} props.landingY - Drop to the water it feeds, negative.
 */
function WaterJet({ position, angle = 0, speed = 0.8, rise = 2.2, landingY = -1, radius = 0.03, idx = 0 }) {
  const groupRef = useRef()
  const fade = useMemo(() => getJetFade(), [])

  const streaks = useMemo(() => getJetStreaks(), [])
  const maps = useMemo(() => {
    const normalMap = streaks.normalMap.clone()
    const roughnessMap = streaks.roughnessMap.clone()
    // u runs along the jet, v around it. Repeating along its length is what
    // keeps the ribs the same size whether the jet is long or short.
    normalMap.repeat.set(5, 1)
    roughnessMap.repeat.set(5, 1)
    normalMap.needsUpdate = true
    roughnessMap.needsUpdate = true
    return { normalMap, roughnessMap }
  }, [streaks])

  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(jetArc({ speed, rise, landingY }))
    const tube = new THREE.TubeGeometry(curve, 24, radius, 8, false)
    // Full at the nozzle, coming apart by the time it lands.
    return taperTube(tube, curve, { tip: 0.42, beat: 0.16 })
  }, [speed, rise, landingY, radius])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    // Mains pressure is never quite steady, so the jet leans a little.
    const time = clock.getElapsedTime()
    groupRef.current.rotation.z = Math.sin(time * 1.6 + idx * 1.1) * 0.035
    groupRef.current.scale.setScalar(1 + Math.sin(time * 2.3 + idx * 0.7) * 0.03)

    // The water moves along the jet even where the jet does not move. This is
    // the whole difference between a stream and a glass rod.
    const run = -(time * 1.15 + idx * 0.31) % 1
    maps.normalMap.offset.set(run, 0)
    maps.roughnessMap.offset.set(run, 0)
  })

  return (
    <group position={position} rotation={[0, angle, 0]}>
      <group ref={groupRef}>
        <mesh geometry={geometry}>
          <meshPhysicalMaterial
            color="#e4f8ff"
            transparent
            opacity={0.78}
            alphaMap={fade}
            normalMap={maps.normalMap}
            normalScale={new THREE.Vector2(1, 1)}
            roughnessMap={maps.roughnessMap}
            roughness={0.38}
            metalness={0}
            clearcoat={1}
            clearcoatRoughness={0.08}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  )
}

WaterJet.propTypes = {
  position: PropTypes.arrayOf(PropTypes.number).isRequired,
  angle: PropTypes.number,
  speed: PropTypes.number,
  rise: PropTypes.number,
  landingY: PropTypes.number,
  radius: PropTypes.number,
  idx: PropTypes.number
}

/**
 * The three pools: where the surface sits, what it is standing on, and how big
 * a swell it carries.
 *
 * Together rather than scattered through the markup, because the three numbers
 * have to be read against each other. Waves cut down as well as up, and a pool
 * whose trough reaches its own floor shows the floor: the basin spent a while
 * with brown patches drifting across it for exactly that reason. Whatever is
 * under a pool has to sit further below it than the waves are tall.
 */
export const POOLS = {
  basin: { water: 0.33, floor: 0.26, radius: 2.54, amplitude: 0.045 },
  middle: { water: 1.185, floor: 1.15, radius: 1.22, amplitude: 0.016 },
  upper: { water: 1.89, floor: 1.87, radius: 0.58, amplitude: 0.012 }
}

/**
 * How much room a pool needs under it, as a multiple of its own swell.
 *
 * More than one, because the swells and a ripple train can line up, and a
 * trough that only just clears is a trough that breaks through on the frame
 * where they do.
 */
export const POOL_CLEARANCE = 1.5

/** The two sets of jets, in one place: the shape of each arc and where it starts. */
const CROWN_JET = {
  from: 2.36,
  speed: 0.95,
  rise: 1.15,
  lands: POOLS.upper.water,
  radius: 0.035
}
const OUTER_JET = {
  from: 1.2,
  ring: 1.05,
  speed: 1.55,
  rise: 0.72,
  lands: POOLS.basin.water,
  radius: 0.042
}

/** How far out a jet of this shape comes down, from where it left. */
function reachOf({ from, speed, rise, lands }) {
  const arc = jetArc({ speed, rise, landingY: lands - from })
  return arc[arc.length - 1].x
}

function Fountain() {
  // Where the outer ring of jets leaves the middle tier, and where it comes
  // down in the basin. The second is what the basin's waves run out from.
  const outerJets = useMemo(
    () =>
      [0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2
        return { angle, x: Math.cos(angle) * 1.05, z: Math.sin(angle) * 1.05 }
      }),
    []
  )

  // A pool's coordinates are its own: the disc is built in XY and laid flat,
  // so a point on it is [x, z] of the fountain read as [x, y] of the disc,
  // with how hard the water is hit as the third number. Where each arc comes
  // down is solved from the arc itself rather than guessed, so moving a jet
  // moves the waves it makes.
  const basinImpacts = useMemo(() => {
    const landing = OUTER_JET.ring + reachOf(OUTER_JET)
    return [
      ...outerJets.map((jet) => [
        Math.cos(jet.angle) * landing,
        Math.sin(jet.angle) * landing,
        1
      ]),
      // What runs down the stem, which arrives in the middle.
      [0, 0, 0.5]
    ]
  }, [outerJets])

  // The middle pool is fed over the rim of the one above it: a ring of spill
  // rather than a jet, so it is softer and there is more of it.
  const middleImpacts = useMemo(
    () =>
      [0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2 + 0.3
        return [Math.cos(angle) * 0.34, Math.sin(angle) * 0.34, 0.6]
      }),
    []
  )

  // The eight crown jets come down as a ring in the top pool.
  const upperImpacts = useMemo(() => {
    const landing = reachOf(CROWN_JET)
    return [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const angle = (i / 8) * Math.PI * 2
      return [Math.cos(angle) * landing, Math.sin(angle) * landing, 0.9]
    })
  }, [])

  return (
    <group>
      {/* Outer basin.
          The wall is open ended and capped by a ring. A plain cylinder caps
          itself across the whole disc, so its lid sat over the entire pool:
          either coplanar with the water and fighting it for every pixel, or
          hiding it completely. A basin wall is an annulus, so that is what it
          is built from. */}
      <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.55, 2.8, 0.36, 32, 1, true]} />
        <meshStandardMaterial
          color="#9a8a76"
          roughness={0.82}
          metalness={0.12}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* The rim itself */}
      <mesh position={[0, 0.36, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[2.55, 2.62, 32]} />
        <meshStandardMaterial color="#a8987f" roughness={0.8} metalness={0.12} side={THREE.DoubleSide} />
      </mesh>
      {/* The basin floor, its top at the level POOLS says it is, which is far
          enough below the water that a trough cannot reach it. Waves cut both
          ways: with its top at 0.30 the floor came up through the surface
          everywhere the water was low, which read as mud banks. It takes no
          shadows either, because under a moving surface the hard edge of a
          tree's shadow reads as something lying on the bottom. */}
      <mesh position={[0, POOLS.basin.floor - 0.06, 0]}>
        <cylinderGeometry args={[2.52, 2.52, 0.12, 32]} />
        <meshStandardMaterial color="#5d4b3e" roughness={0.9} metalness={0.06} />
      </mesh>
      {/* The water sits below the rim, not level with it. The wall is a
          cylinder centred at 0.18 with a height of 0.36, so its top lands
          exactly on 0.36, and water at the same height fought it for every
          pixel across the whole pool. */}
      <WaterSurface
        position={[0, POOLS.basin.water, 0]}
        radius={POOLS.basin.radius}
        color="#2f9dc4"
        opacity={0.86}
        impacts={basinImpacts}
        amplitude={POOLS.basin.amplitude}
      />

      {/* Central stem */}
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.24, 0.36, 0.6, 16]} />
        <meshStandardMaterial color="#bfaf9a" roughness={0.72} metalness={0.14} />
      </mesh>

      {/* Middle tier */}
      <mesh position={[0, 1.04, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.28, 1.48, 0.22, 24]} />
        <meshStandardMaterial color="#b0a08a" roughness={0.78} metalness={0.1} />
      </mesh>
      {/* A touch above the plate it sits on, and with a smaller swell: these
          two pools are shallow dishes, and a wave that would read on the
          basin would break the surface here. */}
      <WaterSurface
        position={[0, POOLS.middle.water, 0]}
        radius={POOLS.middle.radius}
        color="#43b5d8"
        opacity={0.8}
        drift={1.5}
        impacts={middleImpacts}
        amplitude={POOLS.middle.amplitude}
      />

      <mesh position={[0, 1.48, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.14, 0.22, 0.52, 12]} />
        <meshStandardMaterial color="#c8b89e" roughness={0.7} metalness={0.14} />
      </mesh>

      {/* Upper tier */}
      <mesh position={[0, 1.77, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.64, 0.78, 0.2, 18]} />
        <meshStandardMaterial color="#d4c4ac" roughness={0.72} metalness={0.1} />
      </mesh>
      <WaterSurface
        position={[0, POOLS.upper.water, 0]}
        radius={POOLS.upper.radius}
        color="#57c8ea"
        opacity={0.78}
        drift={2.2}
        impacts={upperImpacts}
        amplitude={POOLS.upper.amplitude}
      />

      <mesh position={[0, 2.12, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.07, 0.13, 0.46, 10]} />
        <meshStandardMaterial color="#ddd0b8" roughness={0.65} metalness={0.15} />
      </mesh>

      {/* The crown: eight jets thrown outward from the top, falling to the
          upper pool. */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <WaterJet
          key={`crown-${i}`}
          position={[0, CROWN_JET.from, 0]}
          angle={(i / 8) * Math.PI * 2}
          speed={CROWN_JET.speed}
          rise={CROWN_JET.rise}
          landingY={CROWN_JET.lands - CROWN_JET.from}
          radius={CROWN_JET.radius}
          idx={i}
        />
      ))}

      {/* Middle tier throws out to the big pool below */}
      {outerJets.map((jet, i) => (
        <WaterJet
          key={`outer-${i}`}
          // Above the tier's lip, not under it. At 1.06 the nozzle sat below
          // the pool it draws from and the arc only appeared halfway down.
          position={[jet.x, OUTER_JET.from, jet.z]}
          angle={jet.angle}
          speed={OUTER_JET.speed}
          rise={OUTER_JET.rise}
          landingY={OUTER_JET.lands - OUTER_JET.from}
          radius={OUTER_JET.radius}
          idx={i + 8}
        />
      ))}

      {/* Finial */}
      <mesh position={[0, 2.5, 0]} castShadow>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial
          color="#fff2c0"
          emissive="#ffd060"
          emissiveIntensity={1.6}
          roughness={0.12}
          metalness={0.08}
        />
      </mesh>

      <pointLight position={[0, 0.5, 0]} intensity={0.9} distance={4.5} color="#40c8ff" decay={2} />
      <pointLight position={[0, 2.3, 0]} intensity={0.5} distance={3} color="#a8e8ff" decay={2} />
    </group>
  )
}

export default Fountain
