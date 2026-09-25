import React, { useLayoutEffect, useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { getDaisyGeometry } from '../../utils/daisy'
import { deepen } from '../../utils/colorHarmony'

/**
 * The park's flowers.
 *
 * One daisy per bed, in three instanced meshes: petals, eye, leaves. Every
 * flower in the park is therefore three draw calls rather than ninety-odd,
 * and the petals still take a colour each through the instance colour buffer.
 *
 * They lean in the wind with the trees, on their own phase, which is most of
 * what keeps a field of identical geometry from looking stamped.
 */

const dummy = new THREE.Object3D()
const tint = new THREE.Color()

function FlowerBeds({ beds, leafColor = '#4f8c3a', windDirection = 0, windSpeed = 0 }) {
  const { petals, eye, leaves } = useMemo(() => getDaisyGeometry(), [])
  const petalRef = useRef()
  const eyeRef = useRef()
  const leafRef = useRef()

  // Each flower's own standing: where, how big, which way it faces, and the
  // phase it sways on. Fixed per bed so a re-render does not replant the park.
  const flowers = useMemo(
    () =>
      beds.map((bed) => ({
        position: bed.position,
        // The bed's radius was what the planting cleared, so the flower is
        // sized to fill exactly that and no more.
        scale: bed.radius,
        yaw: Math.random() * Math.PI * 2,
        lean: 0.06 + Math.random() * 0.09,
        phase: Math.random() * Math.PI * 2,
        color: bed.color
      })),
    [beds]
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
    write(0)
    if (!petalRef.current) return
    flowers.forEach((flower, index) => {
      petalRef.current.setColorAt(index, tint.set(flower.color))
    })
    if (petalRef.current.instanceColor) petalRef.current.instanceColor.needsUpdate = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowers])

  useFrame(({ clock }) => write(clock.getElapsedTime()))

  if (flowers.length === 0) return null

  return (
    <group>
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
    </group>
  )
}

FlowerBeds.propTypes = {
  beds: PropTypes.arrayOf(
    PropTypes.shape({
      position: PropTypes.arrayOf(PropTypes.number).isRequired,
      radius: PropTypes.number.isRequired,
      color: PropTypes.string.isRequired
    })
  ).isRequired,
  leafColor: PropTypes.string,
  windDirection: PropTypes.number,
  windSpeed: PropTypes.number
}

export default FlowerBeds
