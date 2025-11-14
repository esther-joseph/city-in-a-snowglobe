/*
import React, { useMemo } from 'react'
import { GradientTexture } from '@react-three/drei'
import * as THREE from 'three'

function AuraSky({ radius = 400, colors = [], rotation = [0, 0, 0] }) {
  const gradientColors = useMemo(() => {
    if (colors && colors.length >= 3) return colors
    return ['#1a237e', '#512da8', '#283593']
  }, [colors])

  return (
    <mesh rotation={rotation}>
      <sphereGeometry args={[radius, 64, 64]} />
      <meshBasicMaterial side={THREE.BackSide} toneMapped={false}>
        <GradientTexture stops={[0, 0.6, 1]} colors={gradientColors} />
      </meshBasicMaterial>
    </mesh>
  )
}

export default AuraSky
*/

