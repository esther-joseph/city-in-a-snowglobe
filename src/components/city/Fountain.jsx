import React from 'react'

function BlockWater({ size = [1, 0.12, 1], position = [0, 0, 0], color = '#6ec6ff' }) {
  return (
    <mesh position={position} receiveShadow>
      <boxGeometry args={size} />
      <meshPhysicalMaterial
        color={color}
        transparent
        opacity={0.78}
        roughness={0.18}
        metalness={0.05}
        transmission={0.9}
        clearcoat={0.35}
        clearcoatRoughness={0.2}
      />
    </mesh>
  )
}

function StoneBlock({ size = [1, 1, 1], position = [0, 0, 0], color = '#c4b8a6', roughness = 0.75 }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={0.1} />
    </mesh>
  )
}

function Fountain() {
  return (
    <group>
      {/* Base plinth */}
      <StoneBlock size={[8, 0.5, 8]} position={[0, 0.25, 0]} color="#9a856b" roughness={0.85} />
      <StoneBlock size={[6.6, 0.7, 6.6]} position={[0, 0.85, 0]} color="#b39b7c" />
      <BlockWater size={[6.2, 0.2, 6.2]} position={[0, 1.05, 0]} color="#63c4f1" />

      {/* Middle tier */}
      <StoneBlock size={[4.2, 0.6, 4.2]} position={[0, 1.7, 0]} color="#cfc0a9" roughness={0.72} />
      <StoneBlock size={[3.5, 0.9, 3.5]} position={[0, 2.3, 0]} color="#d6c7b3" roughness={0.68} />
      <BlockWater size={[3.2, 0.18, 3.2]} position={[0, 2.55, 0]} color="#6fd8ff" />

      {/* Upper tier */}
      <StoneBlock size={[1.8, 0.5, 1.8]} position={[0, 3.05, 0]} color="#dccfba" roughness={0.62} />
      <StoneBlock size={[1.2, 0.9, 1.2]} position={[0, 3.65, 0]} color="#e7dcc6" roughness={0.58} />
      <BlockWater size={[1.0, 0.16, 1.0]} position={[0, 3.9, 0]} color="#84eaff" />

      {/* Finial */}
      <StoneBlock size={[0.8, 1.1, 0.8]} position={[0, 4.55, 0]} color="#f0e4cd" roughness={0.55} />
    </group>
  )
}

export default Fountain

