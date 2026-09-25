import React, { useLayoutEffect, useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { getDaisyGeometry } from '../../utils/daisy'
import { deepen } from '../../utils/colorHarmony'

/**
 * The park's flower beds.
 *
 * A plot of turned earth, a low iron edging around it, and the planting
 * inside in rings of one colour at a time. The flowers were scattered singly
 * across three rings of the whole park before, which is not how anybody
 * plants a park.
 *
 * Everything is instanced: petals, eyes and leaves are one mesh each however
 * many flowers are planted, and so are the hoops of the edging. Six draw
 * calls for every bed in the park.
 *
 * The flowers lean in the wind with the trees, on their own phase, which is
 * most of what keeps a field of identical geometry from looking stamped. The
 * edging does not, being iron.
 */

const dummy = new THREE.Object3D()
const tint = new THREE.Color()

/** How high the loops stand, and how thick the iron is. */
const HOOP_RADIUS = 0.16
const HOOP_THICKNESS = 0.018

function FlowerBeds({ beds = [], leafColor = '#4f8c3a', windDirection = 0, windSpeed = 0 }) {
  const { petals, eye, leaves } = useMemo(() => getDaisyGeometry(), [])
  const petalRef = useRef()
  const eyeRef = useRef()
  const leafRef = useRef()
  const hoopRef = useRef()
  const soilRef = useRef()

  // Every flower in every bed, flattened, with the phase it sways on. Fixed
  // per bed so a re-render does not replant the park.
  const flowers = useMemo(
    () =>
      beds.flatMap((bed) =>
        bed.flowers.map((flower) => ({
          ...flower,
          lean: 0.05 + Math.random() * 0.07,
          phase: Math.random() * Math.PI * 2
        }))
      ),
    [beds]
  )

  // The edging: half loops standing in the ground, end to end around the
  // plot, which is what a low park fence is made of.
  const hoops = useMemo(
    () =>
      beds.flatMap((bed) => {
        // As many loops as fit side by side around the plot, so they touch
        // rather than leaving gaps: that run of half circles meeting at the
        // ground is what a park edging is.
        const count = Math.max(8, Math.round((Math.PI * 2 * bed.radius) / (HOOP_RADIUS * 2)))
        return Array.from({ length: count }, (unused, i) => {
          const angle = (i / count) * Math.PI * 2
          return {
            position: [
              bed.at[0] + Math.cos(angle) * bed.radius,
              // Sunk a little, so the ends of the loop go into the ground
              // rather than resting on it.
              0.05,
              bed.at[1] + Math.sin(angle) * bed.radius
            ],
            // Turned to stand along the edge rather than across it.
            yaw: -angle + Math.PI / 2
          }
        })
      }),
    [beds]
  )

  const hoopGeometry = useMemo(
    // A half torus: a loop out of the ground and back into it.
    () => new THREE.TorusGeometry(HOOP_RADIUS, HOOP_THICKNESS, 5, 10, Math.PI),
    []
  )

  const leaf = useMemo(() => deepen(leafColor, 0.34), [leafColor])

  const windRadians = (windDirection * Math.PI) / 180
  const windX = Math.sin(windRadians)
  const windZ = Math.cos(windRadians)
  const windStrength = Math.min(windSpeed / 15, 1)

  const writeFlowers = (time) => {
    const meshes = [petalRef.current, eyeRef.current, leafRef.current]
    if (meshes.some((mesh) => !mesh)) return

    flowers.forEach((flower, index) => {
      // A flower is a stalk: it bends rather than swaying like a branch, so
      // this is small even in a gale, and never still.
      const bend =
        flower.lean * (0.25 + windStrength) * Math.sin(time * (0.9 + windStrength) + flower.phase)

      dummy.position.set(...flower.position)
      dummy.rotation.set(-bend * windZ, flower.yaw, bend * windX)
      dummy.scale.setScalar(flower.scale)
      dummy.updateMatrix()
      meshes.forEach((mesh) => mesh.setMatrixAt(index, dummy.matrix))
    })

    meshes.forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true
    })
  }

  useLayoutEffect(() => {
    writeFlowers(0)
    if (petalRef.current) {
      flowers.forEach((flower, index) => {
        petalRef.current.setColorAt(index, tint.set(flower.color))
      })
      if (petalRef.current.instanceColor) petalRef.current.instanceColor.needsUpdate = true
    }

    // The iron and the earth are written once: neither moves.
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

    if (soilRef.current) {
      beds.forEach((bed, index) => {
        dummy.position.set(bed.at[0], 0.09, bed.at[1])
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(bed.radius, 1, bed.radius)
        dummy.updateMatrix()
        soilRef.current.setMatrixAt(index, dummy.matrix)
      })
      soilRef.current.instanceMatrix.needsUpdate = true
      soilRef.current.computeBoundingSphere()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowers, hoops, beds])

  useFrame(({ clock }) => writeFlowers(clock.getElapsedTime()))

  if (flowers.length === 0) return null

  return (
    <group>
      {/* The plot: turned earth, a little proud of the grass. */}
      <instancedMesh ref={soilRef} args={[undefined, undefined, beds.length]} receiveShadow>
        <cylinderGeometry args={[1, 1, 0.06, 20]} />
        <meshStandardMaterial color="#4b3b2c" roughness={0.96} metalness={0} />
      </instancedMesh>

      <instancedMesh
        ref={petalRef}
        args={[petals, undefined, flowers.length]}
        castShadow
        receiveShadow
      >
        {/* Petals are a single surface, so they have to be lit from both
            sides or half the flower is black from a low sun. */}
        <meshStandardMaterial
          side={THREE.DoubleSide}
          roughness={0.62}
          metalness={0}
          flatShading
        />
      </instancedMesh>

      <instancedMesh ref={eyeRef} args={[eye, undefined, flowers.length]} castShadow>
        <meshStandardMaterial
          color="#ffe9a8"
          emissive="#ffc94a"
          emissiveIntensity={0.22}
          roughness={0.55}
          flatShading
        />
      </instancedMesh>

      <instancedMesh ref={leafRef} args={[leaves, undefined, flowers.length]} receiveShadow>
        <meshStandardMaterial
          color={leaf}
          side={THREE.DoubleSide}
          roughness={0.78}
          metalness={0}
          flatShading
        />
      </instancedMesh>

      {/* The edging. Black iron, and low: it is there to say where the bed
          ends, not to keep anyone out. */}
      <instancedMesh ref={hoopRef} args={[hoopGeometry, undefined, hoops.length]} castShadow>
        <meshStandardMaterial color="#14161a" roughness={0.45} metalness={0.65} />
      </instancedMesh>
    </group>
  )
}

FlowerBeds.propTypes = {
  beds: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      at: PropTypes.arrayOf(PropTypes.number).isRequired,
      radius: PropTypes.number.isRequired,
      flowers: PropTypes.arrayOf(
        PropTypes.shape({
          position: PropTypes.arrayOf(PropTypes.number).isRequired,
          scale: PropTypes.number.isRequired,
          color: PropTypes.string.isRequired,
          yaw: PropTypes.number
        })
      ).isRequired
    })
  ),
  leafColor: PropTypes.string,
  windDirection: PropTypes.number,
  windSpeed: PropTypes.number
}

export default FlowerBeds
