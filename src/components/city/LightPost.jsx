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
/**
 * The lantern's outline, from the neck where it meets the collar to the rim
 * the cap sits on.
 *
 * An onion, or an acorn: narrow at the neck, swelling to its widest a third
 * of the way up, then a long curve in to a small shoulder. Two straight
 * tapers were doing this before, one out and one in, and a pair of cones
 * meeting at their wide ends reads as a lampshade on a funnel. The whole
 * character of a cast iron lantern is in this curve.
 *
 * [radius, height], in park units, which read as metres.
 */
const LANTERN_OUTLINE = [
  [0.09, 0],
  [0.165, 0.045],
  [0.225, 0.105],
  [0.258, 0.185],
  [0.262, 0.26],
  [0.25, 0.34],
  [0.224, 0.42],
  [0.187, 0.49],
  [0.142, 0.55],
  [0.1, 0.6],
  [0.075, 0.63]
]

const LANTERN_HEIGHT = LANTERN_OUTLINE[LANTERN_OUTLINE.length - 1][1]
/** How far the glass stands out at its widest, for the collar under it. */
const SHOULDER = Math.max(...LANTERN_OUTLINE.map(([radius]) => radius))
/** Panes around the lantern, and the bars between them. */
const PANES = 8

/**
 * The glass, turned from the outline.
 *
 * A lathe is the honest way to build something that was cast on one: the
 * profile is spun, and at eight segments the facets themselves read as the
 * panes. Built once and shared by every lamp in the park.
 */
let sharedGlass = null
const glassGeometry = () => {
  if (!sharedGlass) {
    sharedGlass = new THREE.LatheGeometry(
      LANTERN_OUTLINE.map(([radius, height]) => new THREE.Vector2(radius, height)),
      PANES
    )
  }
  return sharedGlass
}

/**
 * One glazing bar, swept along the same outline.
 *
 * Straight bars up a curved lantern stand away from it at the waist and cut
 * into it at the shoulder. These follow the glass because they are the same
 * curve, which is what holds a lantern together.
 */
let sharedBar = null
const barGeometry = () => {
  if (!sharedBar) {
    const curve = new THREE.CatmullRomCurve3(
      LANTERN_OUTLINE.map(([radius, height]) => new THREE.Vector3(radius, height, 0))
    )
    sharedBar = new THREE.TubeGeometry(curve, 14, 0.011, 4, false)
  }
  return sharedBar
}

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
  const lanternMiddle = lanternBottom + LANTERN_HEIGHT * 0.38

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
      <Iron position={[0, lanternBottom - 0.02, 0]}>
        <cylinderGeometry args={[0.115, 0.085, 0.07, 12]} />
      </Iron>

      {/* The glass: the outline, spun. */}
      <mesh position={[0, lanternBottom, 0]} geometry={glassGeometry()}>
        <meshStandardMaterial {...glass} side={THREE.DoubleSide} />
      </mesh>

      {/* A bar at every corner of the panes, following the same curve. */}
      {Array.from({ length: PANES }, (unused, i) => (
        <mesh
          key={`bar-${i}`}
          castShadow
          material={iron()}
          geometry={barGeometry()}
          position={[0, lanternBottom, 0]}
          rotation={[0, (i / PANES) * Math.PI * 2, 0]}
        />
      ))}

      {/* The cap the lantern closes into: a low dome on a rim, with a small
          finial. It is a third of the width of the glass, not a lid over it. */}
      <Iron position={[0, lanternTop, 0]}>
        <cylinderGeometry args={[0.095, 0.085, 0.035, 12]} />
      </Iron>
      <Iron position={[0, lanternTop + 0.02, 0]}>
        <sphereGeometry args={[0.093, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.4]} />
      </Iron>
      <Iron position={[0, lanternTop + 0.09, 0]}>
        <sphereGeometry args={[0.032, 10, 8]} />
      </Iron>
      <Iron position={[0, lanternTop + 0.15, 0]}>
        <coneGeometry args={[0.02, 0.085, 8]} />
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
