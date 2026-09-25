import React, { useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import { shaderMaterial } from '@react-three/drei'
import typeface from 'three/examples/fonts/helvetiker_regular.typeface.json'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import * as THREE from 'three'
import { useFrame, extend } from '@react-three/fiber'
import { createHammeredMaps } from '../utils/hammeredMetal'
import { createWoodGrainMaps } from '../utils/woodGrain'
import { createGlowTexture } from '../utils/glowTexture'

export const SNOW_GLOBE_CONTENT_SCALE = 0.28
const DEFAULT_SCALE = SNOW_GLOBE_CONTENT_SCALE

/** The wooden base, and how far the city's ground sits above the globe's origin. */
export const SNOW_GLOBE_BASE_HEIGHT = 3.2
export const SNOW_GLOBE_CITY_Y = Math.max(0.22, SNOW_GLOBE_BASE_HEIGHT * 0.07)

/**
 * Fluted geometries are shared across mounts.
 *
 * BaseScene and ShakeableScene are declared inside App, so every App render
 * creates new component types and React remounts the whole 3D subtree — which
 * threw away the useMemo below and rebuilt this geometry on every drawer
 * toggle. At 150 flutes that was enough to push the rapid-interaction test
 * past its budget. Keyed by its parameters, so a remount reuses the buffer.
 */
// Built once and shared: the dent field is the same for every globe.
let hammeredMaps = null
const getHammeredMaps = () => {
  if (!hammeredMaps) {
    // The ring is about 100 units around and a fraction of a unit thick, so
    // the map has to repeat hard along its length to keep the hammer marks
    // roughly square rather than smeared into streaks.
    hammeredMaps = createHammeredMaps({
      repeat: [40, 1],
      dents: 420,
      minRadius: 14,
      maxRadius: 34
    })
  }
  return hammeredMaps
}

// One grain tile, shared by the fluted body and the plates that cap it.
let woodGrainMaps = null
const getWoodGrainMaps = () => {
  if (!woodGrainMaps) woodGrainMaps = createWoodGrainMaps({ repeat: [3, 1] })
  return woodGrainMaps
}

const flutedGeometryCache = new Map()

function getFlutedGeometry(params) {
  const key = Object.values(params).join('|')
  if (!flutedGeometryCache.has(key)) {
    flutedGeometryCache.set(key, createFlutedGeometry(params))
  }
  return flutedGeometryCache.get(key)
}

/**
 * A cylinder with vertical flutes cut around it, like a reeded plinth.
 *
 * Built by pushing each vertex in or out along its own radius by a sine of the
 * angle: the ribs follow the taper, and recomputed normals make them catch
 * light as rounded reeds rather than facets.
 */
function createFlutedGeometry({
  topRadius,
  bottomRadius,
  height,
  flutes,
  depth,
  // How full each reed is. 0.5 is a true semicircle; lower carries the radius
  // further across the reed before it turns down, so neighbouring beads meet
  // later and the dark line between them is thinner.
  fullness = 0.3,
  // Samples across each reed. Twelve is smooth for a round section — the
  // curvature is spread over the whole reed rather than concentrated in a
  // narrow cut, so this does not need to be large. Sixteen measured 10%
  // slower on drawer toggling for no visible gain.
  segmentsPerFlute = 12
}) {
  const geometry = new THREE.CylinderGeometry(
    topRadius,
    bottomRadius,
    height,
    flutes * segmentsPerFlute,
    1,
    false
  )

  const position = geometry.attributes.position
  const vertex = new THREE.Vector3()

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i)
    const radius = Math.hypot(vertex.x, vertex.z)
    if (radius < 1e-4) continue

    const angle = Math.atan2(vertex.z, vertex.x)
    // Reeding, not fluting: the two are inverses of one another. Fluting cuts
    // grooves into a flat face and leaves the face between them; reeding
    // stands the ribs proud as convex beads that meet in a line, with no flat
    // anywhere on the surface.
    //
    // `offset` is the angular distance from a reed's crown, normalised so 0 is
    // the crown and 1 the valley between two reeds. (1 - offset^2) raised to a
    // power is the section riding over it: at 0.5 exactly a semicircle, and
    // below that a fuller bead that carries its radius further before turning
    // down — which narrows the parting line without flattening the crown.
    //
    // The valley still lands on a cusp. That is what gives reeding its crisp
    // parting line rather than the soft trough a cosine would leave; the
    // fullness sets how wide that line reads, not whether it is there.
    const wave = Math.min(1, Math.max(-1, Math.cos(angle * flutes)))
    const offset = Math.acos(wave) / Math.PI
    const bead = Math.pow(Math.max(0, 1 - offset * offset), fullness)
    const scale = 1 - depth * (1 - bead)

    position.setX(i, vertex.x * scale)
    position.setZ(i, vertex.z * scale)
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

// Amber-yellow gold: warmer and softer than the near-white gold the ring and
// lettering used to carry.
const AMBER_GOLD = '#f0bf55'
const AMBER_GLOW = '#e09a2b'
const AMBER_DEEP = '#4a3208'
// The light the lettering gives off — a shade brighter than the ring's amber
// so the glow reads as a source rather than a reflection.
const AMBER_LIGHT = '#ffb84a'

const FresnelGlassMaterial = shaderMaterial(
  {
    rimColor: new THREE.Color('#b8d8ff'),
    baseColor: new THREE.Color('#eef8ff'),
    opacity: 0.22
  },
  /* vertexShader */
  `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vViewDir = normalize(-mvPosition.xyz);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  /* fragmentShader */
  `
    uniform vec3 rimColor;
    uniform vec3 baseColor;
    uniform float opacity;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      float fresnel = pow(1.0 - dot(normalize(vNormal), normalize(vViewDir)), 3.0);
      vec3 color = mix(baseColor, rimColor, fresnel);
      float alpha = mix(opacity * 0.4, opacity * 2.2, fresnel);
      gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.85));
    }
  `
)

extend({ FresnelGlassMaterial })

function SnowGlobe({
  children,
  cityName = 'CITY',
  scale = DEFAULT_SCALE,
  baseRadius = 13.5,
  baseHeight = SNOW_GLOBE_BASE_HEIGHT,
  upperBaseHeight = 1.05,
  domeRadius = 14.5,
  glassOpacity = 0.22,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  weatherType = null,
  tintColor = '#eef8ff'
}) {
  const normalizedName = useMemo(
    () => (cityName && typeof cityName === 'string' ? cityName : 'CITY').toUpperCase(),
    [cityName]
  )

  // Plain collar and foot that cap the fluting, sized to the reed circumference.
  const plateHeight = Math.max(0.3, baseHeight * 0.13)
  const cityYOffset = Math.max(0.22, baseHeight * 0.07)
  const domeCenterY = cityYOffset + 9.8
  const labelY = baseHeight / 2 + upperBaseHeight * 0.4
  const labelRadius = baseRadius * 1.12

  const isFoggy = weatherType
    ? ['fog', 'mist', 'haze', 'smoke'].some((term) => weatherType.toLowerCase().includes(term))
    : false

  const glassColor = useMemo(() => {
    if (!isFoggy) return tintColor
    const base = new THREE.Color(tintColor)
    const fog = new THREE.Color('#d6dbe5')
    return base.lerp(fog, 0.45).getStyle()
  }, [tintColor, isFoggy])

  const flutedBase = useMemo(
    () =>
      getFlutedGeometry({
        topRadius: baseRadius * 1.15,
        bottomRadius: baseRadius * 1.3,
        height: baseHeight,
        flutes: 200,
        depth: 0.03
      }),
    [baseRadius, baseHeight]
  )

  const hammered = useMemo(() => getHammeredMaps(), [])
  const wood = useMemo(() => getWoodGrainMaps(), [])

  // The lettering wears the ring's forged finish, in the lighter yellow gold
  // it has always been. Shared by every glyph so there is one material, not
  // forty.
  const letterMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f7dd8c',
        // Lit from within: the amber emission is what makes the letters read
        // as glowing rather than as gold that happens to catch the light.
        emissive: AMBER_LIGHT,
        emissiveIntensity: 0.55,
        // Mostly dielectric: with no environment map a high metalness has
        // nothing to reflect and the light yellow sinks towards bronze.
        metalness: 0.45,
        roughness: 0.34,
        normalMap: hammered.normalMap,
        normalScale: new THREE.Vector2(0.8, 0.8),
        roughnessMap: hammered.roughnessMap
      }),
    [hammered]
  )

  // Clear of the lettering, which sits above it.
  const ringY = labelY - 1.45

  const fresnelBaseColor = useMemo(() => new THREE.Color(glassColor), [glassColor])
  const fresnelRimColor = useMemo(() => new THREE.Color('#b8d8ff'), [])

  return (
    <group position={position} rotation={rotation}>
      {/* Plain collar above the fluting, matching the top of the reeds */}
      <mesh position={[0, -plateHeight / 2, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[baseRadius * 1.16, baseRadius * 1.16, plateHeight, 96]} />
        <meshStandardMaterial
          color="#7c5530"
          map={wood.map}
          roughnessMap={wood.roughnessMap}
          roughness={0.55}
          metalness={0.18}
        />
      </mesh>

      {/* Base — warm brown, fluted like a reeded plinth */}
      <mesh
        position={[0, -baseHeight / 2, 0]}
        geometry={flutedBase}
        receiveShadow
        castShadow
      >
        {/* The grain map is luminance only, so it modulates this colour rather
            than replacing it — the chocolate brown stays as it was. */}
        <meshStandardMaterial
          color="#7c5530"
          map={wood.map}
          roughnessMap={wood.roughnessMap}
          roughness={0.62}
          metalness={0.15}
        />
      </mesh>

      {/* Plain foot below it, matching the widest point of the reeds */}
      <mesh position={[0, -baseHeight - plateHeight / 2, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[baseRadius * 1.31, baseRadius * 1.31, plateHeight, 96]} />
        <meshStandardMaterial
          color="#7c5530"
          map={wood.map}
          roughnessMap={wood.roughnessMap}
          roughness={0.55}
          metalness={0.18}
        />
      </mesh>

      {/* City contents */}
      <group position={[0, cityYOffset, 0]} scale={scale}>
        {children}
      </group>

      {/* Glass dome — fresnel shader */}
      <mesh position={[0, domeCenterY, 0]}>
        <sphereGeometry args={[domeRadius, 80, 80]} />
        <fresnelGlassMaterial
          rimColor={fresnelRimColor}
          baseColor={fresnelBaseColor}
          opacity={Math.min(0.55, glassOpacity + (isFoggy ? 0.15 : 0))}
          transparent
          side={THREE.FrontSide}
          depthWrite={false}
        />
      </mesh>

      {/* Ambient rim glow sphere */}
      <mesh position={[0, domeCenterY, 0]}>
        <sphereGeometry args={[domeRadius * 1.025, 48, 48]} />
        <meshBasicMaterial
          color="#a8d0ff"
          transparent
          opacity={0.07}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Amber gold ring — forged rather than mirrored: a hammered normal map
          breaks the highlight into facets */}
      <mesh position={[0, ringY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[baseRadius * 1.18, 0.17, 20, 320]} />
        <meshStandardMaterial
          color={AMBER_GOLD}
          emissive={AMBER_GLOW}
          emissiveIntensity={0.3}
          roughness={0.42}
          metalness={0.9}
          normalMap={hammered.normalMap}
          normalScale={new THREE.Vector2(2.2, 2.2)}
          roughnessMap={hammered.roughnessMap}
        />
      </mesh>

      {/* Plaque — gold label */}
      <RotatingPlaque
        radius={labelRadius}
        labelY={labelY}
        text={normalizedName}
        material={letterMaterial}
      />
    </group>
  )
}

export default SnowGlobe

/**
 * The city name as extruded 3D lettering, curved around the globe.
 *
 * Text3D produces real geometry but only in a straight line, so each character
 * is placed and rotated individually along the arc — the letters follow the
 * plinth the way the old flat text did, but now they have depth and catch the
 * light on their bevels.
 *
 * Spacing comes from the typeface's own horizontal advances, so the wider
 * letters get the room they need instead of everything sitting on a fixed
 * pitch.
 */
const GLYPH_SCALE = 1 / typeface.resolution
const advanceFor = (character) =>
  ((typeface.glyphs[character] ?? typeface.glyphs.n).ha ?? 700) * GLYPH_SCALE

const parsedFont = new FontLoader().parse(typeface)

/**
 * The whole label is baked into one geometry.
 *
 * Laid out as individual meshes it came to thirty-nine draw calls — three
 * copies of a dozen glyphs — and that was enough to put the rapid-interaction
 * test back over its budget on mobile emulation. Each glyph is built once,
 * transformed onto its place on the arc, and merged; the three copies then
 * share the result and differ only by rotation.
 */
const labelGeometryCache = new Map()

function glyphGeometry(character, size) {
  const geometry = new TextGeometry(character, {
    font: parsedFont,
    size,
    depth: size * 0.2,
    // Kept deliberately coarse: the lettering is small on screen and every
    // extra curve or bevel segment multiplies across a dozen glyphs.
    curveSegments: 2,
    bevelEnabled: true,
    bevelThickness: size * 0.022,
    bevelSize: size * 0.018,
    bevelSegments: 1
  })
  geometry.computeBoundingBox()
  const { min, max } = geometry.boundingBox
  geometry.translate(-(min.x + max.x) / 2, -(min.y + max.y) / 2, -(min.z + max.z) / 2)
  return geometry
}

/**
 * The fisheye bullet, built rather than typeset — no typeface carries U+25C9.
 *
 * Returned non-indexed: TextGeometry is non-indexed and mergeGeometries
 * refuses to mix the two, which silently yields a null geometry and an empty
 * canvas.
 */
function bulletGeometries(size) {
  return [
    new THREE.TorusGeometry(size * 0.42, size * 0.1, 8, 20).toNonIndexed(),
    new THREE.SphereGeometry(size * 0.2, 12, 8).toNonIndexed()
  ]
}

function buildLabelGeometry(text, radius, size) {
  const characters = [...`◉ ${text} ◉`]
  const widths = characters.map((character) =>
    character === '◉' ? size * 0.95 : advanceFor(character) * size
  )
  const total = widths.reduce((sum, width) => sum + width, 0)

  const placed = []
  const matrix = new THREE.Matrix4()
  const rotation = new THREE.Euler()
  let cursor = -total / 2

  characters.forEach((character, index) => {
    const centre = cursor + widths[index] / 2
    cursor += widths[index]
    if (character === ' ') return

    const angle = centre / radius
    rotation.set(0, angle, 0)
    matrix.makeRotationFromEuler(rotation)
    matrix.setPosition(Math.sin(angle) * radius, 0, Math.cos(angle) * radius)

    const pieces =
      character === '◉' ? bulletGeometries(size) : [glyphGeometry(character, size)]
    pieces.forEach((piece) => {
      piece.applyMatrix4(matrix)
      placed.push(piece)
    })
  })

  const merged = mergeGeometries(placed, false)
  placed.forEach((piece) => piece.dispose())
  return merged
}

function getLabelGeometry(text, radius, size) {
  const key = `${text}|${radius}|${size}`
  if (!labelGeometryCache.has(key)) {
    labelGeometryCache.set(key, buildLabelGeometry(text, radius, size))
  }
  return labelGeometryCache.get(key)
}

/**
 * The glow around the lettering.
 *
 * Built the way the rest of the scene's lights are built, because it used to
 * be built its own way and looked it. The sun, the moon and the street lamps
 * all do the same three things: an emissive surface, a soft halo on a
 * camera-facing sprite, and a real light with a distance and a decay so the
 * glow lands on what is nearby.
 *
 * What was here instead was the label geometry inflated along its normals and
 * drawn back-faces-only, twice. That is the nested-shell trick glowTexture.js
 * exists to avoid: a shell has an edge, so the glow stopped at an outline
 * rather than falling off, and being geometry it inflated unevenly across
 * letters of different thickness.
 */

// Amber through to champagne, gone by the edge. The same shape of ramp the
// sun uses, in the ring's colour rather than the sky's.
let letterGlowTexture = null
const getLetterGlowTexture = () => {
  if (!letterGlowTexture) {
    letterGlowTexture = createGlowTexture([
      { stop: 0, color: AMBER_LIGHT, alpha: 0.85 },
      { stop: 0.28, color: AMBER_GOLD, alpha: 0.42 },
      { stop: 0.62, color: AMBER_GLOW, alpha: 0.14 },
      { stop: 1, color: AMBER_GLOW, alpha: 0 }
    ])
  }
  return letterGlowTexture
}

// Three sprites spread along each label's arc. One flat sprite cannot follow
// a curve, and one per letter would be forty of them.
const GLOW_SPREAD = [-0.24, 0, 0.24]

function RotatingPlaque({ radius, labelY, text, material }) {
  const groupRef = useRef()

  useFrame((_, delta) => {
    if (!groupRef.current) return
    groupRef.current.rotation.y += delta * 0.15
  })

  const size = 1.62
  const geometry = useMemo(() => getLabelGeometry(text, radius, size), [text, radius, size])
  const glowTexture = useMemo(() => getLetterGlowTexture(), [])

  return (
    <group ref={groupRef} position={[0, labelY, 0]}>
      {[0, 1, 2].map((copy) => (
        <group key={`plaque-${copy}`} rotation={[0, (copy / 3) * Math.PI * 2, 0]}>
          <mesh geometry={geometry} material={material} />

          {GLOW_SPREAD.map((offset) => (
            <sprite
              key={`glow-${offset}`}
              position={[Math.sin(offset) * radius, 0, Math.cos(offset) * radius]}
              scale={[size * 3.4, size * 2.2, 1]}
            >
              <spriteMaterial
                map={glowTexture}
                transparent
                depthWrite={false}
                opacity={0.55}
                toneMapped={false}
              />
            </sprite>
          ))}

          {/* The light the lettering actually casts, the same way a lamp does:
              short reach, quadratic falloff, so it warms the plinth under the
              letters and nothing else. */}
          <pointLight
            position={[0, 0, radius * 0.94]}
            intensity={1.5}
            distance={5.5}
            decay={2}
            color={AMBER_GLOW}
          />
        </group>
      ))}
    </group>
  )
}

RotatingPlaque.propTypes = {
  radius: PropTypes.number.isRequired,
  labelY: PropTypes.number.isRequired,
  text: PropTypes.string.isRequired,
  material: PropTypes.object.isRequired
}
