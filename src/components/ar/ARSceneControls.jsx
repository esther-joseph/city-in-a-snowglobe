import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { Text } from '@react-three/drei'

/**
 * Controls that live inside the 3D scene rather than in the DOM.
 *
 * The dom-overlay feature the Android session relies on is an ARCore
 * extension; headset browsers (visionOS Safari, Android XR) do not composite
 * HTML into an immersive session, so without these the session has no UI at
 * all. Sizes are in metres, placed at hand height between the viewer and the
 * globe.
 */
function ARButton({ position, label, onClick }) {
  const [hovered, setHovered] = useState(false)

  return (
    <group position={position}>
      <mesh
        onClick={(event) => {
          event.stopPropagation()
          onClick?.()
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[0.26, 0.09, 0.012]} />
        <meshStandardMaterial
          color={hovered ? '#3b4a6b' : '#12182b'}
          emissive={hovered ? '#22304d' : '#0a0f1c'}
          emissiveIntensity={0.6}
          roughness={0.35}
          metalness={0.1}
          transparent
          opacity={0.92}
        />
      </mesh>
      <Text
        position={[0, 0, 0.008]}
        fontSize={0.032}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  )
}

ARButton.propTypes = {
  position: PropTypes.arrayOf(PropTypes.number).isRequired,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func
}

function ARSceneControls({ onShake, onExit }) {
  return (
    <group position={[0, 0.78, 0.55]} rotation={[-0.32, 0, 0]}>
      <ARButton position={[-0.16, 0, 0]} label="Shake" onClick={onShake} />
      <ARButton position={[0.16, 0, 0]} label="Exit AR" onClick={onExit} />
    </group>
  )
}

ARSceneControls.propTypes = {
  onShake: PropTypes.func,
  onExit: PropTypes.func
}

export default ARSceneControls
