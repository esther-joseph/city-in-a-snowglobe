/**
 * One material, however many meshes want it.
 *
 * Every `<meshStandardMaterial>` in a component makes a new material, and
 * this city is built mesh by mesh: a park of trees is a few thousand meshes
 * with a few thousand materials behind them, all of which are the same half
 * dozen browns and greens.
 *
 * That is not merely wasteful in memory. Three compiles a shader program per
 * material per render state, so a scene of four thousand materials spends
 * seconds compiling on first paint, and any second pass over the scene — a
 * reflection, a shadow, a render into a target — pays it again.
 *
 * So the park asks for its materials by their parameters instead. Two meshes
 * that want the same brown get the same material and the same program.
 *
 * The one rule: nothing may mutate what it gets back. A material handed out
 * here belongs to everything else that asked for the same thing.
 */
import * as THREE from 'three'

const cache = new Map()

/**
 * @param {Object} parameters - Anything MeshStandardMaterial accepts, so long
 *   as it is a plain value: colours as strings, numbers, booleans.
 * @returns {THREE.MeshStandardMaterial} Shared. Do not modify it.
 */
export function standardMaterial(parameters) {
  // Sorted, so the same parameters in a different order are the same key.
  const key = Object.keys(parameters)
    .sort()
    .map((name) => `${name}:${parameters[name]}`)
    .join('|')

  if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial(parameters))
  return cache.get(key)
}

/** For the tests, and for anything that needs to know how well this is doing. */
export function sharedMaterialCount() {
  return cache.size
}
