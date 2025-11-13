import React from 'react'
import PropTypes from 'prop-types'

function Sun({
  position = [0, 0, 0],
  auraColor = '#ffb347',
  sunColor = '#ffd27d',
  auraIntensity = 1,
  scale = 1
}) {
  const radius = 3.2 * scale
  return (
    <group position={position}>
      <pointLight
        position={[0, 0, 0]}
        intensity={auraIntensity}
        color={auraColor}
        distance={180 * scale}
      />
      <mesh>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial
          color={sunColor}
          emissive={sunColor}
          emissiveIntensity={0.6}
          roughness={0.2}
          metalness={0.15}
        />
      </mesh>
      <mesh scale={[1.9, 1.9, 1.9]}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={auraColor}
          transparent
          opacity={0.18}
        />
      </mesh>
    </group>
  )
}

Sun.propTypes = {
  position: PropTypes.arrayOf(PropTypes.number),
  auraColor: PropTypes.string,
  sunColor: PropTypes.string,
  auraIntensity: PropTypes.number,
  scale: PropTypes.number
}

export default Sun

