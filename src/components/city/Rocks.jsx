import React, { useLayoutEffect, useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import * as THREE from 'three'
import { getRockGeometries } from '../../utils/rocks'

/**
 * The stones in the grass.
 *
 * One instanced mesh per shape, so the whole scattering costs three draw
 * calls. Each stone gets its own turn and a small stretch, which is enough to
 * stop three shapes reading as three shapes.
 *
 * They are lit but do not move, so unlike the flowers there is nothing to
 * update per frame: the matrices are written once.
 */

const dummy = new THREE.Object3D()

function Rocks({ stones = [], color = '#8d8b85' }) {
  const shapes = useMemo(() => getRockGeometries(), [])
  const refs = useRef([])

  const byShape = useMemo(
    () => shapes.map((shape) => stones.filter((stone) => stone.shape === shape.id)),
    [shapes, stones]
  )

  useLayoutEffect(() => {
    byShape.forEach((group, index) => {
      const mesh = refs.current[index]
      if (!mesh) return
      group.forEach((stone, i) => {
        dummy.position.set(stone.position[0], 0, stone.position[1])
        dummy.rotation.set(stone.tilt, stone.yaw, 0)
        dummy.scale.set(stone.scale * stone.stretch, stone.scale, stone.scale)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.count = group.length
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    })
  }, [byShape])

  if (stones.length === 0) return null

  return (
    <group>
      {shapes.map((shape, index) => (
        <instancedMesh
          key={shape.id}
          ref={(mesh) => {
            refs.current[index] = mesh
          }}
          args={[shape.geometry, undefined, Math.max(1, byShape[index].length)]}
          castShadow
          receiveShadow
        >
          {/* Flat shaded, like the rest of the park: a rock with smoothed
              normals is a potato. */}
          <meshStandardMaterial color={color} roughness={0.92} metalness={0.04} flatShading />
        </instancedMesh>
      ))}
    </group>
  )
}

Rocks.propTypes = {
  stones: PropTypes.arrayOf(
    PropTypes.shape({
      shape: PropTypes.string.isRequired,
      position: PropTypes.arrayOf(PropTypes.number).isRequired,
      scale: PropTypes.number.isRequired,
      stretch: PropTypes.number.isRequired,
      yaw: PropTypes.number.isRequired,
      tilt: PropTypes.number.isRequired
    })
  ),
  color: PropTypes.string
}

export default Rocks
