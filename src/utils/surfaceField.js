import { createContext, useContext, useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { buildHeightField } from './surfaceHeightField'

/**
 * The group holding the city's own ground and buildings, named so the surface
 * map can be built from it and nothing else.
 *
 * Not the export root, which is what this used to use: that holds the globe
 * as well as the city, and the globe is a sphere of glass over the top of it.
 * Rays cast downward from above the city hit the inside of the dome first and
 * every cell of the map came back as the glass — one flat ceiling two dozen
 * units up. Rain then spawned above that, landed on it instantly, and did it
 * again on the next frame, for ever.
 */
export const CITY_SURFACE_NAME = 'city-surface'

/**
 * What is underneath, shared by everything that lands on it.
 *
 * Snow has always needed this: a coarse map of the highest surface at each
 * point, so a flake can settle on the roof or the canopy under it without
 * raycasting thousands of times a frame. Rain needs the same map for the same
 * reason — a drop's ripple belongs where the drop actually stopped, on the
 * roof or the bench or the water, not on the ground beneath whatever it hit.
 *
 * It is built once and shared rather than once per effect. The build is two
 * thousand raycasts against the whole city, which is not a thing to do twice
 * because two different things happen to be falling.
 */

export const SurfaceFieldContext = createContext(null)

export function useSurfaceField() {
  return useContext(SurfaceFieldContext)
}

/**
 * Sample the city, once it has finished arriving.
 *
 * The delay is the park: it is planted over the first few frames, and a map
 * built before the trees are there has no trees in it.
 *
 * @param {Object} options
 * @param {React.RefObject} options.anchor - An object in the space the
 *   heights should be measured in.
 * @param {number} options.span
 * @param {number} options.resolution
 * @returns {React.MutableRefObject<{ sample: Function, isEdge: Function }|null>}
 */
export function useBuiltSurfaceField({ anchor, span, resolution }) {
  const field = useRef(null)
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    let cancelled = false
    let timer = 0
    let attempts = 0

    const build = () => {
      if (cancelled) return

      // The city, and only the city: not the sky, not the stars, and not the
      // glass around it.
      const city = scene.getObjectByName(CITY_SURFACE_NAME)
      if (!city || !anchor.current) {
        attempts += 1
        if (attempts < 5) timer = setTimeout(build, 600)
        return
      }

      field.current = buildHeightField(anchor.current, city, { span, resolution })

      // A dev aid: lets a test ask what the map says without rebuilding one
      // of its own, which would measure from a different place.
      if (import.meta.env.DEV) window.__surfaceField = field.current
    }

    timer = setTimeout(build, 1200)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [scene, anchor, span, resolution])

  return field
}
