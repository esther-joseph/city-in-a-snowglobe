import React, { useMemo } from 'react'
import PropTypes from 'prop-types'
import * as THREE from 'three'
import { getFlutedGeometry } from '../../utils/fluting'
import { standardMaterial } from '../../utils/sharedMaterial'

/**
 * A cast iron park lamp, of the kind that stands along a city park's paths.
 *
 * The old one was a mid-century street light: a tapered pole with a gooseneck
 * arm and a frosted globe hung off the end of it. This is the older thing it
 * replaced in the reference — a reeded column rising to a lantern sat on top
 * of it rather than beside it.
 *
 * What makes it read, in order of how much it matters:
 *
 *  - The lantern is on top, not on an arm. That is the whole silhouette.
 *  - It is a tapered glass cage with a domed cap and a finial, not a sphere.
 *  - The column is reeded and stands on a stepped, flared base. Cast iron is
 *    never a plain tube; the ribs are what catch a low sun.
 *
 * It is lit from inside, so at night the glass carries the glow and the iron
 * stays black against it.
 */

const IRON = '#161616'
const IRON_ROUGH = 0.44
const IRON_METAL = 0.66

/** Everything is measured from the foot, in park units, which read as metres. */
const BASE_HEIGHT = 0.46
const COLUMN_HEIGHT = 3.05
/** The lantern, in its two courses: the belly, then the shoulder under the cap. */
const BELLY_HEIGHT = 0.5
const SHOULDER_HEIGHT = 0.2
const LANTERN_HEIGHT = BELLY_HEIGHT + SHOULDER_HEIGHT
/** How far the glass stands out at its widest. */
const SHOULDER = 0.215

/** Every piece of iron on every lamp is the same iron, and says so. */
const iron = () =>
  standardMaterial({ color: IRON, roughness: IRON_ROUGH, metalness: IRON_METAL })

function Iron({ children, ...props }) {
  return (
    <mesh castShadow receiveShadow material={iron()} {...props}>
      {children}
    </mesh>
  )
}

Iron.propTypes = { children: PropTypes.node }

function LightPost({ position = [0, 0, 0], isNight }) {
  const columnGeometry = useMemo(
    () =>
      getFlutedGeometry({
        topRadius: 0.05,
        bottomRadius: 0.105,
        height: COLUMN_HEIGHT,
        // Enough ribs to read as cast rather than moulded, few enough that
        // four of these cost nothing.
        flutes: 16,
        depth: 0.16,
        fullness: 0.34,
        segmentsPerFlute: 4
      }),
    []
  )

  const collarTop = BASE_HEIGHT + COLUMN_HEIGHT
  const lanternBottom = collarTop + 0.12
  const lanternTop = lanternBottom + LANTERN_HEIGHT
  const lanternMiddle = lanternBottom + BELLY_HEIGHT * 0.55

  // The glass is lit from within rather than by the scene, so it holds its
  // colour whatever the sky is doing. By day it is a pale, almost spent
  // amber; at night it is the brightest thing in the park.
  const glass = {
    color: isNight ? '#ffd98a' : '#e9eef5',
    emissive: isNight ? '#ffb43c' : '#2a2c30',
    emissiveIntensity: isNight ? 2.4 : 0.15,
    roughness: 0.16,
    metalness: 0,
    transparent: true,
    opacity: isNight ? 0.95 : 0.55
  }

  return (
    <group position={position}>
      {/* Stepped base: a plinth, a flare, and a collar where the column
          starts. Cast iron always lands on the ground in stages. */}
      <Iron position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.3, 0.34, 0.14, 8]} />
      </Iron>
      <Iron position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.2, 0.3, 0.14, 8]} />
      </Iron>
      <Iron position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.14, 0.2, 0.16, 12]} />
      </Iron>

      {/* The reeded column. */}
      <mesh
        geometry={columnGeometry}
        material={iron()}
        position={[0, BASE_HEIGHT + COLUMN_HEIGHT / 2, 0]}
        castShadow
        receiveShadow
      />

      {/* Collar under the lantern, and the small flared cup it sits in. */}
      <Iron position={[0, collarTop + 0.03, 0]}>
        <cylinderGeometry args={[0.09, 0.075, 0.06, 12]} />
      </Iron>
      <Iron position={[0, lanternBottom + 0.02, 0]}>
        <cylinderGeometry args={[0.17, 0.1, 0.09, 12]} />
      </Iron>

      {/* The glass, in two courses: up and outward from the foot to a
          shoulder, then back in under the cap. A lantern has a belly. A
          single taper reads as a lampshade and a sphere reads as a bulb. */}
      <mesh position={[0, lanternBottom + BELLY_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[SHOULDER, 0.13, BELLY_HEIGHT, 8]} />
        <meshStandardMaterial {...glass} />
      </mesh>
      <mesh position={[0, lanternBottom + BELLY_HEIGHT + SHOULDER_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[0.165, SHOULDER, SHOULDER_HEIGHT, 8]} />
        <meshStandardMaterial {...glass} />
      </mesh>

      {/* Glazing bars up the corners of the belly, where the panes are widest.
          Eight sides, eight bars, each on a corner. */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const angle = (i / 8) * Math.PI * 2 + Math.PI / 8
        const radius = SHOULDER * 0.86
        return (
          <Iron
            key={`bar-${i}`}
            position={[
              Math.cos(angle) * radius,
              lanternBottom + BELLY_HEIGHT / 2,
              Math.sin(angle) * radius
            ]}
            rotation={[0, -angle, 0.07]}
          >
            <boxGeometry args={[0.02, BELLY_HEIGHT, 0.02]} />
          </Iron>
        )
      })}

      {/* Domed cap, its collar, and the finial on top. */}
      <Iron position={[0, lanternTop + 0.02, 0]}>
        <cylinderGeometry args={[0.19, 0.2, 0.05, 12]} />
      </Iron>
      <Iron position={[0, lanternTop + 0.05, 0]}>
        <sphereGeometry args={[0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
      </Iron>
      <Iron position={[0, lanternTop + 0.21, 0]}>
        <sphereGeometry args={[0.042, 10, 8]} />
      </Iron>
      <Iron position={[0, lanternTop + 0.29, 0]}>
        <coneGeometry args={[0.026, 0.11, 8]} />
      </Iron>

      {/* The lamp itself sits inside the glass, so the bars cast their own
          shadows across it and the glow comes from within the cage. */}
      <pointLight
        position={[0, lanternMiddle, 0]}
        intensity={isNight ? 2.1 : 0}
        distance={11}
        color="#ffdca4"
        decay={2}
      />
    </group>
  )
}

LightPost.propTypes = {
  position: PropTypes.arrayOf(PropTypes.number),
  isNight: PropTypes.bool
}

export default LightPost
