/**
 * Procedural wood grain for the globe's base.
 *
 * Generated rather than photographed: a tiling image would have to be licensed
 * and shipped, and a seam would show where it wrapped around the plinth. This
 * builds the two things that make timber read as timber — growth rings pulled
 * into long cathedral arches, and fine fibre running with the grain — and
 * tiles them seamlessly.
 *
 * The map is luminance only, deliberately. It multiplies the material's own
 * colour, so the chocolate brown stays exactly the chocolate brown and the
 * grain only lightens and darkens it.
 */
import * as THREE from 'three'

// 256 is ample for grain this soft, and halves the upload.
const SIZE = 256

/** Cheap value noise: hashed lattice with smooth interpolation. */
function makeNoise(seed = 1) {
  const hash = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
    return n - Math.floor(n)
  }

  // Wrapped lattice lookup keeps the pattern tiling.
  return (x, y, period) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const smooth = (t) => t * t * (3 - 2 * t)
    const u = smooth(xf)
    const v = smooth(yf)

    const wrap = (value) => ((value % period) + period) % period
    const a = hash(wrap(xi), wrap(yi))
    const b = hash(wrap(xi + 1), wrap(yi))
    const c = hash(wrap(xi), wrap(yi + 1))
    const d = hash(wrap(xi + 1), wrap(yi + 1))

    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v
  }
}

/**
 * @param {Object} [options]
 * @param {number} [options.rings] - growth rings across the tile
 * @param {number} [options.warp] - how far the rings wander, in ring widths
 * @param {number} [options.contrast] - 0 flat, 1 strongly figured
 * @param {[number, number]} [options.repeat]
 * @returns {{ map: THREE.CanvasTexture, roughnessMap: THREE.CanvasTexture }}
 */
export function createWoodGrainMaps({
  rings = 5,
  warp = 0.7,
  contrast = 1,
  repeat = [3, 1]
} = {}) {
  const noise = makeNoise(7)
  const fibreNoise = makeNoise(23)

  const grainCanvas = document.createElement('canvas')
  grainCanvas.width = SIZE
  grainCanvas.height = SIZE
  const grainContext = grainCanvas.getContext('2d')
  const grainImage = grainContext.createImageData(SIZE, SIZE)

  const roughCanvas = document.createElement('canvas')
  roughCanvas.width = SIZE
  roughCanvas.height = SIZE
  const roughContext = roughCanvas.getContext('2d')
  const roughImage = roughContext.createImageData(SIZE, SIZE)

  const lattice = 4

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const u = x / SIZE
      const v = y / SIZE

      // Rings run down the tile, so the grain follows the flutes. Warping them
      // with low-frequency noise is what produces cathedral figure rather than
      // a barcode.
      const wander = noise(u * lattice, v * lattice * 0.35, lattice) - 0.5
      const ringPosition = (u + wander * warp) * rings
      const ring = Math.abs(((ringPosition % 1) + 1) % 1 - 0.5) * 2

      // Fine fibre, stretched hard along the grain direction.
      const fibre = fibreNoise(u * 96, v * 6, 96)

      // Centred just below white so the map only ever darkens a little: a
      // texture can multiply the base colour down but never up, and the brown
      // has to survive unchanged.
      let value = 1 - ring * 0.19 * contrast - (0.5 - fibre) * 0.06
      value = Math.max(0.76, Math.min(1, value))

      const offset = (y * SIZE + x) * 4
      const level = Math.round(Math.min(255, value * 255))
      grainImage.data[offset] = level
      grainImage.data[offset + 1] = level
      grainImage.data[offset + 2] = level
      grainImage.data[offset + 3] = 255

      // Latewood — the dark bands — sits a touch rougher than the pale grain.
      const rough = Math.round((0.52 + ring * 0.2) * 255)
      roughImage.data[offset] = rough
      roughImage.data[offset + 1] = rough
      roughImage.data[offset + 2] = rough
      roughImage.data[offset + 3] = 255
    }
  }

  grainContext.putImageData(grainImage, 0, 0)
  roughContext.putImageData(roughImage, 0, 0)

  const toTexture = (canvas, colorSpace) => {
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeat[0], repeat[1])
    texture.anisotropy = 4
    if (colorSpace) texture.colorSpace = colorSpace
    return texture
  }

  return {
    map: toTexture(grainCanvas, THREE.SRGBColorSpace),
    roughnessMap: toTexture(roughCanvas)
  }
}
