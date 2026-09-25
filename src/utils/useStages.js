import { useEffect, useState } from 'react'

/**
 * Let the browser draw between one piece of work and the next.
 *
 * The park is the expensive half of this scene: sixty trees, eighty bushes,
 * the stones, the beds and everything in flower, all of it built during the
 * first render. Building it is not slow because of any one thing — it is a
 * few thousand meshes, and the driver compiles and uploads them — but doing
 * it all in one commit means nothing reaches the screen until every last
 * bush is ready, and the loading screen sits there unable even to update its
 * own message.
 *
 * So the work is cut into stages, and this hands them out one at a time. Two
 * animation frames between each: the first lets the commit that just happened
 * be drawn, the second starts the next one on a fresh frame. The total work
 * is the same. What changes is that the globe is on screen while the park is
 * still arriving, and the app answers a tap throughout.
 *
 * @param {number} count - How many stages after the first.
 * @returns {number} The stage reached, from 0 up to and including count.
 */
export function useStages(count) {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    if (stage >= count) return undefined

    // Two frames, not one. A single frame schedules the next stage before the
    // last one has been painted, which is the thing this exists to avoid.
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setStage((reached) => reached + 1))
    })

    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [stage, count])

  return stage
}

export default useStages
