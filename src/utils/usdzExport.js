/**
 * USDZ export for Apple's AR Quick Look.
 *
 * Safari on iPhone/iPad has no immersive-ar session, but it will hand a .usdz
 * file to the system AR viewer, which does real plane detection and placement.
 * USDZ only carries geometry and standard PBR materials, so this module makes
 * a sanitized copy of the scene first: custom shaders are approximated with
 * MeshStandardMaterial, and particle systems (snow, rain) are dropped because
 * the format has no equivalent.
 */
import * as THREE from 'three'
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Name of the group in App.jsx that holds the globe and its city. */
export const USDZ_ROOT_NAME = 'usdz-export-root'

/**
 * Groups meshes by how they look rather than by material identity. The city is
 * built from thousands of meshes that each own a separate material instance;
 * exported one by one that becomes a 30 MB archive, which AR Quick Look will
 * not open comfortably.
 */
function appearanceKey(material) {
  if (!material) return 'default'
  const color = material.color?.getHexString?.() ?? 'cccccc'
  const emissive = material.emissive?.getHexString?.() ?? '000000'
  const opacity = material.transparent ? (material.opacity ?? 1).toFixed(2) : '1.00'
  const roughness = (material.roughness ?? 0.35).toFixed(2)
  const metalness = (material.metalness ?? 0).toFixed(2)
  return `${color}|${emissive}|${opacity}|${roughness}|${metalness}|${material.side ?? 0}`
}

/** Troika text builds its glyphs in a custom shader; there is no USD equivalent. */
function isTroikaText(mesh) {
  return Boolean(mesh.geometry?.attributes?.aTroikaGlyphIndex)
}

function approximateMaterial(material) {
  if (!material) return new THREE.MeshStandardMaterial({ color: 0xcccccc })

  // MeshPhysicalMaterial reports isMeshStandardMaterial, so both pass through.
  if (material.isMeshStandardMaterial) return material

  const color = material.color?.clone?.() ?? new THREE.Color(0xcccccc)
  const uniformColor = material.uniforms?.color?.value ?? material.uniforms?.uColor?.value

  return new THREE.MeshStandardMaterial({
    color: uniformColor?.isColor ? uniformColor.clone() : color,
    // Shader-driven glass reads as near-clear; keep a hint of it so the dome
    // still exists in the exported model.
    transparent: material.transparent ?? false,
    opacity: material.transparent ? Math.min(material.opacity ?? 1, 0.25) : 1,
    roughness: 0.35,
    metalness: 0,
    side: material.side ?? THREE.FrontSide
  })
}

/**
 * USDZ archives store their USDA payload uncompressed, so every vertex costs
 * about a hundred bytes of ASCII. The full city is ~220k vertices, which lands
 * at 30 MB — far past what AR Quick Look opens comfortably on a phone. Meshes
 * are therefore kept largest-first until this budget is spent, which preserves
 * the dome, base and towers while dropping window trim and small props.
 */
const MAX_EXPORT_VERTICES = 60000

/** Normalize so geometries from different meshes can be merged together. */
function normalizeGeometry(mesh, rootInverse) {
  const geometry = mesh.geometry.clone()

  // Keep only position and normal: no material here samples a texture, and
  // every extra attribute is more ASCII in the archive.
  Object.keys(geometry.attributes).forEach((name) => {
    if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name)
  })
  if (!geometry.attributes.normal) geometry.computeVertexNormals()
  geometry.morphAttributes = {}

  // Bake the world transform, expressed relative to the exported root.
  geometry.applyMatrix4(rootInverse.clone().multiply(mesh.matrixWorld))
  return geometry
}

/** World-space bounding volume, used to rank meshes by visual importance. */
function meshVolume(mesh) {
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
  const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3())
  const scale = mesh.getWorldScale(new THREE.Vector3())
  return Math.abs(size.x * scale.x) * Math.abs(size.y * scale.y) * Math.abs(size.z * scale.z)
}

/**
 * Build a USDZ-serializable copy of an object: meshes merged by appearance,
 * unsupported node types dropped, custom shaders approximated.
 * @param {THREE.Object3D} source
 * @returns {THREE.Object3D}
 */
export function prepareForUSDZ(source) {
  source.updateMatrixWorld(true)
  const rootInverse = source.matrixWorld.clone().invert()
  const buckets = new Map()

  const candidates = []
  source.traverse((node) => {
    if (!node.isMesh) return
    if (node.userData?.excludeFromUSDZ) return
    if (node.isPoints || node.isSprite || node.isLine) return
    if (!node.visible || isTroikaText(node)) return
    candidates.push({ mesh: node, volume: meshVolume(node) })
  })

  candidates.sort((a, b) => b.volume - a.volume)

  let budget = MAX_EXPORT_VERTICES
  candidates.forEach(({ mesh }) => {
    const vertexCount = mesh.geometry.attributes.position?.count ?? 0
    if (vertexCount === 0 || vertexCount > budget) return

    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    // Indexed and non-indexed geometry cannot be merged together.
    const key = `${appearanceKey(material)}|${mesh.geometry.index ? 'i' : 'n'}`
    if (!buckets.has(key)) buckets.set(key, { material, geometries: [] })

    try {
      buckets.get(key).geometries.push(normalizeGeometry(mesh, rootInverse))
      budget -= vertexCount
    } catch (error) {
      console.warn('Skipping mesh that could not be prepared for USDZ:', error)
    }
  })

  const group = new THREE.Group()
  group.name = 'snow-globe'

  buckets.forEach(({ material, geometries }, key) => {
    const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false)
    if (!merged) {
      console.warn('Could not merge geometries for appearance', key)
      return
    }
    const mesh = new THREE.Mesh(merged, approximateMaterial(material))
    mesh.name = `part-${key.slice(0, 6)}`
    group.add(mesh)
  })

  group.updateMatrixWorld(true)
  return group
}

/**
 * Serialize an object to a USDZ blob.
 * @param {THREE.Object3D} object
 * @returns {Promise<Blob>}
 */
export async function exportUSDZ(object) {
  const exportable = prepareForUSDZ(object)
  const exporter = new USDZExporter()
  const archive = await exporter.parseAsync(exportable)
  return new Blob([archive], { type: 'model/vnd.usdz+zip' })
}

// Quick Look refuses to open an anchor that has no element child, so the link
// carries a transparent pixel.
const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/**
 * Hand an object to AR Quick Look.
 *
 * Safari needs a same-document anchor click, so the blob is attached to a
 * synthetic link rather than opened with window.open.
 * @param {THREE.Object3D} object
 * @param {{ fileName?: string }} [options]
 * @returns {Promise<void>}
 */
export async function openInQuickLook(object, { fileName = 'snow-globe.usdz' } = {}) {
  const blob = await exportUSDZ(object)
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.setAttribute('rel', 'ar')
  anchor.setAttribute('download', fileName)
  anchor.href = url
  anchor.style.display = 'none'

  const pixel = document.createElement('img')
  pixel.src = TRANSPARENT_PIXEL
  anchor.appendChild(pixel)

  document.body.appendChild(anchor)
  anchor.click()

  // Give Quick Look time to read the blob before the URL is revoked.
  window.setTimeout(() => {
    anchor.remove()
    URL.revokeObjectURL(url)
  }, 10000)
}
