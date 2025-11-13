import React from 'react'
import PropTypes from 'prop-types'

function Moon({
  position = [0, 0, 0],
  moonColor = '#f2f6ff',
  auraColor = '#6f7ab1',
  auraIntensity = 0.2,
  lightIntensity = 0.1,
  scale = 1
}) {
  const radius = 3 * scale
  return (
    <group position={position}>
      <pointLight
        position={[0, 0, 0]}
        intensity={auraIntensity + lightIntensity}
        color={moonColor}
        distance={160 * scale}
      />
      <mesh>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial
          emissive={moonColor}
          emissiveIntensity={0.25}
          color={moonColor}
          roughness={0.85}
        />
      </mesh>
      <mesh scale={[1.8, 1.8, 1.8]}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={auraColor}
          transparent
          opacity={0.12}
        />
      </mesh>
    </group>
  )
}

Moon.propTypes = {
  position: PropTypes.arrayOf(PropTypes.number),
  moonColor: PropTypes.string,
  auraColor: PropTypes.string,
  auraIntensity: PropTypes.number,
  lightIntensity: PropTypes.number,
  scale: PropTypes.number
}

export default Moon

