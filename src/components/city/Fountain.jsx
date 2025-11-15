import React from 'react'

function Tier({ radius = 1, height = 0.2, y = 0, color = '#d1c4b3', trimColor = '#bda98f' }) {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, y + height / 2, 0]}>
        <cylinderGeometry args={[radius * 1.05, radius * 1.1, height, 48]} />
        <meshStandardMaterial color={color} roughness={0.62} metalness={0.15} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, y + height + 0.04, 0]}>
        <cylinderGeometry args={[radius, radius * 0.98, 0.18, 48]} />
        <meshStandardMaterial color={color} roughness={0.58} metalness={0.12} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, y + height + 0.16, 0]}>
        <torusGeometry args={[radius * 0.98, 0.04, 24, 64]} />
        <meshStandardMaterial color={trimColor} roughness={0.45} metalness={0.25} />
      </mesh>
    </group>
  )
}

function TierWater({ radius = 1, thickness = 0.08, y = 0, color = '#6ec6ff' }) {
  return (
    <mesh position={[0, y + thickness / 2, 0]} receiveShadow>
      <cylinderGeometry args={[radius * 0.92, radius * 0.9, thickness, 48]} />
      <meshPhysicalMaterial
        color={color}
        transparent
        opacity={0.78}
        roughness={0.15}
        metalness={0.05}
        transmission={0.92}
        clearcoat={0.4}
        clearcoatRoughness={0.25}
      />
    </mesh>
  )
}

function Fountain() {
  return (
    <group>
      {/* Base plinth */}
      <Tier radius={3.5} height={0.45} y={0} color="#9f8b75" trimColor="#cdbca5" />
      <TierWater radius={3.1} thickness={0.12} y={0.45} color="#63c4f1" />

      {/* Middle tier */}
      <Tier radius={2.15} height={0.32} y={1.0} color="#d8c8b3" trimColor="#c4b39b" />
      <Tier y={1.35} radius={1.78} height={0.46} color="#e3d4c1" trimColor="#cfc0a9" />
      <TierWater radius={1.55} thickness={0.1} y={1.84} color="#6fd8ff" />

      {/* Upper tier */}
      <Tier radius={0.95} height={0.24} y={2.15} color="#e6d9c8" trimColor="#d4c4af" />
      <Tier y={2.39} radius={0.65} height={0.42} color="#f1e3d3" trimColor="#dccfba" />
      <TierWater radius={0.48} thickness={0.08} y={2.73} color="#84eaff" />

      {/* Finial */}
      <mesh castShadow position={[0, 3.1, 0]}>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial color="#f8ecda" roughness={0.5} metalness={0.2} />
      </mesh>
    </group>
  )
}

export default Fountain

