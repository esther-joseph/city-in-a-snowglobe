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

/**
 * The height of a pool, as GLSL.
 *
 * Shared by the vertex shader that displaces the surface and the one that
 * works out which way it is then facing, so there is one description of the
 * water and not two that can disagree.
 *
 * Three crossing swells at different rates give a surface that never repeats
 * on any axis the eye can follow. The rings are the part that matters: each
 * one is a train of waves running outward from where a jet lands, losing
 * height as it goes, which is what a disturbed pool actually does and what a
 * spreading torus only suggested.
 */
export const WATER_HEIGHT_GLSL = /* glsl */ `
  float waterHeight(vec2 p) {
    float h = 0.0;
    h += sin(p.x * 2.7 + uTime * 1.45) * 0.30;
    h += sin((p.x * 0.9 + p.y * 2.1) - uTime * 1.05) * 0.42;
    h += sin((p.y * 3.3 - p.x * 1.7) + uTime * 1.85) * 0.22;
    h += sin((p.x * 5.9 + p.y * 4.7) - uTime * 2.6) * 0.11;

    for (int i = 0; i < RIPPLE_COUNT; i += 1) {
      vec3 ripple = uRipples[i];
      float r = length(p - ripple.xy) + 0.0001;
      // Outward train, damped with distance, and softened at the source so
      // the very middle of an impact is not a spike.
      float ring = sin(r * 9.0 - uTime * 5.0);
      // Slow decay: a ring that dies within its own first wavelength is a
      // dimple, not a ripple, and the far side of a basin never sees it.
      h += ring * exp(-r * 0.85) * (1.0 - exp(-r * 5.0)) * ripple.z * 1.3;
    }

    // Water coming over a rim lands in a circle rather than at a point, so
    // its waves run out from a ring: inward to the middle and outward to the
    // wall, from everywhere along it at once. uRing is [radius, strength].
    if (uRing.y > 0.0) {
      float dr = abs(length(p) - uRing.x) + 0.0001;
      h += sin(dr * 8.0 - uTime * 4.5) * exp(-dr * 0.8) * (1.0 - exp(-dr * 4.0)) * uRing.y * 1.4;
    }

    return h * uAmplitude;
  }
`

/**
 * Streaks and droplets along a jet.
 *
 * A jet with a plain surface reads as a glass rod. Water leaving a nozzle is
 * ribbed along its length and breaking up by the time it lands, so this is a
 * height field of lengthwise streaks with beads scattered through it, turned
 * into a normal map the same way the pool's is.
 *
 * @param {Object} [options]
 * @param {number} [options.strength=1.4]
 * @returns {{ normalMap: THREE.CanvasTexture, roughnessMap: THREE.CanvasTexture }}
 */
export function createJetStreakMaps({ strength = 1.4 } = {}) {
  const width = 128
  const height = 64
  const tau = Math.PI * 2

  // Beads, placed once so the two maps agree.
  const beads = []
  for (let i = 0; i < 26; i += 1) {
    beads.push({
      u: (i * 0.3797) % 1,
      v: (i * 0.618) % 1,
      r: 0.03 + ((i * 0.37) % 1) * 0.05,
      weight: 0.5 + ((i * 0.71) % 1) * 0.6
    })
  }

  const field = (u, v) => {
    // Ribs running along the jet, at a few widths so no single stripe reads.
    let value = Math.sin(v * tau * 7) * 0.5 + Math.sin(v * tau * 13 + u * tau) * 0.28
    value += Math.sin(u * tau * 3 + v * tau * 2) * 0.22

    for (const bead of beads) {
      // Wrapped distance: the map tiles along the jet.
      const du = Math.abs(((u - bead.u + 0.5) % 1) - 0.5)
      const dv = Math.abs(((v - bead.v + 0.5) % 1) - 0.5)
      const distance = Math.hypot(du, dv)
      if (distance < bead.r) {
        const falloff = Math.cos((distance / bead.r) * (Math.PI / 2))
        value += falloff * falloff * bead.weight
      }
    }
    return value
  }

  const normalCanvas = document.createElement('canvas')
  normalCanvas.width = width
  normalCanvas.height = height
  const normalContext = normalCanvas.getContext('2d')
  const normalImage = normalContext.createImageData(width, height)

  const roughCanvas = document.createElement('canvas')
  roughCanvas.width = width
  roughCanvas.height = height
  const roughContext = roughCanvas.getContext('2d')
  const roughImage = roughContext.createImageData(width, height)

  const stepU = 1 / width
  const stepV = 1 / height

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = x / width
      const v = y / height

      const du = (field(u + stepU, v) - field(u - stepU, v)) * strength
      const dv = (field(u, v + stepV) - field(u, v - stepV)) * strength
      const length = Math.hypot(-du, -dv, 1)

      const index = (y * width + x) * 4
      normalImage.data[index] = ((-du / length) * 0.5 + 0.5) * 255
      normalImage.data[index + 1] = ((-dv / length) * 0.5 + 0.5) * 255
      normalImage.data[index + 2] = ((1 / length) * 0.5 + 0.5) * 255
      normalImage.data[index + 3] = 255

      // A bead is a smooth droplet; the ribs between them scatter more.
      const rough = Math.min(1, Math.max(0, 0.34 - field(u, v) * 0.16))
      const level = rough * 255
      roughImage.data[index] = level
      roughImage.data[index + 1] = level
      roughImage.data[index + 2] = level
      roughImage.data[index + 3] = 255
    }
  }

  normalContext.putImageData(normalImage, 0, 0)
  roughContext.putImageData(roughImage, 0, 0)

  const wrap = (canvas, colorSpace) => {
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.colorSpace = colorSpace
    return texture
  }

  return {
    normalMap: wrap(normalCanvas, THREE.NoColorSpace),
    roughnessMap: wrap(roughCanvas, THREE.NoColorSpace)
  }
}

/**
 * Narrow a swept tube along its own length.
 *
 * TubeGeometry is one thickness from end to end, which is why the jets read
 * as pipes. A jet leaves the nozzle at its fullest, stretches as it speeds up
 * over the top, and is coming apart by the time it lands, so this pulls every
 * ring in toward the curve by a factor of how far along it is, with a slow
 * beat along the way for the beads a real stream breaks into.
 *
 * @param {THREE.BufferGeometry} geometry - From TubeGeometry.
 * @param {THREE.Curve} curve - The same curve it was swept along.
 * @param {Object} [options]
 * @param {number} [options.tip=0.45] - Fraction of the radius left at the end.
 * @param {number} [options.beat=0.14] - How much it swells and narrows.
 * @returns {THREE.BufferGeometry} The same geometry, modified.
 */
export function taperTube(geometry, curve, { tip = 0.45, beat = 0.14 } = {}) {
  const position = geometry.attributes.position
  const uv = geometry.attributes.uv
  const point = new THREE.Vector3()
  const vertex = new THREE.Vector3()

  for (let i = 0; i < position.count; i += 1) {
    // TubeGeometry writes distance along the tube into u.
    const t = uv.getX(i)
    curve.getPointAt(Math.min(1, Math.max(0, t)), point)
    vertex.fromBufferAttribute(position, i)

    const scale = (1 - (1 - tip) * t) * (1 + Math.sin(t * Math.PI * 5.5) * beat)
    vertex.sub(point).multiplyScalar(scale).add(point)
    position.setXYZ(i, vertex.x, vertex.y, vertex.z)
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

/**
 * A sheet of water coming over a rim.
 *
 * What falls from one tier of a fountain to the next is not a jet, it is a
 * curtain: the bowl fills, the water goes over the edge all the way round and
 * comes down as a sheet, thinning and breaking as it falls. The geometry is
 * an open cylinder flaring slightly outward, and what makes it read is the
 * texture scrolling down it rather than any movement of the mesh.
 *
 * @param {Object} [options]
 * @param {number} [options.strength=1.1] - How hard the ribs read.
 * @returns {{ normalMap: THREE.CanvasTexture, alphaMap: THREE.CanvasTexture }}
 */
export function createFallingSheetMaps({ strength = 1.1 } = {}) {
  const width = 96
  const height = 128
  const tau = Math.PI * 2

  // u runs around the curtain, v down it. Every term uses whole cycles in u so
  // the sheet closes on itself with no seam.
  const field = (u, v) => {
    let value = Math.sin(u * tau * 9) * 0.45
    value += Math.sin(u * tau * 17 + v * 2.1) * 0.25
    value += Math.sin(u * tau * 5 - v * 3.7) * 0.2
    // Down the fall the sheet breaks up: the fine detail grows with v.
    value += Math.sin(u * tau * 31 + v * 9.0) * 0.12 * v
    return value
  }

  const normalCanvas = document.createElement('canvas')
  normalCanvas.width = width
  normalCanvas.height = height
  const normalContext = normalCanvas.getContext('2d')
  const normalImage = normalContext.createImageData(width, height)

  const alphaCanvas = document.createElement('canvas')
  alphaCanvas.width = width
  alphaCanvas.height = height
  const alphaContext = alphaCanvas.getContext('2d')
  const alphaImage = alphaContext.createImageData(width, height)

  const stepU = 1 / width
  const stepV = 1 / height

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = x / width
      const v = y / height

      const du = (field(u + stepU, v) - field(u - stepU, v)) * strength
      const dv = (field(u, v + stepV) - field(u, v - stepV)) * strength
      const length = Math.hypot(-du, -dv, 1)

      const index = (y * width + x) * 4
      normalImage.data[index] = ((-du / length) * 0.5 + 0.5) * 255
      normalImage.data[index + 1] = ((-dv / length) * 0.5 + 0.5) * 255
      normalImage.data[index + 2] = ((1 / length) * 0.5 + 0.5) * 255
      normalImage.data[index + 3] = 255

      // Solid where it leaves the rim, holed and thinning by the time it
      // lands, and never quite opaque anywhere.
      const gaps = Math.max(0, field(u, v)) * 0.35 * v
      const alpha = Math.min(1, Math.max(0, 0.92 - v * 0.45 - gaps))
      const level = alpha * 255
      alphaImage.data[index] = level
      alphaImage.data[index + 1] = level
      alphaImage.data[index + 2] = level
      alphaImage.data[index + 3] = 255
    }
  }

  normalContext.putImageData(normalImage, 0, 0)
  alphaContext.putImageData(alphaImage, 0, 0)

  const wrap = (canvas) => {
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.colorSpace = THREE.NoColorSpace
    return texture
  }

  return { normalMap: wrap(normalCanvas), alphaMap: wrap(alphaCanvas) }
}
