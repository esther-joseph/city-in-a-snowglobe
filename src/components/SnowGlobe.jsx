import React, { useMemo, useRef } from 'react'
import { Text, shaderMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { useFrame, extend } from '@react-three/fiber'

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
function createFlutedGeometry({ topRadius, bottomRadius, height, flutes, depth }) {
  // Eight segments per rib keeps the curve smooth. Narrow ribs need fewer
  // than wide ones; below about six the reeding steps into a cog.
  const geometry = new THREE.CylinderGeometry(
    topRadius,
    bottomRadius,
    height,
    flutes * 8,
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
    // actually looks.
    const wave = Math.cos(angle * flutes)
    const groove = Math.pow((1 - wave) / 2, 3)
    const scale = 1 - depth * groove

    position.setX(i, vertex.x * scale)
    position.setZ(i, vertex.z * scale)
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

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
        flutes: 150,
        depth: 0.03
      }),
    [baseRadius, baseHeight]
  )

  const fresnelBaseColor = useMemo(() => new THREE.Color(glassColor), [glassColor])
  const fresnelRimColor = useMemo(() => new THREE.Color('#b8d8ff'), [])

  return (
    <group position={position} rotation={rotation}>
      {/* Base — warm brown, fluted like a reeded plinth */}
      <mesh
        position={[0, -baseHeight / 2, 0]}
        geometry={flutedBase}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial color="#6f4b2a" roughness={0.62} metalness={0.15} />
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

      {/* Golden thread torus — delicate sparkling ring */}
      <mesh position={[0, labelY - 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[baseRadius * 1.18, 0.07, 12, 128]} />
        <meshStandardMaterial
          color="#ffe084"
          emissive="#ffd54f"
          emissiveIntensity={0.6}
          roughness={0.0}
          metalness={1.0}
        />
      </mesh>

      {/* Plaque — gold label */}
      <RotatingPlaque
        radius={labelRadius}
        labelY={labelY}
        text={normalizedName}
      />
    </group>
  )
}

export default SnowGlobe

function RotatingPlaque({ radius, labelY, text }) {
  const groupRef = useRef()

  useFrame((_, delta) => {
    if (!groupRef.current) return
    groupRef.current.rotation.y += delta * 0.15
  })

  // Wrap city name with decorative middle-dots for a premium engraved-plaque look
  const decorated = `· ${text} ·`
  const arcSweep = Math.PI / 2.1
  const textRadius = radius + 0.16

  return (
    <group ref={groupRef}>
      {[0, 1, 2].map((index) => {
        const angle = (index / 3) * Math.PI * 2
        const x = Math.sin(angle) * radius
        const z = Math.cos(angle) * radius

        return (
          <group key={`plaque-${index}`}>
            {/* Shadow layer — dark engraved depth */}
            <Text
              position={[
                Math.sin(angle) * (radius - 0.12),
                labelY + 0.02,
                Math.cos(angle) * (radius - 0.12)
              ]}
              rotation={[0, angle, 0]}
              color="#3a2800"
              fontSize={2.18}
              anchorX="center"
              anchorY="middle"
              letterSpacing={0.13}
              maxWidth={Math.abs(textRadius) * arcSweep}
              textAlign="center"
              curveRadius={-textRadius}
              lineHeight={1}
            >
              {decorated}
            </Text>

            {/* Gold top layer */}
            <Text
              position={[x, labelY + 0.12, z]}
              rotation={[0, angle, 0]}
              color="#f5d87a"
              fontSize={2.18}
              anchorX="center"
              anchorY="middle"
              letterSpacing={0.13}
              maxWidth={Math.abs(textRadius) * arcSweep}
              textAlign="center"
              curveRadius={-textRadius}
              lineHeight={1}
            >
              {decorated}
            </Text>
          </group>
        )
      })}
    </group>
  )
}
