import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import PropTypes from 'prop-types'
import * as THREE from 'three'
import { createWaterNormalMap, jetArc } from '../../utils/waterSurface'

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
 */

// One map, shared by every pool in every fountain. It is 256px of canvas and
// there is no reason to build it per basin.
let sharedNormalMap = null
const getWaterNormalMap = () => {
  if (!sharedNormalMap) sharedNormalMap = createWaterNormalMap({ strength: 1.6, repeat: 1.5 })
  return sharedNormalMap
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
 * A pool of still water.
 *
 * The normal map scrolls in two directions at once and turns slowly, so the
 * pattern never settles into something the eye can read as a repeat.
 */
function WaterSurface({ position, radius, color = '#3fb8dd', opacity = 0.82, drift = 1 }) {
  const normalMap = useMemo(() => getWaterNormalMap().clone(), [])
  const materialRef = useRef()

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    normalMap.offset.set(time * 0.013 * drift, time * 0.009 * drift)
    normalMap.rotation = Math.sin(time * 0.06) * 0.25
    normalMap.needsUpdate = true
    if (materialRef.current) {
      // The surface is never perfectly flat, and how rough it looks changes
      // as the swell passes. This is a small move and it is what stops the
      // highlight sitting still.
      materialRef.current.roughness = 0.08 + Math.sin(time * 0.7) * 0.03
    }
  })

  // No receiveShadow on the pool. A flat disc facing a shadow-casting sun
  // bands with acne across its whole surface, and a pool of water has nothing
  // useful to catch anyway.
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[radius, 48]} />
      <meshPhysicalMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={opacity}
        roughness={0.1}
        metalness={0}
        normalMap={normalMap}
        normalScale={new THREE.Vector2(0.4, 0.4)}
        clearcoat={1}
        clearcoatRoughness={0.06}
        ior={1.33}
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
  drift: PropTypes.number
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

  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(jetArc({ speed, rise, landingY }))
    return new THREE.TubeGeometry(curve, 20, radius, 6, false)
  }, [speed, rise, landingY, radius])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    // Mains pressure is never quite steady, so the jet leans a little.
    const time = clock.getElapsedTime()
    groupRef.current.rotation.z = Math.sin(time * 1.6 + idx * 1.1) * 0.035
    groupRef.current.scale.setScalar(1 + Math.sin(time * 2.3 + idx * 0.7) * 0.03)
  })

  return (
    <group position={position} rotation={[0, angle, 0]}>
      <group ref={groupRef}>
        <mesh geometry={geometry}>
          <meshPhysicalMaterial
            color="#cdf0ff"
            transparent
            opacity={0.72}
            alphaMap={fade}
            roughness={0.12}
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

/** A ring spreading from where something hit the water. */
function Ripple({ position, maxR = 1.6, speed = 0.55, delay = 0 }) {
  const ref = useRef()
  const materialRef = useRef()

  useFrame(({ clock }) => {
    if (!ref.current || !materialRef.current) return
    const t = (clock.getElapsedTime() * speed + delay) % 1
    const scale = 0.08 + t * 0.92
    ref.current.scale.set(scale, 1, scale)
    // Fading as the square of the distance, the way a spreading ring loses
    // height, rather than linearly.
    materialRef.current.opacity = (1 - t) * (1 - t) * 0.5
  })

  return (
    <mesh ref={ref} position={position} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[maxR, 0.022, 6, 32]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#d6f4ff"
        transparent
        opacity={0.4}
        depthWrite={false}
      />
    </mesh>
  )
}

Ripple.propTypes = {
  position: PropTypes.arrayOf(PropTypes.number).isRequired,
  maxR: PropTypes.number,
  speed: PropTypes.number,
  delay: PropTypes.number
}

function Fountain() {
  // Where the outer ring of jets lands, so the ripples start there.
  const outerJets = useMemo(
    () =>
      [0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2
        return { angle, x: Math.cos(angle) * 1.05, z: Math.sin(angle) * 1.05 }
      }),
    []
  )

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
      <mesh position={[0, 0.26, 0]} receiveShadow>
        <cylinderGeometry args={[2.52, 2.52, 0.08, 32]} />
        <meshStandardMaterial color="#5d4b3e" roughness={0.9} metalness={0.06} />
      </mesh>
      {/* Sits at 0.33, not 0.36. The wall above is a cylinder centred at 0.18
          with a height of 0.36, so its top cap lands exactly on 0.36 and a cap
          covers the whole disc rather than just the ring. Water at the same
          height fought with it across the entire pool. */}
      <WaterSurface position={[0, 0.33, 0]} radius={2.54} color="#2f9dc4" opacity={0.86} />

      {/* Rings where the outer jets come down, rather than all from the middle */}
      {outerJets.map((jet, index) => (
        <Ripple
          key={`splash-${index}`}
          position={[jet.x * 1.35, 0.345, jet.z * 1.35]}
          maxR={0.42}
          speed={0.6}
          delay={index / outerJets.length}
        />
      ))}
      <Ripple position={[0, 0.345, 0]} maxR={1.9} speed={0.4} delay={0.2} />

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
      <WaterSurface position={[0, 1.17, 0]} radius={1.22} color="#43b5d8" opacity={0.8} drift={1.5} />
      <Ripple position={[0, 1.185, 0]} maxR={0.95} speed={0.68} delay={0.15} />
      <Ripple position={[0, 1.185, 0]} maxR={0.95} speed={0.68} delay={0.65} />

      <mesh position={[0, 1.48, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.14, 0.22, 0.52, 12]} />
        <meshStandardMaterial color="#c8b89e" roughness={0.7} metalness={0.14} />
      </mesh>

      {/* Upper tier */}
      <mesh position={[0, 1.77, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.64, 0.78, 0.2, 18]} />
        <meshStandardMaterial color="#d4c4ac" roughness={0.72} metalness={0.1} />
      </mesh>
      <WaterSurface position={[0, 1.88, 0]} radius={0.58} color="#57c8ea" opacity={0.78} drift={2.2} />
      <Ripple position={[0, 1.895, 0]} maxR={0.46} speed={0.82} delay={0} />

      <mesh position={[0, 2.12, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.07, 0.13, 0.46, 10]} />
        <meshStandardMaterial color="#ddd0b8" roughness={0.65} metalness={0.15} />
      </mesh>

      {/* The crown: eight jets thrown outward from the top, falling to the
          upper pool. */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <WaterJet
          key={`crown-${i}`}
          position={[0, 2.36, 0]}
          angle={(i / 8) * Math.PI * 2}
          speed={0.95}
          rise={1.15}
          landingY={-0.46}
          radius={0.022}
          idx={i}
        />
      ))}

      {/* Middle tier throws out to the big pool below */}
      {outerJets.map((jet, i) => (
        <WaterJet
          key={`outer-${i}`}
          position={[jet.x, 1.06, jet.z]}
          angle={jet.angle}
          speed={1.55}
          rise={0.72}
          landingY={-0.68}
          radius={0.026}
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
