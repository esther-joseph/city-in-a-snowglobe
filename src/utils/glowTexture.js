/**
 * Soft radial glow textures for the sun and moon.
 *
 * Nested translucent spheres make a hard-edged shell, and over a bright sky
 * additive shells wash out to white. A radial gradient on a camera-facing
 * sprite falls off smoothly instead, so the colour survives: gold shading into
 * champagne, silver into cool blue.
 */
import * as THREE from 'three'

const SIZE = 256

/**
 * @param {Array<{ stop: number, color: string, alpha: number }>} stops
 * @returns {THREE.CanvasTexture}
 */
export function createGlowTexture(stops) {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE

  const context = canvas.getContext('2d')
  const half = SIZE / 2
  const gradient = context.createRadialGradient(half, half, 0, half, half, half)

  stops.forEach(({ stop, color, alpha }) => {
    const { r, g, b } = new THREE.Color(color)
    gradient.addColorStop(
      stop,
      `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`
    )
  })

  context.fillStyle = gradient
  context.fillRect(0, 0, SIZE, SIZE)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
