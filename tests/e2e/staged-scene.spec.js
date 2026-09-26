import { test, expect } from '@playwright/test'
import { stubWeatherApi } from './support/weatherFixture.js'
import { waitForPark } from './support/app.js'

/**
 * The scene arrives in stages.
 *
 * It used to be built in one commit: a few thousand meshes, the driver
 * compiling and uploading all of them, and nothing on screen until the last
 * bush was ready. The loading screen could not even update its own message
 * while that was happening, which is how you could tell — it showed its first
 * frame and then jumped straight to "Ready".
 *
 * Now the plaza goes up first, then the skyline, then the park in three
 * passes, with a painted frame between each. The total work is the same. What
 * changes is that the app is on screen and answering while it happens.
 */

async function open(page) {
  await page.addInitScript(() => window.sessionStorage.setItem('app-has-reloaded', 'true'))
  await stubWeatherApi(page)
  await page.goto('/?ads=off')
}

test.describe('A scene that arrives in stages', () => {
  test('the app answers long before the park is finished', async ({ page }) => {
    await open(page)

    // A trivial call, which can only be served when the main thread is free.
    // Before the staging this took the better part of twenty seconds, because
    // the whole scene was built between the navigation and the first yield.
    const asked = Date.now()
    const planted = await page.evaluate(() => Boolean(window.__snowGlobePlanted))
    const waited = Date.now() - asked

    expect(waited, 'the page is answering').toBeLessThan(4000)
    // And it answered while there was still a park to plant.
    expect(planted, 'not finished yet').toBe(false)

    // Which it then finishes.
    await waitForPark(page)
  })

  test('the loading screen can still say what it is doing', async ({ page }) => {
    await page.addInitScript(() => window.sessionStorage.setItem('app-has-reloaded', 'true'))
    await stubWeatherApi(page)
    // Hold the weather back, so there is something for it to say.
    await page.route('**/api/openweather**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      await route.fallback()
    })
    await page.goto('/?ads=off')

    // The message it shows while it waits, which it could not reach at all
    // when the scene was built in one go.
    await expect(page.getByTestId('loading-screen')).toContainText(
      /Reading the sky over|Waking the globe/
    )
  })

  test('the stages are ordered, and the park comes last', async ({ page }) => {
    await open(page)
    await waitForPark(page)

    const stages = await page.evaluate(async () => {
      const source = await (await fetch('/src/components/City.jsx')).text()
      const line = source.match(/const STAGE = \{([^}]*)\}/)
      if (!line) return null
      return Object.fromEntries(
        line[1]
          .split(',')
          .map((pair) => pair.split(':').map((part) => part.trim()))
          .filter((pair) => pair.length === 2)
          .map(([name, value]) => [name, Number(value)])
      )
    })

    expect(stages, 'a stage list').not.toBeNull()
    // The plaza is stage zero and has no name here: it is what is left when
    // everything else is deferred.
    expect(stages.SKYLINE).toBeGreaterThan(0)
    expect(stages.TREES).toBeGreaterThan(stages.SKYLINE)
    expect(stages.UNDERGROWTH).toBeGreaterThan(stages.TREES)
    expect(stages.DETAIL).toBeGreaterThan(stages.UNDERGROWTH)
  })

  test('the stages count rendered frames, not page frames', async ({ page }) => {
    await open(page)

    const behaviour = await page.evaluate(async () => {
      const source = await (await fetch('/src/utils/useStages.js')).text()
      return {
        // The renderer's loop, not the page's. A running immersive session
        // drives its own frames and stops calling the page's, so a hook
        // built on window frames stalls the moment AR opens and the park
        // never finishes arriving.
        rendererLoop: source.includes('useFrame'),
        // Called, rather than merely named: the comment above it explains
        // why it is not used.
        pageLoop: /requestAnimationFrame\s*\(/.test(source),
        // Two frames per stage, not one.
        gap: Number((source.match(/framesPerStage = (\d+)/) || [])[1])
      }
    })

    expect(behaviour.rendererLoop).toBe(true)
    expect(behaviour.pageLoop, 'nothing that stops inside a session').toBe(false)
    expect(behaviour.gap).toBeGreaterThanOrEqual(2)
  })
})
