import React from 'react'
import PropTypes from 'prop-types'
import { Stars } from '@react-three/drei'

function StarField({
  radius = 260,
  depth = 70,
  count = 3000,
  factor = 4,
  saturation = 0,
  fade = true,
  speed = 0.5
}) {
  return (
    <Stars
      radius={radius}
      depth={depth}
      count={count}
      factor={factor}
      saturation={saturation}
      fade={fade}
      speed={speed}
    />
  )
}

StarField.propTypes = {
  radius: PropTypes.number,
  depth: PropTypes.number,
  count: PropTypes.number,
  factor: PropTypes.number,
  saturation: PropTypes.number,
  fade: PropTypes.bool,
  speed: PropTypes.number
}

export default StarField

