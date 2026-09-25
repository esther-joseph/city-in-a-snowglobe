import React, { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import PropTypes from 'prop-types'
import * as THREE from 'three'
import { Water } from 'three/examples/jsm/objects/Water.js'
import {
  WATER_HEIGHT_GLSL,
  createFallingSheetMaps,
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

/** The curtain that comes over each rim. One set, shared by all of them. */
let sharedSheet = null
const getSheetMaps = () => {
  if (!sharedSheet) sharedSheet = createFallingSheetMaps({ strength: 1.2 })
  return sharedSheet
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
 * The swell, as uniforms and a shader header.
 *
 * Both kinds of pool below displace their surface with the same height field:
 * crossing swells, a wave train from every point water lands, and a ring for
 * water coming over a rim. Only the material underneath them differs, so the
 * waves are built once here and patched into whichever shader is in use.
 */
function useWaveShader({ impacts, ring, amplitude }) {
  // At least one, because a shader cannot declare an array of none.
  const ripples = useMemo(() => {
    const points = impacts.length > 0 ? impacts : [[0, 0, 0]]
    return points.map(([x, z, strength]) => new THREE.Vector3(x, z, strength))
  }, [impacts])

  return useMemo(() => {
    const uniforms = {
      uTime: { value: 0 },
      uAmplitude: { value: amplitude },
      uRipples: { value: ripples },
      uRing: { value: new THREE.Vector2(ring[0], ring[1]) }
    }

    const header = `
      uniform float uTime;
      uniform float uAmplitude;
      uniform vec2 uRing;
      #define RIPPLE_COUNT ${ripples.length}
      uniform vec3 uRipples[RIPPLE_COUNT];
      ${WATER_HEIGHT_GLSL}
    `

    return { uniforms, header, count: ripples.length }
  }, [ripples, ring, amplitude])
}

/**
 * A ring from nothing to the full radius, rather than a circle.
 *
 * A circle is a fan of triangles meeting in the middle, with every vertex out
 * at the rim and nothing in between to raise into a wave.
 */
const poolGeometry = (radius) => new THREE.RingGeometry(radius * 0.0001, radius, 72, 20)

/**
 * The pool that reflects.
 *
 * Built on three.js's own Water, which is the flat mirror trick: the scene is
 * rendered again from under the surface into a small target, and the shader
 * reads it back through a scrolling normal map with a sun specular on top.
 * That is what gives a pool the one thing a lit material cannot fake, which
 * is the sky and the skyline standing in it.
 *
 * Two things are added to it. The surface is displaced, which Water does not
 * do: its plane stays flat and all the movement is in the normals. The height
 * field is patched into Water's own vertex shader rather than replacing it,
 * so the reflection bends with the waves instead of sliding over them. And
 * the material is told to blend, because Water writes an alpha at the end of
 * its fragment shader and then leaves the material opaque.
 *
 * It costs a second render of the scene every frame, which is why only the
 * basin gets one and why it takes it every other frame.
 *
 * WaterMesh, the other one in the docs, is the WebGPU rewrite: it is written
 * in TSL and needs a WebGPURenderer. This scene draws through WebGL.
 */
function ReflectingPool({ radius, color, alpha, drift, waves, resolution, isNight }) {
  const { scene } = useThree()
  const normalMap = useMemo(() => getWaterNormalMap().clone(), [])

  const water = useMemo(() => {
    const instance = new Water(poolGeometry(radius), {
      textureWidth: resolution,
      textureHeight: resolution,
      waterNormals: normalMap,
      // Low. The default is written for an ocean, where the surface is metres
      // from the eye; across two and a half of these it smears the reflection
      // into noise.
      distortionScale: 2.6,
      alpha,
      waterColor: new THREE.Color(color),
      sunColor: new THREE.Color(isNight ? '#8fb8d8' : '#ffffff'),
      sunDirection: new THREE.Vector3(0.3, 0.9, 0.2).normalize(),
      fog: Boolean(scene.fog)
    })

    instance.material.transparent = true
    instance.material.depthWrite = false
    Object.assign(instance.material.uniforms, waves.uniforms)

    // The disc is built in XY and laid flat by the mesh, so the surface rises
    // along the local z. Both places Water reads `position` have to see the
    // displaced one, or the reflection lands where the water is not.
    instance.material.vertexShader = instance.material.vertexShader
      .replace(
        'void main() {',
        `${waves.header}\n void main() {\n vec3 swell = vec3(position);\n swell.z += waterHeight(position.xy);`
      )
      .replace(
        'mirrorCoord = modelMatrix * vec4( position, 1.0 );',
        'mirrorCoord = modelMatrix * vec4( swell, 1.0 );'
      )
      .replace(
        'vec4 mvPosition =  modelViewMatrix * vec4( position, 1.0 );',
        'vec4 mvPosition = modelViewMatrix * vec4( swell, 1.0 );'
      )

    // What the reflection is allowed to cost.
    //
    // Two things, and the second one is the whole difference between this
    // being usable and not. Every other frame, because a reflection of a
    // scene that has barely moved is worth half the frames it costs. And in
    // silhouette: the scene is handed an override material for the
    // reflection pass, so the second render compiles one shader instead of
    // one per mesh.
    //
    // That is not a micro-optimisation. This city is built mesh by mesh and
    // every one of them carries its own material — four and a half thousand
    // of them — and a render into a target needs a program variant for each,
    // because tone mapping applies to the canvas and not to the target.
    // Rendering the real scene into the pool cost nine seconds of shader
    // compilation on first paint, which is most of a loading screen.
    //
    // What comes back is the sky, with everything standing in it as a dark
    // mass. Which, in a pool this size, is what a reflection looks like.
    const silhouette = new THREE.MeshBasicMaterial({
      color: isNight ? '#0f1726' : '#6d8298',
      fog: Boolean(scene.fog)
    })

    const reflect = instance.onBeforeRender
    let frame = 0
    instance.onBeforeRender = (renderer, sceneToRender, camera) => {
      frame += 1
      if (frame % 2 === 0) return
      const previous = sceneToRender.overrideMaterial
      sceneToRender.overrideMaterial = silhouette
      reflect(renderer, sceneToRender, camera)
      sceneToRender.overrideMaterial = previous
    }

    return instance
  }, [radius, resolution, normalMap, alpha, color, isNight, waves, scene.fog])

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime()
    // Water's own clock drives the normal map; ours drives the swell.
    water.material.uniforms.time.value = elapsed * 0.35 * drift
    waves.uniforms.uTime.value = elapsed * drift
  })

  return <primitive object={water} rotation={[-Math.PI / 2, 0, 0]} />
}

/**
 * The pools that do not reflect.
 *
 * The two dishes are a fifth of the basin's width and are seen from above,
 * where there is nothing overhead to reflect but sky. They carry the same
 * waves over a physical material instead, which costs nothing beyond the
 * vertices: lit, clearcoated, translucent, with the scrolling normal map for
 * the chop too fine to be worth a vertex.
 */
function PlainPool({ radius, color, alpha, drift, waves }) {
  const normalMap = useMemo(() => getWaterNormalMap().clone(), [])

  const onBeforeCompile = useMemo(
    () => (shader) => {
      Object.assign(shader.uniforms, waves.uniforms)
      shader.vertexShader = waves.header + shader.vertexShader

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
    [waves]
  )

  const geometry = useMemo(() => poolGeometry(radius), [radius])

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime()
    waves.uniforms.uTime.value = elapsed * drift
    normalMap.offset.set(elapsed * 0.013 * drift, elapsed * 0.009 * drift)
    normalMap.rotation = Math.sin(elapsed * 0.06) * 0.25
  })

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshPhysicalMaterial
        color={color}
        transparent
        opacity={alpha}
        roughness={0.12}
        metalness={0}
        normalMap={normalMap}
        normalScale={new THREE.Vector2(0.35, 0.35)}
        clearcoat={1}
        clearcoatRoughness={0.06}
        ior={1.33}
        side={THREE.DoubleSide}
        depthWrite={false}
        onBeforeCompile={onBeforeCompile}
        customProgramCacheKey={() => `pool-${waves.count}`}
      />
    </mesh>
  )
}

const poolShape = {
  radius: PropTypes.number.isRequired,
  color: PropTypes.string,
  alpha: PropTypes.number,
  drift: PropTypes.number,
  waves: PropTypes.object.isRequired
}

ReflectingPool.propTypes = { ...poolShape, resolution: PropTypes.number, isNight: PropTypes.bool }
PlainPool.propTypes = poolShape

/**
 * A pool of water, reflecting or not.
 *
 * No receiveShadow either way: a flat disc facing a shadow-casting sun bands
 * with acne across its whole surface, and a pool has nothing useful to catch.
 */
function WaterSurface({
  position,
  radius,
  color = '#2f9dc4',
  alpha = 0.84,
  drift = 1,
  impacts = [],
  ring = [0, 0],
  amplitude = 0.03,
  reflects = false,
  resolution = 256,
  isNight = false
}) {
  const waves = useWaveShader({ impacts, ring, amplitude })

  return (
    <group position={position}>
      {reflects ? (
        <ReflectingPool
          radius={radius}
          color={color}
          alpha={alpha}
          drift={drift}
          waves={waves}
          resolution={resolution}
          isNight={isNight}
        />
      ) : (
        <PlainPool radius={radius} color={color} alpha={alpha} drift={drift} waves={waves} />
      )}
    </group>
  )
}

WaterSurface.propTypes = {
  position: PropTypes.arrayOf(PropTypes.number).isRequired,
  radius: PropTypes.number.isRequired,
  color: PropTypes.string,
  alpha: PropTypes.number,
  drift: PropTypes.number,
  impacts: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)),
  ring: PropTypes.arrayOf(PropTypes.number),
  amplitude: PropTypes.number,
  reflects: PropTypes.bool,
  resolution: PropTypes.number,
  isNight: PropTypes.bool
}

/**
 * The sheet of water coming over a rim.
 *
 * A tier of a fountain does not throw water at the one below it, it overflows
 * into it: the bowl fills, the water goes over the edge the whole way round,
 * and comes down as a curtain that thins and breaks as it falls. Six jets
 * around a circle were six jets around a circle.
 *
 * An open cylinder, flaring outward as it falls because water leaving a lip
 * keeps going the way it was going. What sells it is the scrolling, not the
 * mesh: the texture runs down the sheet, opening holes in it lower down.
 */
function Overflow({ from, to, topRadius, bottomRadius, color = '#d6f2ff' }) {
  const maps = useMemo(() => {
    const sheet = getSheetMaps()
    const normalMap = sheet.normalMap.clone()
    const alphaMap = sheet.alphaMap.clone()
    // Around the curtain, so the ribs stay the same width on a wide rim as
    // on a narrow one.
    const repeat = Math.max(3, Math.round(topRadius * 3.2))
    // And twice down it, so the streaks stay short enough to read as water
    // running rather than as long glass flutes.
    normalMap.repeat.set(repeat, 2)
    alphaMap.repeat.set(repeat, 2)
    normalMap.needsUpdate = true
    alphaMap.needsUpdate = true
    return { normalMap, alphaMap }
  }, [topRadius])

  useFrame(({ clock }) => {
    // Down, and faster than the eye can follow a single feature, which is
    // what stops a repeating texture reading as a repeat.
    const run = (clock.getElapsedTime() * 1.6) % 1
    maps.normalMap.offset.set(0, run)
    maps.alphaMap.offset.set(0, run)
  })

  const height = from - to

  return (
    <mesh position={[0, to + height / 2, 0]}>
      <cylinderGeometry args={[topRadius, bottomRadius, height, 36, 1, true]} />
      <meshPhysicalMaterial
        color={color}
        transparent
        // Thin. A falling sheet is mostly the thing behind it; at anything
        // like a glass opacity the curtain reads as a cylinder of glass,
        // which is exactly what it looked like at 0.62.
        opacity={0.3}
        alphaMap={maps.alphaMap}
        normalMap={maps.normalMap}
        normalScale={new THREE.Vector2(1.4, 1.4)}
        roughness={0.3}
        metalness={0}
        clearcoat={0.4}
        clearcoatRoughness={0.25}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

Overflow.propTypes = {
  from: PropTypes.number.isRequired,
  to: PropTypes.number.isRequired,
  topRadius: PropTypes.number.isRequired,
  bottomRadius: PropTypes.number.isRequired,
  color: PropTypes.string
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
  basin: { water: 0.33, floor: 0.26, radius: 2.54, amplitude: 0.028 },
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

/**
 * The two dishes water comes over the edge of.
 *
 * Each is a plate wider at the bottom than at the top, so water going over
 * the lip runs down the outside of the flare and falls from its lower edge,
 * which is where the curtain hangs from and how wide it is. Hanging it from
 * the lip instead put the sheet inside the plate, and it appeared to come out
 * of the underside.
 */
const MIDDLE_TIER = { lip: 1.28, edge: 1.48, underside: 0.93 }
const UPPER_TIER = { lip: 0.64, edge: 0.78, underside: 1.67 }

/** How far a falling sheet carries outward on its way down. */
const FLARE = 0.14

/** The crown, at the top: the one place the fountain still throws water. */
const CROWN_JET = {
  from: 2.36,
  speed: 0.95,
  rise: 1.15,
  lands: POOLS.upper.water,
  radius: 0.035
}
/** How far out a jet of this shape comes down, from where it left. */
function reachOf({ from, speed, rise, lands }) {
  const arc = jetArc({ speed, rise, landingY: lands - from })
  return arc[arc.length - 1].x
}

function Fountain({ isNight = false }) {
  // Where each tier's rim is, and how far the water lands from the middle
  // when it comes over. A curtain leaving a lip keeps going the way it was
  // going, so it lands a little outside the rim it left.
  const rims = useMemo(
    () => ({
      // From the top dish down into the middle one.
      upper: { from: UPPER_TIER.underside, radius: UPPER_TIER.edge, lands: UPPER_TIER.edge + FLARE },
      // And from the middle one down into the basin.
      middle: {
        from: MIDDLE_TIER.underside,
        radius: MIDDLE_TIER.edge,
        lands: MIDDLE_TIER.edge + FLARE
      }
    }),
    []
  )

  // A pool's coordinates are its own: the disc is built in XY and laid flat,
  // so a point on it is [x, z] of the fountain read as [x, y] of the disc,
  // with how hard the water is hit as the third number.
  //
  // The basin and the middle dish are fed by a curtain, which lands in a
  // circle rather than at points, so their waves run out from a ring.
  const basinRing = useMemo(() => [rims.middle.lands, 1], [rims])
  const middleRing = useMemo(() => [rims.upper.lands, 0.8], [rims])

  // What runs down the stem and arrives in the middle of the basin.
  const basinImpacts = useMemo(() => [[0, 0, 0.45]], [])

  // The eight crown jets do still come down as points, in the top dish.
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
        color="#1f7fa8"
        alpha={0.82}
        impacts={basinImpacts}
        ring={basinRing}
        amplitude={POOLS.basin.amplitude}
        reflects
        resolution={256}
        isNight={isNight}
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
        color="#2f9dc4"
        alpha={0.78}
        drift={1.5}
        ring={middleRing}
        amplitude={POOLS.middle.amplitude}
      />

      {/* And over its rim, the whole way round, into the basin. */}
      <Overflow
        from={rims.middle.from}
        to={POOLS.basin.water}
        topRadius={rims.middle.radius}
        bottomRadius={rims.middle.lands}
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
        color="#3fb8dd"
        alpha={0.76}
        drift={2.2}
        impacts={upperImpacts}
        amplitude={POOLS.upper.amplitude}
      />

      {/* Over the top dish's rim into the middle one. */}
      <Overflow
        from={rims.upper.from}
        to={POOLS.middle.water}
        topRadius={rims.upper.radius}
        bottomRadius={rims.upper.lands}
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

Fountain.propTypes = {
  isNight: PropTypes.bool
}

export default Fountain
