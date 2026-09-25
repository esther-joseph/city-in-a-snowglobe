/**
 * Rounded panels for the controls that live inside the scene.
 *
 * A headset browser composites no HTML, so the AR controls are geometry, and
 * geometry has none of the things a stylesheet gives away for free. These are
 * the two it needs: a rectangle with rounded corners, and a gradient to fill
 * it with.
 */
import * as THREE from 'three'

/**
 * A rounded rectangle, centred on its own middle, lying in XY.
 *
 * ShapeGeometry writes the shape's own coordinates into the UVs, which is
 * useless for mapping a gradient across the panel, so they are rewritten from
 * the vertex positions afterwards.
 *
 * @param {Object} options
 * @param {number} options.width
 * @param {number} options.height
 * @param {number} [options.radius] - Corner radius, clamped to half the height.
 * @param {number} [options.segments=4] - Steps per corner.
 * @returns {THREE.BufferGeometry}
 */
export function roundedPanel({ width, height, radius = 0.02, segments = 4 }) {
  const r = Math.min(radius, height / 2, width / 2)
  const x = width / 2
  const y = height / 2

  const shape = new THREE.Shape()
  shape.moveTo(-x + r, -y)
  shape.lineTo(x - r, -y)
  shape.quadraticCurveTo(x, -y, x, -y + r)
  shape.lineTo(x, y - r)
  shape.quadraticCurveTo(x, y, x - r, y)
  shape.lineTo(-x + r, y)
  shape.quadraticCurveTo(-x, y, -x, y - r)
  shape.lineTo(-x, -y + r)
  shape.quadraticCurveTo(-x, -y, -x + r, -y)

  const geometry = new THREE.ShapeGeometry(shape, segments)

  const position = geometry.attributes.position
  const uv = geometry.attributes.uv
  for (let i = 0; i < position.count; i += 1) {
    uv.setXY(i, (position.getX(i) + x) / width, (position.getY(i) + y) / height)
  }
  uv.needsUpdate = true

  return geometry
}

/**
 * A vertical gradient, for the face of a panel.
 *
 * @param {Object} [options]
 * @param {string} [options.top]
 * @param {string} [options.bottom]
 * @returns {THREE.CanvasTexture}
 */
export function createPanelGradient({ top = '#20242e', bottom = '#000000' } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 64
  const context = canvas.getContext('2d')

  // Canvas y runs down and UV v runs up, so the first stop is the bottom.
  const gradient = context.createLinearGradient(0, 0, 0, 64)
  gradient.addColorStop(0, bottom)
  gradient.addColorStop(1, top)
  context.fillStyle = gradient
  context.fillRect(0, 0, 4, 64)

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
