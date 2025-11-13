import React, { useMemo } from 'react'
import * as THREE from 'three'
import SnowGlobe from './SnowGlobe'
import Fountain from './city/Fountain'
import VegetationRing from './city/VegetationRing'

const WINDOW_DAY_COLOR = '#4a90e2' // Reflective blue for daytime
const WINDOW_NIGHT_COLOR = '#0b1623'
const WINDOW_GLOW_COLOR = '#c9f1ff'

function RectangularWindows({
  width,
  depth,
  height,
  baseY = 0,
  inset = 0.5,
  isNight = false,
  segmentBias = 1
}) {
  if (!width || !depth || !height) return null
  if (width <= 0.6 || depth <= 0.6 || height <= 1) return null

  const rows = Math.max(2, Math.floor((height / 2.6) * segmentBias))
  const colsWidth = Math.max(2, Math.floor((width / 1.4) * segmentBias))
  const colsDepth = Math.max(2, Math.floor((depth / 1.4) * segmentBias))

  const verticalPadding = Math.min(height * 0.18, 1.4)
  const usableHeight = Math.max(height - verticalPadding * 2, 0.5)
  const windowHeight = usableHeight / rows * 0.6
  const verticalStep =
    rows > 1 ? (usableHeight - windowHeight) / (rows - 1) : 0
  const maxY = baseY + height - Math.min(height * 0.08, 0.35)

  const windowMaterialProps = {
    color: isNight ? WINDOW_NIGHT_COLOR : WINDOW_DAY_COLOR,
    emissive: isNight ? WINDOW_GLOW_COLOR : '#09101b',
    emissiveIntensity: isNight ? 1.45 : 0.08,
    metalness: isNight ? 0.35 : 0.85, // Higher metalness for reflective blue during day
    roughness: isNight ? 0.25 : 0.1, // Lower roughness for more reflection during day
    toneMapped: false
  }

  const createSide = (side) => {
    const isWidthSide = side === 'front' || side === 'back'
    const span = isWidthSide ? width : depth
    const columns = isWidthSide ? colsWidth : colsDepth
    if (span <= 0.4 || columns <= 0) return null

    const horizontalPadding = Math.min(span * 0.14, 1)
    const usableSpan = Math.max(span - horizontalPadding * 2, 0.4)
    const windowWidth = usableSpan / columns * 0.55
    const horizontalStep =
      columns > 1 ? (usableSpan - windowWidth) / (columns - 1) : 0

    const windows = []
    for (let row = 0; row < rows; row++) {
      const y =
        baseY +
        verticalPadding +
        windowHeight / 2 +
        row * (windowHeight + verticalStep)
      if (y + windowHeight / 2 > maxY) continue
      for (let col = 0; col < columns; col++) {
        const offset =
          -span / 2 +
          horizontalPadding +
          windowWidth / 2 +
          col * (windowWidth + horizontalStep)
        let position = [0, y, 0]
        let rotation = [0, 0, 0]
        if (side === 'front') {
          position = [offset, y, depth / 2 + 0.02]
        } else if (side === 'back') {
          position = [offset, y, -depth / 2 - 0.02]
          rotation = [0, Math.PI, 0]
        } else if (side === 'left') {
          position = [-width / 2 - 0.02, y, offset]
          rotation = [0, -Math.PI / 2, 0]
        } else if (side === 'right') {
          position = [width / 2 + 0.02, y, offset]
          rotation = [0, Math.PI / 2, 0]
        }
        windows.push(
          <mesh
            key={`${side}-window-${row}-${col}`}
            position={position}
            rotation={rotation}
            castShadow={false}
            receiveShadow={false}
          >
            <planeGeometry args={[windowWidth, windowHeight]} />
            <meshStandardMaterial {...windowMaterialProps} />
          </mesh>
        )
      }
    }
    return windows
  }

  return (
    <>
      {createSide('front')}
      {createSide('back')}
      {createSide('left')}
      {createSide('right')}
    </>
  )
}

function CylinderWindows({ radius, height, baseY = 0, isNight = false }) {
  if (!radius || radius <= 0.3 || !height || height <= 1) return null

  const circumference = 2 * Math.PI * radius
  const columns = Math.max(8, Math.floor(circumference / 1.1))
  const rows = Math.max(2, Math.floor(height / 2.4))
  const verticalPadding = Math.min(height * 0.18, 1.2)
  const usableHeight = Math.max(height - verticalPadding * 2, 0.5)
  const windowHeight = usableHeight / rows * 0.58
  const verticalStep =
    rows > 1 ? (usableHeight - windowHeight) / (rows - 1) : 0
  const windowWidth = Math.min(circumference / columns * 0.42, 1.4)
  const maxY = baseY + height - Math.min(height * 0.08, 0.3)

  const windowMaterialProps = {
    color: isNight ? WINDOW_NIGHT_COLOR : WINDOW_DAY_COLOR,
    emissive: isNight ? WINDOW_GLOW_COLOR : '#09101b',
    emissiveIntensity: isNight ? 1.35 : 0.07,
    metalness: isNight ? 0.3 : 0.85, // Higher metalness for reflective blue during day
    roughness: isNight ? 0.3 : 0.1, // Lower roughness for more reflection during day
    side: THREE.DoubleSide,
    toneMapped: false
  }

  const windows = []
  for (let row = 0; row < rows; row++) {
    const y =
      baseY +
      verticalPadding +
      windowHeight / 2 +
      row * (windowHeight + verticalStep)
    if (y + windowHeight / 2 > maxY) continue
    for (let col = 0; col < columns; col++) {
      const angle = (col / columns) * Math.PI * 2
      const x = Math.cos(angle) * (radius + 0.03)
      const z = Math.sin(angle) * (radius + 0.03)
      windows.push(
        <mesh
          key={`cyl-window-${row}-${col}`}
          position={[x, y, z]}
          rotation={[0, angle + Math.PI / 2, 0]}
          castShadow={false}
          receiveShadow={false}
        >
          <planeGeometry args={[windowWidth, windowHeight]} />
          <meshStandardMaterial {...windowMaterialProps} />
        </mesh>
      )
    }
  }
  return <>{windows}</>
}

function Building({
  basePosition,
  height,
  width,
  depth,
  color,
  accentColor = '#ececec',
  shape = 'box',
  isNight = false
}) {
  const [x, baseY = 0, z] = basePosition
  const centerHeight = height / 2
  const primaryColor = color
  const secondaryColor = accentColor

  if (shape === 'cylinder') {
    const radius = Math.max(width, depth) / 2
    return (
      <group position={[x, baseY, z]}>
        <mesh position={[0, centerHeight, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[radius, radius * 0.95, height, 24]} />
          <meshStandardMaterial color={primaryColor} metalness={0.2} roughness={0.6} />
        </mesh>
        <CylinderWindows radius={radius} height={height} isNight={isNight} />
      </group>
    )
  }

  if (shape === 'tapered') {
    return (
      <group position={[x, baseY, z]}>
        <mesh position={[0, height * 0.35, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, height * 0.7, depth]} />
          <meshStandardMaterial color={primaryColor} roughness={0.65} />
        </mesh>
        <mesh position={[0, height * 0.8, 0]} castShadow receiveShadow>
          <boxGeometry args={[width * 0.6, height * 0.4, depth * 0.6]} />
          <meshStandardMaterial color={secondaryColor} roughness={0.5} />
        </mesh>
        <mesh position={[0, height * 1.05, 0]} castShadow>
          <boxGeometry args={[width * 0.3, height * 0.1, depth * 0.3]} />
          <meshStandardMaterial color={secondaryColor} metalness={0.2} roughness={0.4} />
        </mesh>
        <RectangularWindows
          width={width}
          depth={depth}
          height={height * 0.7}
          isNight={isNight}
        />
        <RectangularWindows
          width={width * 0.6}
          depth={depth * 0.6}
          height={height * 0.4}
          baseY={height * 0.6}
          isNight={isNight}
          inset={0.3}
          segmentBias={0.8}
        />
      </group>
    )
  }

  if (shape === 'spire') {
    const radius = Math.max(width, depth) / 2
    const baseHeight = height * 0.65
    const spireHeight = height - baseHeight
    return (
      <group position={[x, baseY, z]}>
        <mesh position={[0, baseHeight / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[width * 1.05, baseHeight, depth * 1.05]} />
          <meshStandardMaterial color={primaryColor} roughness={0.55} />
        </mesh>
        <mesh position={[0, baseHeight, 0]} castShadow>
          <cylinderGeometry args={[radius * 0.6, radius * 0.95, baseHeight * 0.4, 24]} />
          <meshStandardMaterial color={secondaryColor} roughness={0.4} metalness={0.25} />
        </mesh>
        <mesh position={[0, baseHeight + spireHeight / 2, 0]} castShadow>
          <coneGeometry args={[radius * 0.4, spireHeight, 24]} />
          <meshStandardMaterial color={secondaryColor} metalness={0.35} roughness={0.3} />
        </mesh>
        <RectangularWindows
          width={width * 1.05}
          depth={depth * 1.05}
          height={baseHeight}
          isNight={isNight}
          inset={0.45}
        />
      </group>
    )
  }

  if (shape === 'megaSpire') {
    const radius = Math.max(width, depth) / 2
    const baseHeight = height * 0.55
    const midHeight = height * 0.25
    const tipHeight = height - baseHeight - midHeight
    return (
      <group position={[x, baseY, z]}>
        <mesh position={[0, baseHeight / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[radius * 1.3, radius * 1.4, baseHeight, 32]} />
          <meshStandardMaterial color={primaryColor} roughness={0.45} metalness={0.35} />
        </mesh>
        <mesh position={[0, baseHeight + midHeight / 2, 0]} castShadow>
          <cylinderGeometry args={[radius * 0.9, radius * 1.1, midHeight, 28]} />
          <meshStandardMaterial color={secondaryColor} metalness={0.4} roughness={0.3} />
        </mesh>
        <mesh position={[0, baseHeight + midHeight + tipHeight / 2, 0]} castShadow>
          <coneGeometry args={[radius * 0.45, tipHeight, 32]} />
          <meshStandardMaterial color={secondaryColor} metalness={0.5} roughness={0.25} />
        </mesh>
        <CylinderWindows
          radius={radius * 1.4}
          height={baseHeight}
          isNight={isNight}
        />
      </group>
    )
  }

  if (shape === 'tower') {
    const baseHeight = height * 0.6
    const towerHeight = height * 0.3
    const spireHeight = height - baseHeight - towerHeight
    return (
      <group position={[x, baseY, z]}>
        <mesh position={[0, baseHeight / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[width * 0.45, width * 0.6, baseHeight, 18]} />
          <meshStandardMaterial color={primaryColor} roughness={0.55} />
        </mesh>
        <mesh position={[0, baseHeight + towerHeight / 2, 0]} castShadow>
          <boxGeometry args={[width * 0.6, towerHeight, depth * 0.6]} />
          <meshStandardMaterial color={secondaryColor} roughness={0.4} />
        </mesh>
        <mesh position={[0, baseHeight + towerHeight + spireHeight / 2, 0]} castShadow>
          <coneGeometry args={[width * 0.25, spireHeight, 16]} />
          <meshStandardMaterial color={secondaryColor} metalness={0.3} roughness={0.35} />
        </mesh>
        <CylinderWindows
          radius={width * 0.6}
          height={baseHeight}
          isNight={isNight}
        />
        <RectangularWindows
          width={width * 0.6}
          depth={depth * 0.6}
          height={towerHeight}
          baseY={baseHeight}
          isNight={isNight}
        />
      </group>
    )
  }

  if (shape === 'ellipsoid') {
    return (
      <group position={[x, baseY, z]}>
        <mesh position={[0, height / 2, 0]} castShadow receiveShadow scale={[1, height / width, 1]}>
          <sphereGeometry args={[width / 2, 24, 24]} />
          <meshStandardMaterial color={primaryColor} roughness={0.5} metalness={0.25} />
        </mesh>
        <CylinderWindows
          radius={(width / 2) * 0.95}
          height={height * 0.8}
          baseY={height * 0.1}
          isNight={isNight}
        />
      </group>
    )
  }

  return (
    <group position={[x, baseY, z]}>
      <mesh position={[0, centerHeight, 0]} castShadow receiveShadow>
      <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={primaryColor} roughness={0.65} />
      </mesh>
      <RectangularWindows width={width} depth={depth} height={height} isNight={isNight} />
    </group>
  )
}

function Bench({ position, rotation }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.2, 0.6]} />
        <meshStandardMaterial color="#8b5a2b" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.9, -0.25]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.45, 0.15]} />
        <meshStandardMaterial color="#7a4a1f" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.65, -0.28]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.1, 0.2]} />
        <meshStandardMaterial color="#73411a" roughness={0.65} />
      </mesh>
      <mesh position={[1.05, 0.2, -0.2]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.4, 0.4]} />
        <meshStandardMaterial color="#5c3714" roughness={0.7} />
      </mesh>
      <mesh position={[-1.05, 0.2, -0.2]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.4, 0.4]} />
        <meshStandardMaterial color="#5c3714" roughness={0.7} />
    </mesh>
    </group>
  )
}

function LandmarkModel({ data }) {
  const {
    landmarkKey,
    basePosition,
    height,
    width,
    depth,
    color,
    accentColor,
    shape
  } = data
  const [x = 0, baseY = 0, z = 0] = basePosition || [0, 0, 0]

  const standardMaterial = (tone = color, rough = 0.45, metal = 0.25) => (
    <meshStandardMaterial color={tone} roughness={rough} metalness={metal} />
  )

  switch (landmarkKey) {
    case 'landmark-oneworld':
      return (
        <group position={[x, baseY, z]}>
          <mesh position={[0, height * 0.18, 0]}>
            <boxGeometry args={[width * 2.4, height * 0.36, depth * 2.4]} />
            {standardMaterial(color, 0.5, 0.2)}
          </mesh>
          <mesh position={[0, height * 0.48, 0]}>
            <boxGeometry args={[width * 1.8, height * 0.34, depth * 1.8]} />
            {standardMaterial(accentColor, 0.35, 0.3)}
          </mesh>
          <mesh position={[0, height * 0.74, 0]}>
            <boxGeometry args={[width * 1.2, height * 0.32, depth * 1.2]} />
            {standardMaterial(color, 0.4, 0.35)}
          </mesh>
          <mesh position={[0, height * 0.93, 0]}>
            <cylinderGeometry args={[width * 0.4, width * 0.8, height * 0.18, 12]} />
            {standardMaterial(accentColor, 0.25, 0.45)}
          </mesh>
          <mesh position={[0, height * 1.08, 0]}>
            <coneGeometry args={[width * 0.4, height * 0.22, 16]} />
            {standardMaterial('#d9eefc', 0.2, 0.5)}
          </mesh>
        </group>
      )
    case 'landmark-empire':
      return (
        <group position={[x, baseY, z]}>
          <mesh position={[0, height * 0.18, 0]}>
            <boxGeometry args={[width * 1.9, height * 0.36, depth * 1.9]} />
            {standardMaterial(color, 0.55, 0.2)}
          </mesh>
          <mesh position={[0, height * 0.45, 0]}>
            <boxGeometry args={[width * 1.5, height * 0.32, depth * 1.5]} />
            {standardMaterial(accentColor, 0.45, 0.25)}
          </mesh>
          <mesh position={[0, height * 0.68, 0]}>
            <boxGeometry args={[width * 1.1, height * 0.26, depth * 1.1]} />
            {standardMaterial(color, 0.4, 0.35)}
          </mesh>
          <mesh position={[0, height * 0.86, 0]}>
            <boxGeometry args={[width * 0.9, height * 0.18, depth * 0.9]} />
            {standardMaterial(accentColor, 0.35, 0.3)}
          </mesh>
          <mesh position={[0, height * 0.97, 0]}>
            <coneGeometry args={[width * 0.35, height * 0.26, 8]} />
            {standardMaterial('#f1f1f1', 0.2, 0.4)}
          </mesh>
          <mesh position={[0, height * 1.1, 0]}>
            <coneGeometry args={[width * 0.2, height * 0.22, 6]} />
            {standardMaterial('#dbe4f5', 0.15, 0.45)}
          </mesh>
        </group>
      )
    case 'landmark-shard':
      return (
        <group position={[x, baseY, z]}>
          <mesh position={[0, height * 0.6, 0]}>
            <coneGeometry args={[width * 1.1, height * 1.2, 6, 1, true]} />
            {standardMaterial(color, 0.25, 0.4)}
          </mesh>
          <mesh position={[0, height * 0.2, 0]} rotation={[0, Math.PI / 4, 0]}>
            <boxGeometry args={[width * 0.7, height * 0.4, depth * 0.7]} />
            {standardMaterial(accentColor, 0.3, 0.35)}
          </mesh>
        </group>
      )
    case 'landmark-gherkin':
      return (
        <group position={[x, baseY, z]}>
          <mesh position={[0, height * 0.5, 0]} scale={[width * 0.6, height * 0.018, depth * 0.6]}>
            <sphereGeometry args={[10, 24, 24]} />
            {standardMaterial(color, 0.4, 0.35)}
          </mesh>
          <mesh position={[0, height * 0.95, 0]} scale={[width * 0.35, height * 0.01, depth * 0.35]}>
            <sphereGeometry args={[10, 16, 16]} />
            {standardMaterial(accentColor, 0.35, 0.3)}
          </mesh>
        </group>
      )
    case 'landmark-eiffel':
      return (
        <group position={[x, baseY, z]}>
          {[-1, 1].map((sx) =>
            [-1, 1].map((sz) => (
              <mesh key={`leg-${sx}-${sz}`} position={[sx * width * 0.6, height * 0.2, sz * depth * 0.6]}>
                <cylinderGeometry args={[width * 0.12, width * 0.3, height * 0.4, 8]} />
                {standardMaterial(color, 0.55, 0.2)}
              </mesh>
            ))
          )}
          <mesh position={[0, height * 0.4, 0]}>
            <boxGeometry args={[width * 1.1, height * 0.08, depth * 1.1]} />
            {standardMaterial(accentColor, 0.4, 0.3)}
          </mesh>
          <mesh position={[0, height * 0.68, 0]}>
            <cylinderGeometry args={[width * 0.25, width * 0.6, height * 0.6, 10]} />
            {standardMaterial(color, 0.5, 0.25)}
          </mesh>
          <mesh position={[0, height * 0.95, 0]}>
            <coneGeometry args={[width * 0.25, height * 0.3, 8]} />
            {standardMaterial('#f5e0b2', 0.3, 0.35)}
          </mesh>
          <mesh position={[0, height * 1.1, 0]}>
            <coneGeometry args={[width * 0.08, height * 0.2, 6]} />
            {standardMaterial('#ede1c1', 0.2, 0.4)}
          </mesh>
        </group>
      )
    case 'landmark-montparnasse':
      return (
        <group position={[x, baseY, z]}>
          <mesh position={[0, height * 0.5, 0]}>
            <boxGeometry args={[width * 1.4, height, depth * 1.4]} />
            {standardMaterial(color, 0.5, 0.25)}
          </mesh>
          <mesh position={[0, height * 1.02, 0]}>
            <boxGeometry args={[width * 1.5, height * 0.04, depth * 1.5]} />
            {standardMaterial(accentColor, 0.35, 0.3)}
          </mesh>
        </group>
      )
    case 'landmark-skytree':
      return (
        <group position={[x, baseY, z]}>
          <mesh position={[0, height * 0.25, 0]}>
            <cylinderGeometry args={[width * 1.8, width * 1.2, height * 0.5, 16]} />
            {standardMaterial(color, 0.35, 0.3)}
          </mesh>
          <mesh position={[0, height * 0.55, 0]}>
            <cylinderGeometry args={[width * 1.2, width * 1.6, height * 0.4, 12]} />
            {standardMaterial(accentColor, 0.25, 0.4)}
          </mesh>
          <mesh position={[0, height * 0.8, 0]}>
            <torusGeometry args={[width * 1.1, width * 0.1, 12, 32]} />
            {standardMaterial(color, 0.2, 0.35)}
          </mesh>
          <mesh position={[0, height * 1.05, 0]}>
            <cylinderGeometry args={[width * 0.45, width * 0.8, height * 0.5, 10]} />
            {standardMaterial(accentColor, 0.2, 0.4)}
          </mesh>
          <mesh position={[0, height * 1.28, 0]}>
            <coneGeometry args={[width * 0.32, height * 0.4, 12]} />
            {standardMaterial('#dbe9f9', 0.15, 0.45)}
          </mesh>
        </group>
      )
    case 'landmark-tvtower':
      return (
        <group position={[x, baseY, z]}>
          <mesh position={[0, height * 0.3, 0]}>
            <cylinderGeometry args={[width * 0.5, width * 1, height * 0.6, 12]} />
            {standardMaterial(color, 0.4, 0.3)}
          </mesh>
          <mesh position={[0, height * 0.8, 0]}>
            <torusGeometry args={[width * 0.9, width * 0.12, 10, 32]} />
            {standardMaterial(accentColor, 0.25, 0.35)}
          </mesh>
          <mesh position={[0, height * 1.05, 0]}>
            <cylinderGeometry args={[width * 0.3, width * 0.5, height * 0.5, 10]} />
            {standardMaterial(color, 0.3, 0.4)}
          </mesh>
          <mesh position={[0, height * 1.3, 0]}>
            <coneGeometry args={[width * 0.22, height * 0.35, 8]} />
            {standardMaterial('#f1f4fb', 0.2, 0.4)}
          </mesh>
        </group>
      )
    case 'landmark-burj':
      return (
        <group position={[x, baseY, z]}>
          <mesh position={[0, height * 0.35, 0]}>
            <cylinderGeometry args={[width * 1.8, width * 1.2, height * 0.6, 16]} />
            {standardMaterial(color, 0.3, 0.3)}
          </mesh>
          <mesh position={[0, height * 0.85, 0]}>
            <cylinderGeometry args={[width * 1, width * 0.6, height * 0.8, 12]} />
            {standardMaterial(accentColor, 0.25, 0.35)}
          </mesh>
          <mesh position={[0, height * 1.35, 0]}>
            <coneGeometry args={[width * 0.45, height * 0.9, 10]} />
            {standardMaterial('#e7f0fb', 0.2, 0.45)}
          </mesh>
          <mesh position={[width * 0.9, height * 0.4, 0]}>
            <boxGeometry args={[width * 0.4, height * 0.4, depth * 0.8]} />
            {standardMaterial(accentColor, 0.2, 0.35)}
          </mesh>
          <mesh position={[-width * 0.8, height * 0.55, -depth * 0.5]}>
            <boxGeometry args={[width * 0.35, height * 0.3, depth * 0.6]} />
            {standardMaterial(color, 0.3, 0.3)}
          </mesh>
        </group>
      )
    case 'landmark-marina':
      return (
        <group position={[x, baseY, z]}>
          <mesh position={[0, height * 0.5, 0]}>
            <boxGeometry args={[width * 1.5, height, depth * 0.8]} />
            {standardMaterial(color, 0.35, 0.3)}
          </mesh>
          <mesh position={[width * 0.45, height * 0.55, 0]}>
            <boxGeometry args={[width * 0.4, height * 0.8, depth * 0.85]} />
            {standardMaterial(accentColor, 0.3, 0.35)}
          </mesh>
          <mesh position={[0, height * 1.05, 0]}>
            <boxGeometry args={[width * 0.9, height * 0.1, depth * 0.9]} />
            {standardMaterial('#eff5fb', 0.2, 0.4)}
          </mesh>
        </group>
      )
    default:
      return (
        <Building
          basePosition={basePosition}
          height={height}
          width={width}
          depth={depth}
          color={color}
          accentColor={accentColor}
          shape={shape}
        />
      )
  }
}

function BridgeModel({ data }) {
  const {
    start = [-6, 0.2, 0],
    end = [6, 0.2, 0],
    deckWidth = 1.5,
    deckThickness = 0.2,
    towerHeight = 0,
    towerSpacing = 6,
    archHeight = 0,
    color = '#c8c1b3',
    cableColor = '#e5e1d8'
  } = data || {}

  const startVec = useMemo(() => new THREE.Vector3(...start), [start])
  const endVec = useMemo(() => new THREE.Vector3(...end), [end])
  const center = useMemo(() => startVec.clone().add(endVec).multiplyScalar(0.5), [startVec, endVec])
  const length = useMemo(() => startVec.distanceTo(endVec), [startVec, endVec])
  const rotationY = useMemo(
    () => Math.atan2(endVec.x - startVec.x, endVec.z - startVec.z),
    [startVec, endVec]
  )
  const deckY = useMemo(() => (startVec.y + endVec.y) / 2, [startVec, endVec])

  const guardHeight = Math.max(0.35, deckWidth * 0.28)
  const towerOffset = Math.max(0, Math.min(towerSpacing, length / 2 - deckWidth * 0.4))

  return (
    <group position={[center.x, 0, center.z]} rotation={[0, rotationY, 0]}>
      {/* Deck */}
      <mesh position={[0, deckY, 0]} castShadow receiveShadow>
        <boxGeometry args={[length + deckWidth * 0.2, deckThickness, deckWidth]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.25} />
      </mesh>

      {/* Guard rails */}
      {[1, -1].map((side) => (
        <mesh
          key={`rail-${side}`}
          position={[0, deckY + guardHeight / 2 + deckThickness * 0.5, (deckWidth / 2) * side]}
        >
          <boxGeometry args={[length + deckWidth * 0.1, guardHeight, deckThickness * 0.2]} />
          <meshStandardMaterial color={cableColor} roughness={0.4} metalness={0.2} />
        </mesh>
      ))}

      {/* Towers */}
      {towerHeight > 0 && towerOffset > 0 && (
        <>
          {[1, -1].map((side) => (
            <mesh
              key={`tower-${side}`}
              position={[side * towerOffset, deckY + towerHeight / 2, 0]}
            >
              <boxGeometry args={[deckWidth * 0.5, towerHeight, deckThickness * 1.4]} />
              <meshStandardMaterial color={color} roughness={0.35} metalness={0.3} />
            </mesh>
          ))}

          {/* Suspension cables */}
          {[1, -1].map((side) => (
            <mesh
              key={`cable-${side}`}
              position={[side * towerOffset, deckY + towerHeight, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[deckThickness * 0.12, deckThickness * 0.12, deckWidth * 1.6, 8]} />
              <meshStandardMaterial color={cableColor} roughness={0.25} metalness={0.35} />
            </mesh>
          ))}
        </>
      )}

      {/* Arch */}
      {archHeight > 0 && (
        <mesh position={[0, deckY + archHeight / 2, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[length / 2, deckThickness * 0.35, 12, 48, Math.PI]} />
          <meshStandardMaterial color={color} roughness={0.35} metalness={0.25} />
    </mesh>
      )}
    </group>
  )
}

function LightPost({ position = [0, 0, 0], isNight }) {
  const [x, y, z] = position
  const poleHeight = 2.8
  const lampColor = isNight ? '#ffe9b0' : '#b5c6ff'
  return (
    <group position={[x, y, z]}>
      <mesh castShadow receiveShadow position={[0, poleHeight / 2, 0]}>
        <cylinderGeometry args={[0.08, 0.1, poleHeight, 10]} />
        <meshStandardMaterial color="#40444d" roughness={0.6} metalness={0.35} />
      </mesh>
      <mesh castShadow position={[0, poleHeight + 0.3, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial
          color={lampColor}
          emissive={isNight ? lampColor : '#000000'}
          emissiveIntensity={isNight ? 1.6 : 0.1}
          roughness={0.35}
          metalness={0.1}
        />
      </mesh>
      <pointLight
        position={[0, poleHeight + 0.3, 0]}
        intensity={isNight ? 1.4 : 0}
        distance={8}
        color={lampColor}
        decay={2}
      />
    </group>
  )
}

function City({ profile = {}, cityName = 'City', extraElements = null, isNight = false, windDirection = 0, windSpeed = 0 }) {
  // Generate random buildings
  const cityLayout = useMemo(() => {
    const {
      gridSize = 8,
      spacing = 8,
      heightRange = [8, 18],
      widthRange = [2.8, 4.8],
      depthRange = [2.8, 4.8],
      highRiseProbability = 0.3,
      highRiseMultiplier = 2,
      midRiseProbability = 0.4,
      lowRiseProbability = 0.2,
      colorPalette = ['#8B8B8B', '#A9A9A9', '#778899', '#696969'],
      accentPalette = ['#d9d9d9', '#bfbfbf'],
      centralClearance = 2,
      shapeOptions = ['box', 'tapered', 'cylinder'],
      landmarks = [],
      bridges = [],
      maxCityRadius = 45
    } = profile || {}

    const randomBetween = (min, max) => Math.random() * (max - min) + min
    const pick = (array, fallback) =>
      array && array.length ? array[Math.floor(Math.random() * array.length)] : fallback

    const regularBuildings = []
    
    const fountainExclusionRadius = 12
    const vegetationInnerRadius = 13.5
    const vegetationOuterRadius = 19
    
    for (let x = -gridSize; x <= gridSize; x++) {
      for (let z = -gridSize; z <= gridSize; z++) {
        if (Math.abs(x) < centralClearance && Math.abs(z) < centralClearance) continue

        const worldX = x * spacing
        const worldZ = z * spacing
        const distanceFromCenter = Math.sqrt(worldX * worldX + worldZ * worldZ)

        const skipForFountain =
          distanceFromCenter < fountainExclusionRadius ||
          distanceFromCenter < fountainExclusionRadius + spacing * 0.35

        if (skipForFountain) continue

        const nearLandmark = (landmarks || []).some((landmark) => {
          const dx = worldX - landmark.basePosition[0]
          const dz = worldZ - landmark.basePosition[2]
          const distance = Math.sqrt(dx * dx + dz * dz)
          const exclusionRadius = Math.max(landmark.width, landmark.depth) * 1.2
          return distance < exclusionRadius + spacing * 0.4
        })
        if (nearLandmark) continue

        let height = randomBetween(heightRange[0], heightRange[1])
        const roll = Math.random()
        if (roll < highRiseProbability) {
          height *= highRiseMultiplier
        } else if (roll > 1 - lowRiseProbability) {
          height *= 0.6
        } else if (roll < highRiseProbability + midRiseProbability) {
          height *= 1.25
        }

        const highRise = height > heightRange[1] * 1.2

        const width = randomBetween(widthRange[0], widthRange[1]) * (highRise ? 0.85 : 1)
        const depth = randomBetween(depthRange[0], depthRange[1]) * (highRise ? 0.85 : 1)

        const footprint = Math.max(width, depth) * 0.5
        const innerSafeRadius = vegetationInnerRadius - footprint - spacing * 0.25
        const outerSafeRadius = vegetationOuterRadius + footprint + spacing * 0.35
        if (
          distanceFromCenter > innerSafeRadius &&
          distanceFromCenter < outerSafeRadius
        ) {
          continue
        }

        const safetyMargin = Math.max(width, depth) * 0.7
        if (distanceFromCenter + safetyMargin > maxCityRadius) continue

        const shape = pick(shapeOptions, 'box')
        const color = pick(colorPalette, '#8B8B8B')
        const accentColor = pick(accentPalette, '#d9d9d9')
        
        regularBuildings.push({
          basePosition: [worldX, 0, worldZ],
          height,
          width,
          depth,
          color,
          accentColor,
          shape,
          footprintRadius: Math.max(width, depth) * 0.5,
          key: `building-${x}-${z}`,
          distanceFromCenter
        })
      }
    }

    const landmarkEntries = (landmarks || [])
      .map((landmark, index) => {
      const width = landmark.width
      const depth = landmark.depth
        const distanceFromCenter = Math.sqrt(
          (landmark.basePosition?.[0] || 0) ** 2 + (landmark.basePosition?.[2] || 0) ** 2
        )
        const safetyMargin = Math.max(width, depth) * 0.6
        if (distanceFromCenter + safetyMargin > maxCityRadius) return null
        const footprint = Math.max(width, depth) * 0.5
        const intersectsVegetationRing =
          distanceFromCenter - footprint < vegetationOuterRadius &&
          distanceFromCenter + footprint > vegetationInnerRadius
        if (distanceFromCenter - footprint <= fountainExclusionRadius || intersectsVegetationRing)
          return null
        return {
          basePosition: landmark.basePosition,
          height: landmark.height,
          width,
          depth,
          color: landmark.color,
          accentColor: landmark.accentColor,
          shape: landmark.shape || 'box',
          footprintRadius: Math.max(width, depth) * 0.55,
          key: landmark.key || `landmark-${index}`,
          isLandmark: true,
          landmarkKey: landmark.key || `landmark-${index}`
        }
      })
      .filter(Boolean)
    
    const totalLimit = 35
    const availableSlots = Math.max(0, totalLimit - landmarkEntries.length)
    const trimmedRegular = regularBuildings
      .sort((a, b) => a.distanceFromCenter - b.distanceFromCenter)
      .slice(0, availableSlots)
      .map(({ distanceFromCenter: _distance, ...rest }) => rest)

    const forbiddenCenterRadius = Math.max(
      vegetationOuterRadius + spacing * 0.5,
      fountainExclusionRadius + spacing
    )

    return {
      buildings: [...trimmedRegular, ...landmarkEntries],
      landmarks: landmarkEntries,
      bridges: (bridges || [])
        .map((bridge, index) => {
          const start = bridge.start || [0, 0, 0]
          const end = bridge.end || [0, 0, 0]
          const startRadius = Math.sqrt(start[0] * start[0] + start[2] * start[2])
          const endRadius = Math.sqrt(end[0] * end[0] + end[2] * end[2])
          const centerRadius = Math.sqrt(
            ((start[0] + end[0]) / 2) ** 2 + ((start[2] + end[2]) / 2) ** 2
          )
          const margin = (bridge.deckWidth || 2) * 0.9

          const intersectsCore =
            startRadius < forbiddenCenterRadius + margin ||
            endRadius < forbiddenCenterRadius + margin ||
            centerRadius < forbiddenCenterRadius + margin
          const exceedsDome =
            startRadius + margin > maxCityRadius || endRadius + margin > maxCityRadius

          if (intersectsCore || exceedsDome) {
            return null
          }

          return {
            ...bridge,
            key: bridge.key || `bridge-${index}`
          }
        })
        .filter(Boolean)
    }
  }, [profile])

  const generatedBuildings = cityLayout.buildings || []
  const generatedBridges = cityLayout.bridges || []

  const benches = useMemo(
    () => [
      {
        position: [7, 0.25, 0],
        rotation: [0, -Math.PI / 2, 0]
      },
      {
        position: [-7, 0.25, 0],
        rotation: [0, Math.PI / 2, 0]
      },
      {
        position: [0, 0.25, 7],
        rotation: [0, Math.PI, 0]
      },
      {
        position: [0, 0.25, -7],
        rotation: [0, 0, 0]
      }
    ],
    []
  )

  const trees = useMemo(() => {
    const treeArray = []
    const treeCount = 16
    const baseRadius = 16
    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2
      const radius = baseRadius + (Math.random() - 0.5) * 1.5
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const minDistanceToBuilding = generatedBuildings.reduce((min, building) => {
        const dx = x - building.basePosition[0]
        const dz = z - building.basePosition[2]
        const footprint =
          (building.footprintRadius || Math.max(building.width, building.depth) * 0.5) + 1
        const distance = Math.sqrt(dx * dx + dz * dz) - footprint
        return Math.min(min, distance)
      }, Infinity)
      if (minDistanceToBuilding < 1.5) continue
      const trunkHeight = 2.4 + Math.random() * 1.2
      const foliageScale = 2 + Math.random() * 0.8
      treeArray.push({
        position: [x, 0, z],
        trunkHeight,
        foliageScale,
        key: `tree-${i}`
      })
    }
    return treeArray
  }, [generatedBuildings])

  const bushes = useMemo(() => {
    const bushArray = []
    const bushCount = 20
    const baseRadius = 13.5
    for (let i = 0; i < bushCount; i++) {
      const angle = (i / bushCount) * Math.PI * 2 + Math.random() * 0.15
      const radius = baseRadius + (Math.random() - 0.5) * 0.8
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const minDistanceToBuilding = generatedBuildings.reduce((min, building) => {
        const dx = x - building.basePosition[0]
        const dz = z - building.basePosition[2]
        const footprint =
          (building.footprintRadius || Math.max(building.width, building.depth) * 0.5) + 0.7
        const distance = Math.sqrt(dx * dx + dz * dz) - footprint
        return Math.min(min, distance)
      }, Infinity)
      if (minDistanceToBuilding < 1.5) continue
      const scale = 0.9 + Math.random() * 0.5
      bushArray.push({
        position: [x, 0.4, z],
        scale,
        key: `bush-${i}`
      })
    }
    return bushArray
  }, [generatedBuildings])

  return (
    <SnowGlobe cityName={cityName}>
      <group position={[0, 0.02, 0]}>
        {generatedBuildings.map((building) =>
          building.isLandmark ? (
            <LandmarkModel key={building.key} data={building} />
          ) : (
        <Building
          key={building.key}
            basePosition={building.basePosition}
          height={building.height}
          width={building.width}
          depth={building.depth}
          color={building.color}
            accentColor={building.accentColor}
            shape={building.shape}
            isNight={isNight}
        />
          )
        )}
      
      {/* Central plaza */}
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <cylinderGeometry args={[12, 12, 0.2, 32]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
      
      {/* Fountain */}
        <Fountain />

        {/* Benches */}
        {benches.map((bench, index) => (
          <Bench key={`bench-${index}`} position={bench.position} rotation={bench.rotation} />
        ))}

        {/* Vegetation */}
        <VegetationRing trees={trees} bushes={bushes} windDirection={windDirection} windSpeed={windSpeed} />

        {/* Light posts */}
        {[
          [5.2, 0, 5.2],
          [-5.2, 0, 5.2],
          [-5.2, 0, -5.2],
          [5.2, 0, -5.2]
        ].map((pos, index) => (
          <LightPost key={`lightpost-${index}`} position={pos} isNight={isNight} />
        ))}

        {/* Bridges */}
        {generatedBridges.map((bridge) => (
          <BridgeModel key={bridge.key} data={bridge} />
        ))}
        {extraElements}
    </group>
    </SnowGlobe>
  )
}

export default City
