import React, { useLayoutEffect, useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { getDaisyGeometry } from '../../utils/daisy'
import { deepen } from '../../utils/colorHarmony'

/**
 * The park's flowers.
 *
 * Daisies scattered over the grass in clumps of one, two or three. Petals,
 * eyes and leaves are one instanced mesh each, so the whole park of them is
 * three draw calls however many are planted, and the petals still take a
 * colour each through the instance colour buffer.
 *
 * They lean in the wind with the trees, on their own phase, which is most of
 * what keeps a field of identical geometry from looking stamped.
 */

const dummy = new THREE.Object3D()
const tint = new THREE.Color()

function Flowers({ flowers = [], leafColor = '#4f8c3a', windDirection = 0, windSpeed = 0 }) {
  const { petals, eye, leaves } = useMemo(() => getDaisyGeometry(), [])
  const petalRef = useRef()
  const eyeRef = useRef()
  const leafRef = useRef()

  // The phase each one sways on, fixed per planting so a re-render does not
  // shuffle the park.
  const planted = useMemo(
    () =>
      flowers.map((flower) => ({
        ...flower,
        lean: 0.05 + Math.random() * 0.08,
        phase: Math.random() * Math.PI * 2
      })),
    [flowers]
  )

  // A leaf the colour of the lawn is not a leaf, it is a patch of lawn.
  const leaf = useMemo(() => deepen(leafColor, 0.34), [leafColor])

  const windRadians = (windDirection * Math.PI) / 180
  const windX = Math.sin(windRadians)
  const windZ = Math.cos(windRadians)
  const windStrength = Math.min(windSpeed / 15, 1)

  const write = (time) => {
    const meshes = [petalRef.current, eyeRef.current, leafRef.current]
    if (meshes.some((mesh) => !mesh)) return

    planted.forEach((flower, index) => {
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
    write(0)
    if (!petalRef.current) return
    planted.forEach((flower, index) => {
      petalRef.current.setColorAt(index, tint.set(flower.color))
    })
    if (petalRef.current.instanceColor) petalRef.current.instanceColor.needsUpdate = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planted])

  useFrame(({ clock }) => write(clock.getElapsedTime()))

  if (planted.length === 0) return null

  return (
    <group>
      <instancedMesh
        ref={petalRef}
        args={[petals, undefined, planted.length]}
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

      <instancedMesh ref={eyeRef} args={[eye, undefined, planted.length]} castShadow>
        <meshStandardMaterial
          color="#ffe9a8"
          emissive="#ffc94a"
          emissiveIntensity={0.22}
          roughness={0.55}
          flatShading
        />
      </instancedMesh>

      <instancedMesh ref={leafRef} args={[leaves, undefined, planted.length]} receiveShadow>
        <meshStandardMaterial
          color={leaf}
          side={THREE.DoubleSide}
          roughness={0.78}
          metalness={0}
          flatShading
        />
      </instancedMesh>
    </group>
  )
}

Flowers.propTypes = {
  flowers: PropTypes.arrayOf(
    PropTypes.shape({
      position: PropTypes.arrayOf(PropTypes.number).isRequired,
      scale: PropTypes.number.isRequired,
      color: PropTypes.string.isRequired,
      yaw: PropTypes.number
    })
  ),
  leafColor: PropTypes.string,
  windDirection: PropTypes.number,
  windSpeed: PropTypes.number
}

export default Flowers
