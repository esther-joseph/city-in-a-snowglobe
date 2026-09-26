import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'

/**
 * Let the scene draw between one piece of work and the next.
 *
 * The park is the expensive half of this scene: sixty trees, eighty bushes,
 * the stones, the beds and everything in flower. Building it is not slow
 * because of any one thing — it is a few thousand meshes, and the driver
 * compiles and uploads them — but doing it all in one commit means nothing
 * reaches the screen until the last bush is ready, and the loading screen
 * sits there unable even to update its own message.
 *
 * So the work is cut into stages, and this hands them out one at a time.
 *
 * It counts rendered frames rather than animation frames, and that is the
 * whole reason it lives inside the canvas. A running immersive session drives
 * its own frame loop and the page's requestAnimationFrame stops being called,
 * so a hook built on window frames advances to whatever stage it had reached
 * when the session started and then stops: AR would open on a park that never
 * finished arriving. The renderer's loop runs in both.
 *
 * @param {number} count - How many stages after the first.
 * @param {number} [framesPerStage=2] - Frames to wait before the next. Two,
 *   not one: at one, the next stage is queued before the last has been drawn,
 *   which is the thing this exists to avoid.
 * @returns {number} The stage reached, from 0 up to and including count.
 */
export function useStages(count, framesPerStage = 2) {
  const [stage, setStage] = useState(0)
  const waited = useRef(0)

  useFrame(() => {
    if (stage >= count) return
    waited.current += 1
    if (waited.current < framesPerStage) return
    waited.current = 0
    setStage((reached) => Math.min(count, reached + 1))
  })

  return stage
}

export default useStages
