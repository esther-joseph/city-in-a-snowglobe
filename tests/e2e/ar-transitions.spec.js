import { test, expect } from '@playwright/test'
import { gotoApp, openDrawer } from './support/app.js'

/**
 * Going into AR, and coming back out of it.
 *
 * Coming out was the bug. Only the exit button told the app anything: when
 * the session ended on its own, by the system back gesture or by the phone
 * being put down, the app carried on rendering its AR view with nothing
 * behind it. That view's camera sits at standing height in the middle of a
 * park scaled to fit inside a globe, so what anyone pressing back actually
 * got was the fountain from a foot above it, looking straight down.
 *
 * A real session cannot be started from a test browser, so the session watch
 * is covered through the module and the rest through the camera fallback,
 * which is the one AR route a phone profile can take here.
 */

const cover = (page) => page.getByTestId('loading-screen')

/**
 * How long to allow for a cover to lift.
 *
 * It is held for well under two seconds, but what it is covering is a canvas
 * being built from nothing, and a machine already running a browser or two
 * can spend a while compiling those shaders before it gets back to the timer.
 * The generous end of the range, for the same reason the loading screen's own
 * spec sits there.
 */
const COVER_GONE_MS = 25000

/**
 * Dispatched rather than clicked. This browser runs with a WebXR emulator
 * that lays its own device panel over the whole page once a session starts,
 * so a click at coordinates lands on that instead. On a device the drawer is
 * inside the session's dom-overlay and takes taps normally.
 */
const press = (page, name) => page.getByRole('button', { name }).dispatchEvent('click')

/** Hand the page a camera it can open without a real device. */
async function stubCamera(page) {
  await page.addInitScript(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 240
    const context = canvas.getContext('2d')
    context.fillStyle = '#123'
    context.fillRect(0, 0, canvas.width, canvas.height)
    const stream = canvas.captureStream(15)
    navigator.mediaDevices = navigator.mediaDevices || {}
    navigator.mediaDevices.getUserMedia = async () => stream
  })
}

test.describe('Leaving the session', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('the app hears a session it did not end', async ({ page }) => {
    const seen = await page.evaluate(async () => {
      const { watchARSession } = await import('/src/utils/arSession.js')

      // A stand-in for the XR store: the same two calls the real one gets.
      const listeners = []
      let state = { session: null }
      const store = {
        getState: () => state,
        subscribe: (listener) => {
          listeners.push(listener)
          return () => listeners.splice(listeners.indexOf(listener), 1)
        }
      }
      const set = (next) => {
        state = next
        listeners.forEach((listener) => listener(state))
      }

      const ends = []
      const stop = watchARSession(store, () => ends.push('ended'))

      set({ session: { id: 1 } })
      // Started. Nothing has ended yet.
      const afterStart = ends.length
      set({ session: null })
      const afterEnd = ends.length
      // A second update with no session is not a second ending.
      set({ session: null })
      const afterIdle = ends.length
      stop()
      set({ session: { id: 2 } })
      set({ session: null })

      return { afterStart, afterEnd, afterIdle, afterStop: ends.length }
    })

    expect(seen.afterStart).toBe(0)
    expect(seen.afterEnd).toBe(1)
    expect(seen.afterIdle).toBe(1)
    // Once the app has left AR it stops listening.
    expect(seen.afterStop).toBe(1)
  })

  test('ending a session nobody started is not an error', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { endARSession } = await import('/src/utils/arSession.js')

      const ended = []
      const withSession = {
        getState: () => ({ session: { end: async () => ended.push('ended') } })
      }
      const refuses = {
        getState: () => ({
          session: {
            end: async () => {
              throw new Error('already ending')
            }
          }
        })
      }

      return {
        empty: await endARSession({ getState: () => ({}) }),
        nothing: await endARSession(undefined),
        running: await endARSession(withSession),
        ends: ended.length,
        // A session the browser is already tearing down still counts as gone.
        refused: await endARSession(refuses)
      }
    })

    expect(result.empty).toBe(false)
    expect(result.nothing).toBe(false)
    expect(result.running).toBe(true)
    expect(result.ends).toBe(1)
    expect(result.refused).toBe(true)
  })
})

test.describe('Covering the change over', () => {
  test.skip(({ isMobile }) => !isMobile, 'the camera route needs a touch profile')

  test('a cover goes up on the way in and on the way out', async ({ page, context }) => {
    await context.grantPermissions(['camera'])
    await stubCamera(page)
    await gotoApp(page)
    await openDrawer(page)

    await expect(cover(page), 'nothing covering the 3D view').toHaveCount(0)

    await press(page, /AR Mode/i)
    // Up while the permissions and the session are sorted out.
    await expect(cover(page)).toBeVisible()
    await expect(cover(page)).toHaveCount(0, { timeout: COVER_GONE_MS })

    await openDrawer(page)
    await press(page, /3D Mode/i)
    await expect(cover(page), 'and up again on the way back').toBeVisible()
    await expect(cover(page)).toHaveCount(0, { timeout: COVER_GONE_MS })
  })

  test('the back button leaves AR, not the site', async ({ page, context }) => {
    await context.grantPermissions(['camera'])
    await stubCamera(page)
    await gotoApp(page)
    const landed = page.url()

    await openDrawer(page)
    await press(page, /AR Mode/i)
    await expect(cover(page)).toHaveCount(0, { timeout: COVER_GONE_MS })

    await page.goBack()

    // Still here, and back in the 3D view.
    expect(page.url()).toBe(landed)
    await openDrawer(page)
    await expect(page.getByRole('button', { name: /3D Mode/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  test('the 3D scene is built again rather than resumed', async ({ page, context }) => {
    await context.grantPermissions(['camera'])
    await stubCamera(page)
    await gotoApp(page)

    // Where the camera sits before anything happens.
    const before = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      return canvas ? canvas.width > 0 : false
    })
    expect(before).toBe(true)

    await openDrawer(page)
    await press(page, /AR Mode/i)
    await expect(cover(page)).toHaveCount(0, { timeout: COVER_GONE_MS })
    await openDrawer(page)
    await press(page, /3D Mode/i)
    await expect(cover(page)).toHaveCount(0, { timeout: COVER_GONE_MS })

    // The globe is on screen again, seen from the default vantage: far
    // enough out that the whole thing is in frame, which is what the close
    // overhead view of the fountain was not.
    const camera = await page.evaluate(() => {
      const scene = window.__snowGlobeScene
      if (!scene) return null
      let found = null
      scene.traverse((object) => {
        if (object.isCamera && !found) found = object.position.toArray()
      })
      return found
    })

    if (camera) {
      expect(Math.hypot(camera[0], camera[1], camera[2])).toBeGreaterThan(20)
    }
  })
})
