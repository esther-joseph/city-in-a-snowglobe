import { useEffect } from 'react'
import PropTypes from 'prop-types'
import { useThree } from '@react-three/fiber'

/**
 * Notices when the GPU takes the graphics context away — and only then.
 *
 * A lost context is unrecoverable without a reload: geometry, textures and
 * every compiled shader live in it, and when it goes the canvas is black and
 * stays black. So it is worth watching for.
 *
 * The trap is that it is not only the GPU that ends a context. Unmounting a
 * canvas ends one too: @react-three/fiber calls forceContextLoss() when it
 * tears a root down, which fires the same webglcontextlost event as a real
 * failure. And this app unmounts a canvas every time somebody presses AR,
 * because the 3D view and the AR view are different canvases. Watching from
 * outside, the app reloaded itself on the way into every session — the HUD
 * appeared for a second and then the page started again.
 *
 * Which is why this is a component inside the canvas rather than a listener
 * attached when the canvas is created. R3F unmounts the React tree first and
 * calls forceContextLoss afterwards, on a later tick, so a listener owned by
 * a component in that tree is already gone by the time the deliberate loss
 * arrives. What is left to hear is the unasked-for kind.
 */
function ContextLossGuard({ onLost }) {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const canvas = gl?.domElement
    if (!canvas) return undefined

    const handle = (event) => {
      // Asking for a restore event at all. There is no listener for one,
      // because rebuilding the scene from a restore is the same work as a
      // reload with more ways to be subtly wrong.
      event.preventDefault()
      onLost()
    }

    canvas.addEventListener('webglcontextlost', handle)
    return () => canvas.removeEventListener('webglcontextlost', handle)
  }, [gl, onLost])

  return null
}

ContextLossGuard.propTypes = { onLost: PropTypes.func.isRequired }

export default ContextLossGuard
