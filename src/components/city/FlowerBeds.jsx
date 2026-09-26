import React, { useLayoutEffect, useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import * as THREE from 'three'

/**
 * The plots the flower beds are planted in.
 *
 * Turned earth a little proud of the grass, and a run of low iron loops
 * around the edge: the edging a park uses to say where a bed ends, set side
 * by side so they close the circle.
 *
 * What grows in them is not here. Every flower in the park, in a bed or
 * clumped on the grass, goes through one set of instanced meshes, so this
 * draws the ground and the ironwork and nothing else.
 */

const dummy = new THREE.Object3D()

/** How high the loops stand, and how thick the iron is. */
const HOOP_RADIUS = 0.16
const HOOP_THICKNESS = 0.018

function FlowerBeds({ plots = [] }) {
  const soilRef = useRef()
  const hoopRef = useRef()

  const hoopGeometry = useMemo(
    // A half torus: a loop out of the ground and back into it.
    () => new THREE.TorusGeometry(HOOP_RADIUS, HOOP_THICKNESS, 5, 10, Math.PI),
    []
  )

  const hoops = useMemo(
    () =>
      plots.flatMap((plot) => {
        // As many loops as fit side by side around the plot, so they touch
        // rather than leaving gaps: that run of half circles meeting at the
        // ground is what a park edging is.
        const count = Math.max(8, Math.round((Math.PI * 2 * plot.radius) / (HOOP_RADIUS * 2)))
        return Array.from({ length: count }, (unused, i) => {
          const angle = (i / count) * Math.PI * 2
          return {
            position: [
              plot.at[0] + Math.cos(angle) * plot.radius,
              // Sunk a little, so the ends of the loop go into the ground
              // rather than resting on it.
              0.05,
              plot.at[1] + Math.sin(angle) * plot.radius
            ],
            // Turned to stand along the edge rather than across it.
            yaw: -angle + Math.PI / 2
          }
        })
      }),
    [plots]
  )

  useLayoutEffect(() => {
    // Written once: neither the earth nor the iron moves.
    if (soilRef.current) {
      plots.forEach((plot, index) => {
        dummy.position.set(plot.at[0], 0.09, plot.at[1])
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(plot.radius, 1, plot.radius)
        dummy.updateMatrix()
        soilRef.current.setMatrixAt(index, dummy.matrix)
      })
      soilRef.current.instanceMatrix.needsUpdate = true
      soilRef.current.computeBoundingSphere()
    }

    if (hoopRef.current) {
      hoops.forEach((hoop, index) => {
        dummy.position.set(...hoop.position)
        dummy.rotation.set(0, hoop.yaw, 0)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        hoopRef.current.setMatrixAt(index, dummy.matrix)
      })
      hoopRef.current.instanceMatrix.needsUpdate = true
      hoopRef.current.computeBoundingSphere()
    }
  }, [plots, hoops])

  if (plots.length === 0) return null

  return (
    <group>
      <instancedMesh ref={soilRef} args={[undefined, undefined, plots.length]} receiveShadow>
        <cylinderGeometry args={[1, 1, 0.06, 20]} />
        <meshStandardMaterial color="#4b3b2c" roughness={0.96} metalness={0} />
      </instancedMesh>

      {/* Black iron, and low: it is there to say where the bed ends, not to
          keep anyone out. */}
      <instancedMesh ref={hoopRef} args={[hoopGeometry, undefined, hoops.length]} castShadow>
        <meshStandardMaterial color="#14161a" roughness={0.45} metalness={0.65} />
      </instancedMesh>
    </group>
  )
}

FlowerBeds.propTypes = {
  plots: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      at: PropTypes.arrayOf(PropTypes.number).isRequired,
      radius: PropTypes.number.isRequired
    })
  )
}

export default FlowerBeds
