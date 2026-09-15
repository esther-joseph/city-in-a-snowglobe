import React, { useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

/**
 * Petals in spring, leaves in autumn.
 *
 * Each particle drifts down from a canopy, settles flat on the grass for a few
 * seconds, then starts again from a tree — so the ground keeps a scatter of
 * fallen petals or leaves without the count ever growing.
 */
const dummy = new THREE.Object3D()
const color = new THREE.Color()

const random = (min, max) => min + Math.random() * (max - min)

function spawn(particle, sources, groundY, speed, settled = false) {
  const source = sources[Math.floor(Math.random() * sources.length)] || {
    position: [0, 0, 0],
    radius: 1,
    height: 2
  }
  const [x, , z] = source.position
  const spread = source.radius * 1.6

  particle.x = x + random(-spread, spread)
  particle.z = z + random(-spread, spread)
  particle.y = settled ? groundY : source.height + random(-0.3, 0.8)
  particle.fallSpeed = random(0.5, 1.1) * speed
  particle.swayPhase = random(0, Math.PI * 2)
  particle.swayAmplitude = random(0.15, 0.55)
  particle.spin = random(0, Math.PI * 2)
  particle.spinSpeed = random(-1.6, 1.6)
  particle.tilt = random(0, Math.PI)
  particle.landed = settled
  particle.restFor = random(4, 11)
  particle.restedFor = settled ? random(0, 4) : 0
}

function SeasonalFall({
  sources = [],
  count = 90,
  colors = ['#ffffff'],
  size = 0.2,
  speed = 1,
  groundY = 0.24,
  windDirection = 0,
  windSpeed = 0
}) {
  const meshRef = useRef(null)

  const particles = useMemo(() => {
    const list = Array.from({ length: count }, () => ({}))
    // Seed a third of them already on the ground so the park never looks like
    // the season just started.
    list.forEach((particle, index) => spawn(particle, sources, groundY, speed, index % 3 === 0))
    return list
  }, [count, sources, groundY, speed])

  const palette = useMemo(() => colors.map((hex) => new THREE.Color(hex)), [colors])

  useFrame((state, delta) => {
    const mesh = meshRef.current
    if (!mesh || particles.length === 0) return

    const step = Math.min(delta, 0.1) // stay sane after a tab switch
    const windRadians = (windDirection * Math.PI) / 180
    const drift = Math.min(windSpeed / 12, 1) * 0.6
    const windX = Math.sin(windRadians) * drift
    const windZ = Math.cos(windRadians) * drift
    const time = state.clock.elapsedTime

    particles.forEach((particle, index) => {
      if (particle.landed) {
        particle.restedFor += step
        if (particle.restedFor >= particle.restFor) {
          spawn(particle, sources, groundY, speed)
        }
        dummy.position.set(particle.x, groundY, particle.z)
        // Lying flat on the grass.
        dummy.rotation.set(-Math.PI / 2, 0, particle.spin)
      } else {
        particle.y -= particle.fallSpeed * step
        particle.x += windX * step
        particle.z += windZ * step
        particle.spin += particle.spinSpeed * step

        if (particle.y <= groundY) {
          particle.landed = true
          particle.restedFor = 0
          particle.y = groundY
        }

        const sway = Math.sin(time * 1.6 + particle.swayPhase) * particle.swayAmplitude
        dummy.position.set(particle.x + sway * 0.25, particle.y, particle.z + sway * 0.15)
        dummy.rotation.set(particle.tilt + sway * 0.6, particle.spin, sway)
      }

      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    })

    mesh.instanceMatrix.needsUpdate = true
  })

  const handleRef = (mesh) => {
    meshRef.current = mesh
    if (!mesh || palette.length === 0) return
    particles.forEach((_, index) => {
      color.copy(palette[index % palette.length])
      mesh.setColorAt(index, color)
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }

  if (count === 0 || sources.length === 0) return null

  return (
    <instancedMesh ref={handleRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <planeGeometry args={[size, size * 0.68]} />
      <meshStandardMaterial side={THREE.DoubleSide} roughness={0.85} metalness={0} />
    </instancedMesh>
  )
}

SeasonalFall.propTypes = {
  /** Trees the particles fall from: { position, radius, height }. */
  sources: PropTypes.arrayOf(
    PropTypes.shape({
      position: PropTypes.arrayOf(PropTypes.number).isRequired,
      radius: PropTypes.number,
      height: PropTypes.number
    })
  ),
  count: PropTypes.number,
  colors: PropTypes.arrayOf(PropTypes.string),
  size: PropTypes.number,
  speed: PropTypes.number,
  groundY: PropTypes.number,
  windDirection: PropTypes.number,
  windSpeed: PropTypes.number
}

export default SeasonalFall
