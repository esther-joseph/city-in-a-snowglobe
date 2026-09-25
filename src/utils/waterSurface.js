/**
 * A tiling normal map for still water.
 *
 * Built rather than shipped, for the same reasons the wood grain is: no
 * licence, no download, and no seam where it wraps.
 *
 * What makes a small pool read as water is not its colour, it is that the
 * light moving across it does not move uniformly. So this is a field of
 * overlapping circular wavelets at a few scales, converted to a normal map by
 * taking the slope of the height field. Scrolled slowly in two directions at
 * once by whatever renders it, that is enough: the highlights crawl, which is
 * the whole tell.
 */
import * as THREE from 'three'

const SIZE = 256

/**
 * Height of the wavelet field at a point, in the range 0 to 1.
 *
 * Wrapped by construction: every term uses whole numbers of cycles across the
 * tile, so the left edge meets the right and the top meets the bottom.
 */
function waveHeight(u, v) {
  const tau = Math.PI * 2
  let height = 0

  // A few long swells crossing at angles that do not line up, so no obvious
  // grid appears.
  height += Math.sin((u * 2 + v * 1) * tau) * 0.5
  height += Math.sin((u * 1 - v * 3) * tau) * 0.35
  height += Math.sin((u * 4 + v * 5) * tau) * 0.18
  // Finer chop on top, which is what catches a specular highlight.
  height += Math.sin((u * 7 - v * 6) * tau) * 0.1
  height += Math.sin((u * 11 + v * 9) * tau) * 0.05

  return height
}

/**
 * @param {Object} [options]
 * @param {number} [options.strength=1] - How steep the wavelets read.
 * @param {number} [options.repeat=3] - Tiles across the surface.
 * @returns {THREE.CanvasTexture}
 */
export function createWaterNormalMap({ strength = 1, repeat = 3 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const context = canvas.getContext('2d')
  const image = context.createImageData(SIZE, SIZE)

  const step = 1 / SIZE

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const u = x / SIZE
      const v = y / SIZE

      // Central differences give the slope, and the normal is the slope
      // turned on its side.
      const dx = (waveHeight(u + step, v) - waveHeight(u - step, v)) * strength
      const dy = (waveHeight(u, v + step) - waveHeight(u, v - step)) * strength

      const nx = -dx
      const ny = -dy
      const nz = 1
      const length = Math.hypot(nx, ny, nz)

      const index = (y * SIZE + x) * 4
      image.data[index] = ((nx / length) * 0.5 + 0.5) * 255
      image.data[index + 1] = ((ny / length) * 0.5 + 0.5) * 255
      image.data[index + 2] = ((nz / length) * 0.5 + 0.5) * 255
      image.data[index + 3] = 255
    }
  }

  context.putImageData(image, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeat, repeat)
  texture.colorSpace = THREE.NoColorSpace
  return texture
}

/**
 * The path a jet of water takes: out of the nozzle, over, and down.
 *
 * A jet is a thrown object, so the only honest shape for it is a parabola.
 * The previous jets were vertical cones scaled on Y, which is why they read as
 * pillars rather than as water going anywhere.
 *
 * @param {Object} options
 * @param {number} options.speed - Outward speed at the nozzle.
 * @param {number} options.rise - Upward speed at the nozzle.
 * @param {number} options.gravity
 * @param {number} options.landingY - Height of the water it falls back into,
 *   relative to the nozzle. Negative for a jet that falls below its source.
 * @param {number} [options.samples=14]
 * @returns {THREE.Vector3[]} Points along the arc, in the nozzle's own frame.
 */
export function jetArc({ speed, rise, gravity = 9.8, landingY, samples = 14 }) {
  // Solve for when the arc comes back down to the water it feeds.
  const discriminant = rise * rise + 2 * gravity * -landingY
  const duration =
    discriminant > 0 ? (rise + Math.sqrt(discriminant)) / gravity : (2 * rise) / gravity

  const points = []
  for (let i = 0; i <= samples; i += 1) {
    const t = (i / samples) * duration
    points.push(new THREE.Vector3(speed * t, rise * t - 0.5 * gravity * t * t, 0))
  }
  return points
}
