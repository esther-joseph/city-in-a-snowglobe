import React, { useMemo, useRef } from 'react'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

export const SNOW_GLOBE_CONTENT_SCALE = 0.28
const DEFAULT_SCALE = SNOW_GLOBE_CONTENT_SCALE

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

  return (
    <group position={position} rotation={rotation}>
      {/* Base */}
      <mesh position={[0, -baseHeight / 2, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[baseRadius * 1.15, baseRadius * 1.3, baseHeight, 88]} />
        <meshStandardMaterial color="#6f4b2a" roughness={0.5} metalness={0.35} />
      </mesh>
     

      {/* City contents */}
      <group position={[0, cityYOffset, 0]} scale={scale}>
        {children}
      </group>

      {/* Glass dome */}
      <mesh position={[0, domeCenterY, 0]}>
        <sphereGeometry args={[domeRadius, 80, 80]} />
        <meshStandardMaterial
          color={glassColor}
          transparent
          opacity={Math.min(0.55, glassOpacity + (isFoggy ? 0.15 : 0))}
          roughness={isFoggy ? 0.32 : 0.08}
          metalness={0.1}
          reflectivity={0.42}
          clearcoat={0.35}
          clearcoatRoughness={0.18}
        />
      </mesh>

      {/* Plaque */}
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

  return (
    <group ref={groupRef}>
      
      {[0, 1, 2].map((index) => {
        const angle = (index / 3) * Math.PI * 2
        const x = Math.sin(angle) * radius
        const z = Math.cos(angle) * radius
        const arcSweep = Math.PI / 2.1
        const textRadius = radius + 0.16
        return (
          <Text
            key={`plaque-text-${index}`}
            position={[x, labelY + 0.08, z + 0.02]}
            rotation={[0, angle, 0]}
            color="#ffffff"
            fontSize={2.28}
            anchorX="center"
            anchorY="middle"
            letterSpacing={0.05}
            maxWidth={Math.abs(textRadius) * arcSweep}
            textAlign="center"
            curveRadius={-textRadius}
            lineHeight={1}
          >
            {text}
          </Text>
        )
      })}
    </group>
  )
}

