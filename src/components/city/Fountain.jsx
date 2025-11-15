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
      <StoneBlock size={[4, 0.25, 4]} position={[0, 0.125, 0]} color="#9a856b" roughness={0.85} />
      <StoneBlock size={[3.3, 0.35, 3.3]} position={[0, 0.425, 0]} color="#b39b7c" />
      <BlockWater size={[3.1, 0.1, 3.1]} position={[0, 0.525, 0]} color="#63c4f1" />

      {/* Middle tier */}
      <StoneBlock size={[2.1, 0.3, 2.1]} position={[0, 0.95, 0]} color="#cfc0a9" roughness={0.72} />
      <StoneBlock size={[1.75, 0.45, 1.75]} position={[0, 1.3, 0]} color="#d6c7b3" roughness={0.68} />
      <BlockWater size={[1.6, 0.09, 1.6]} position={[0, 1.425, 0]} color="#6fd8ff" />

      {/* Upper tier */}
      <StoneBlock size={[0.9, 0.25, 0.9]} position={[0, 1.725, 0]} color="#dccfba" roughness={0.62} />
      <StoneBlock size={[0.6, 0.45, 0.6]} position={[0, 2.025, 0]} color="#e7dcc6" roughness={0.58} />
      <BlockWater size={[0.5, 0.08, 0.5]} position={[0, 2.15, 0]} color="#84eaff" />

      {/* Finial */}
      <StoneBlock size={[0.4, 0.55, 0.4]} position={[0, 2.425, 0]} color="#f0e4cd" roughness={0.55} />
      <mesh position={[0, 2.8, 0]} castShadow>
        <boxGeometry args={[0.18, 0.18, 0.18]} />
        <meshStandardMaterial
          color="#ffe9b0"
          emissive="#ffd877"
          emissiveIntensity={1.4}
          roughness={0.2}
          metalness={0.05}
        />
      </mesh>
      <pointLight
        position={[0, 2.85, 0]}
        intensity={1.2}
        distance={6}
        color="#ffd877"
        decay={2}
      />
    </group>
  )
}

export default Fountain

