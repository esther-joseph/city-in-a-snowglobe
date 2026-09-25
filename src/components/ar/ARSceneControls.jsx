import React, { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import * as THREE from 'three'
import { Text } from '@react-three/drei'
import { createPanelGradient, roundedPanel } from '../../utils/roundedPanel'

/**
 * Controls that live inside the 3D scene rather than in the DOM.
 *
 * The dom-overlay feature the Android session relies on is an ARCore
 * extension; headset browsers (visionOS Safari, Android XR) do not composite
 * HTML into an immersive session, so without these the session has no UI at
 * all.
 *
 * It is a single column: the places to go, and the way out at the bottom.
 * Sizes are in metres and it hangs within reach rather than out at the globe,
 * because it belongs to the viewer and not to the park.
 */

/** Everything the column needs, in one place, so the panel and the text agree. */
export const BUTTON = { width: 0.26, height: 0.07, radius: 0.026, gap: 0.013 }
const BORDER = 0.006
const AMBER = '#f0bf55'
const EXIT = '#ff9a8a'

/** Where the eye is, above the origin the XR session hands us: the feet. */
export const EYE_HEIGHT = 1.6
/** How far out the column hangs. Within reach, and well inside arm's length. */
export const REACH = 0.5
/** How far below the horizon the middle of the column sits, in radians. */
export const GAZE = 0.48

/**
 * Where each button in the column goes.
 *
 * Curved, not flat. The column hangs half a metre from the eye, which is close
 * enough that a flat panel is a good deal further away at the bottom than at
 * the top and reads as a wedge. Every button is placed on an arc around the
 * eye instead and turned to face it, so they are all the same distance away
 * and all square on.
 *
 * @param {Array<{ break?: boolean }>} rows - In order, top to bottom.
 * @returns {Array<{ position: number[], rotation: number[], angle: number }>}
 */
export function columnLayout(rows) {
  const pitch = (BUTTON.height + BUTTON.gap) / REACH
  const middle = (rows.length - 1) / 2

  return rows.map((row, index) => {
    // A step of clear space before a row that asks for one.
    const angle = GAZE + (index - middle) * pitch + (row.break ? pitch * 0.3 : 0)
    return {
      angle,
      position: [0, EYE_HEIGHT - Math.sin(angle) * REACH, -Math.cos(angle) * REACH],
      // Negative: turning a face about +X by the angle it sits below the eye
      // tips it further away, not toward.
      rotation: [-angle, 0, 0]
    }
  })
}

let sharedGradient = null
const getGradient = () => {
  if (!sharedGradient) sharedGradient = createPanelGradient()
  return sharedGradient
}

function ARButton({ position, rotation, label, note, active = false, accent = AMBER, onClick }) {
  const [hovered, setHovered] = useState(false)
  const gradient = useMemo(() => getGradient(), [])

  const face = useMemo(
    () => roundedPanel({ width: BUTTON.width, height: BUTTON.height, radius: BUTTON.radius }),
    []
  )
  const edge = useMemo(
    () =>
      roundedPanel({
        width: BUTTON.width + BORDER * 2,
        height: BUTTON.height + BORDER * 2,
        radius: BUTTON.radius + BORDER
      }),
    []
  )

  const lit = active || hovered

  return (
    <group
      position={position}
      rotation={rotation}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.()
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* The edge is a second panel a hair behind, which is how a border is
          drawn without a stylesheet. */}
      <mesh geometry={edge} position={[0, 0, -0.001]}>
        <meshBasicMaterial
          color={lit ? accent : '#ffffff'}
          transparent
          opacity={lit ? 0.9 : 0.16}
          toneMapped={false}
        />
      </mesh>
      <mesh geometry={face}>
        {/* Black, and a shade lighter at the top. Unlit on purpose: a control
            that dims when the sun goes down is a control nobody can find. */}
        <meshBasicMaterial map={gradient} transparent opacity={0.94} toneMapped={false} />
      </mesh>
      <Text
        position={[0, note ? 0.011 : 0, 0.002]}
        fontSize={0.024}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        maxWidth={BUTTON.width * 0.86}
      >
        {label}
      </Text>
      {note && (
        <Text
          position={[0, -0.014, 0.002]}
          fontSize={0.014}
          color={lit ? accent : '#9aa3b4'}
          anchorX="center"
          anchorY="middle"
          maxWidth={BUTTON.width * 0.86}
        >
          {note}
        </Text>
      )}
    </group>
  )
}

ARButton.propTypes = {
  position: PropTypes.arrayOf(PropTypes.number).isRequired,
  rotation: PropTypes.arrayOf(PropTypes.number),
  label: PropTypes.string.isRequired,
  note: PropTypes.string,
  active: PropTypes.bool,
  accent: PropTypes.string,
  onClick: PropTypes.func
}

function ARSceneControls({ spots = [], activeSpot, onSelectSpot, onExit }) {
  const rows = [
    ...spots.map((spot) => ({
      key: spot.id,
      label: spot.label,
      active: spot.id === activeSpot,
      onClick: () => onSelectSpot?.(spot.id)
    })),
    // A step of clear space above it: leaving is not one of the places to go.
    { key: 'exit', label: 'Exit AR', accent: EXIT, break: true, onClick: onExit }
  ]

  const layout = columnLayout(rows)

  return (
    // The group's own origin is the viewer's feet, which is where the XR
    // origin puts it, so the eye is straight up from here.
    <group>
      {rows.map((row, index) => (
        <ARButton
          key={row.key}
          position={layout[index].position}
          rotation={layout[index].rotation}
          label={row.label}
          active={row.active}
          accent={row.accent}
          onClick={row.onClick}
        />
      ))}
    </group>
  )
}

ARSceneControls.propTypes = {
  spots: PropTypes.arrayOf(
    PropTypes.shape({ id: PropTypes.string.isRequired, label: PropTypes.string.isRequired })
  ),
  activeSpot: PropTypes.string,
  onSelectSpot: PropTypes.func,
  onExit: PropTypes.func
}

export default ARSceneControls
