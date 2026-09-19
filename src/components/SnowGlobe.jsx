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

export const SNOW_GLOBE_CONTENT_SCALE = 0.28
const DEFAULT_SCALE = SNOW_GLOBE_CONTENT_SCALE

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
  // How sharply the groove closes. The valley term is raised to this power, so
  // a larger number keeps more of the circumference out at full radius and
  // leaves a narrower line between ribs.
  sharpness = 12,
  // Segments per rib. This has to rise with sharpness: a groove narrower than
  // the tessellation can resolve lands between samples and reads as noise
  // along the base rather than as a cut.
  //
  // 12 is the floor for the sharpness above — the groove spans about 1.8
  // segments. 16 renders it crisper, and measured 10% slower on drawer
  // toggling against 4% for this, which is not worth it for a difference only
  // visible with the camera pushed right up to the base.
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
    // A cosine alone gives ribs and grooves of equal width. Raising the valley
    // term to a power keeps most of the circumference out at full radius and
    // cuts only a narrow groove between ribs, which is how turned reeding
    // actually looks. The groove's width at half depth is 2*asin(0.5^(1/p))
    // per rib: at p=3 about a third of the rib pitch, at p=12 about a
    // seventh.
    const wave = Math.cos(angle * flutes)
    const groove = Math.pow((1 - wave) / 2, sharpness)
    const scale = 1 - depth * groove

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
  baseHeight = 3.2,
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
 * A soft amber aura around the lettering.
 *
 * The shell is the label geometry pushed out along its own vertex normals.
 * Scaling it would not do: the glyphs are laid out around the globe axis
 * rather than about their own centre, so a scale swings them outward along
 * the arc instead of thickening them. Drawn back faces only, so it shows just
 * where it clears the letter's silhouette, and in normal blending — additive
 * washes amber to white against a bright sky.
 */
const glowShellCache = new Map()

function getGlowShell(text, radius, size, amount) {
  const key = `${text}|${radius}|${size}|${amount}`
  if (!glowShellCache.has(key)) {
    const shell = getLabelGeometry(text, radius, size).clone()
    const position = shell.attributes.position
    const normal = shell.attributes.normal
    for (let i = 0; i < position.count; i += 1) {
      position.setXYZ(
        i,
        position.getX(i) + normal.getX(i) * amount,
        position.getY(i) + normal.getY(i) * amount,
        position.getZ(i) + normal.getZ(i) * amount
      )
    }
    position.needsUpdate = true
    shell.computeBoundingSphere()
    glowShellCache.set(key, shell)
  }
  return glowShellCache.get(key)
}

// Two shells, the outer one fainter, so the light falls off instead of
// stopping at a single hard outline.
const GLOW_SHELLS = [
  { amount: 0.07, opacity: 0.3 },
  { amount: 0.17, opacity: 0.13 }
]

const glowMaterials = GLOW_SHELLS.map(
  ({ opacity }) =>
    new THREE.MeshBasicMaterial({
      color: AMBER_LIGHT,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.BackSide
    })
)

function RotatingPlaque({ radius, labelY, text, material }) {
  const groupRef = useRef()

  useFrame((_, delta) => {
    if (!groupRef.current) return
    groupRef.current.rotation.y += delta * 0.15
  })

  const size = 1.62
  const geometry = useMemo(() => getLabelGeometry(text, radius, size), [text, radius, size])
  const shells = useMemo(
    () => GLOW_SHELLS.map(({ amount }) => getGlowShell(text, radius, size, amount)),
    [text, radius, size]
  )

  return (
    <group ref={groupRef} position={[0, labelY, 0]}>
      {[0, 1, 2].map((copy) => (
        <group key={`plaque-${copy}`} rotation={[0, (copy / 3) * Math.PI * 2, 0]}>
          <mesh geometry={geometry} material={material} />
          {shells.map((shell, index) => (
            <mesh
              key={`glow-${GLOW_SHELLS[index].amount}`}
              geometry={shell}
              material={glowMaterials[index]}
            />
          ))}
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
