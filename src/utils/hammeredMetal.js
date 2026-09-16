/**
 * Procedural hammered-metal maps.
 *
 * Forged brass reads through its dents: a field of shallow, overlapping
 * hammer marks that tip the surface normal a little in every direction, so
 * highlights break up instead of running smoothly around the form. The dents
 * are far too shallow to model as geometry on a ring this thin, so they are
 * baked into a normal map, with a matching roughness map that makes struck
 * areas a touch duller than the ridges between them.
 */
import * as THREE from 'three'

const SIZE = 512

function dentField({ dents, minRadius, maxRadius }) {
  const nx = new Float32Array(SIZE * SIZE)
  const ny = new Float32Array(SIZE * SIZE)
  const depth = new Float32Array(SIZE * SIZE)

  for (let i = 0; i < dents; i += 1) {
    const cx = Math.random() * SIZE
    const cy = Math.random() * SIZE
    const radius = minRadius + Math.random() * (maxRadius - minRadius)
    const strength = 0.5 + Math.random() * 0.5

    const x0 = Math.floor(cx - radius)
    const x1 = Math.ceil(cx + radius)
    const y0 = Math.floor(cy - radius)
    const y1 = Math.ceil(cy + radius)

    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const dx = x - cx
        const dy = y - cy
        const distance = Math.hypot(dx, dy)
        if (distance > radius) continue

        // Wrap so the map tiles seamlessly around the ring.
        const px = ((x % SIZE) + SIZE) % SIZE
        const py = ((y % SIZE) + SIZE) % SIZE
        const index = py * SIZE + px

        // Spherical cap: the normal tilts most at the rim of the dent.
        const t = distance / radius
        const falloff = Math.cos((t * Math.PI) / 2)
        nx[index] += (dx / radius) * strength * falloff
        ny[index] += (dy / radius) * strength * falloff
        depth[index] += (1 - t) * strength
      }
    }
  }

  return { nx, ny, depth }
}

function toTexture(canvas, repeat) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeat[0], repeat[1])
  return texture
}

/**
 * @param {Object} [options]
 * @returns {{ normalMap: THREE.CanvasTexture, roughnessMap: THREE.CanvasTexture }}
 */
export function createHammeredMaps({
  dents = 900,
  minRadius = 5,
  maxRadius = 16,
  strength = 0.85,
  repeat = [10, 2]
} = {}) {
  const { nx, ny, depth } = dentField({ dents, minRadius, maxRadius })

  const normalCanvas = document.createElement('canvas')
  normalCanvas.width = SIZE
  normalCanvas.height = SIZE
  const normalContext = normalCanvas.getContext('2d')
  const normalImage = normalContext.createImageData(SIZE, SIZE)

  const roughCanvas = document.createElement('canvas')
  roughCanvas.width = SIZE
  roughCanvas.height = SIZE
  const roughContext = roughCanvas.getContext('2d')
  const roughImage = roughContext.createImageData(SIZE, SIZE)

  for (let i = 0; i < SIZE * SIZE; i += 1) {
    const x = Math.max(-1, Math.min(1, nx[i] * strength))
    const y = Math.max(-1, Math.min(1, ny[i] * strength))
    const z = Math.sqrt(Math.max(0.05, 1 - x * x - y * y))

    const offset = i * 4
    normalImage.data[offset] = (x * 0.5 + 0.5) * 255
    normalImage.data[offset + 1] = (y * 0.5 + 0.5) * 255
    normalImage.data[offset + 2] = (z * 0.5 + 0.5) * 255
    normalImage.data[offset + 3] = 255

    // Struck hollows hold a little more roughness than the ridges.
    const wear = Math.max(0, Math.min(1, depth[i] * 0.5))
    const value = (0.45 + wear * 0.35) * 255
    roughImage.data[offset] = value
    roughImage.data[offset + 1] = value
    roughImage.data[offset + 2] = value
    roughImage.data[offset + 3] = 255
  }

  normalContext.putImageData(normalImage, 0, 0)
  roughContext.putImageData(roughImage, 0, 0)

  return {
    normalMap: toTexture(normalCanvas, repeat),
    roughnessMap: toTexture(roughCanvas, repeat)
  }
}
