import { test, expect } from '@playwright/test'
import { gotoApp, openDrawer } from './support/app.js'

/**
 * Turning and resizing the globe with a finger.
 *
 * In AR the globe is an object in the room, and there is no orbit control:
 * the camera is the phone, and moving it means walking. So the gestures move
 * the globe. One finger turns it, two resize it, and a vertical drag does
 * nothing, because tipping a snow globe over is not something anyone wants.
 */

const gesture = (page) => page.evaluate(() => window.__arGesture)

/** Touches, as the browser delivers them. */
async function touch(page, type, points) {
  await page.evaluate(
    ({ type, points }) => {
      const touches = points.map((point, id) =>
        new Touch({
          identifier: id,
          target: document.body,
          clientX: point.x,
          clientY: point.y
        })
      )
      window.dispatchEvent(
        new TouchEvent(type, {
          touches,
          targetTouches: touches,
          changedTouches: touches,
          bubbles: true,
          cancelable: true
        })
      )
    },
    { type, points }
  )
}

test.describe('The arithmetic of a gesture', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('a pinch resizes and does not turn', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { gestureResult } = await import('/src/utils/arGestures.js')
      const start = { x: 200, span: 100, scale: 1, spin: 0.5 }
      return {
        // A hand opening rotates a little as it goes, and nobody means it to.
        spread: gestureResult(start, { x: 260, span: 200 }),
        pinched: gestureResult(start, { x: 140, span: 50 })
      }
    })

    expect(result.spread.scale).toBeCloseTo(2, 5)
    expect(result.spread.spin, 'the pinch left the spin alone').toBeCloseTo(0.5, 5)
    expect(result.pinched.scale).toBeCloseTo(0.5, 5)
    expect(result.pinched.spin).toBeCloseTo(0.5, 5)
  })

  test('a drag turns and does not resize', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { gestureResult } = await import('/src/utils/arGestures.js')
      const start = { x: 200, span: 0, scale: 1.5, spin: 0 }
      return {
        right: gestureResult(start, { x: 395, span: 0 }),
        left: gestureResult(start, { x: 5, span: 0 }),
        // Straight down: the sideways distance is nil, so nothing happens.
        down: gestureResult(start, { x: 200, span: 0 })
      }
    })

    // A quarter of a phone's width is a quarter turn or thereabouts.
    expect(result.right.spin).toBeGreaterThan(1)
    expect(result.right.spin).toBeLessThan(2)
    expect(result.left.spin, 'the other way turns the other way').toBeCloseTo(
      -result.right.spin,
      5
    )
    expect(result.right.scale, 'the drag left the scale alone').toBeCloseTo(1.5, 5)
    expect(result.down.spin).toBe(0)
  })

  test('the globe cannot be pinched away or swallow the room', async ({ page }) => {
    const held = await page.evaluate(async () => {
      const { gestureResult, SCALE_RANGE } = await import('/src/utils/arGestures.js')
      const start = { x: 0, span: 100, scale: 1, spin: 0 }
      return {
        range: SCALE_RANGE,
        tiny: gestureResult(start, { x: 0, span: 0.5 }).scale,
        huge: gestureResult(start, { x: 0, span: 100000 }).scale
      }
    })

    expect(held.tiny).toBe(held.range.min)
    expect(held.huge).toBe(held.range.max)
    expect(held.range.min).toBeGreaterThan(0)
  })
})

test.describe('Gestures in an AR session', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch belongs to a touch profile')

  async function enterAR(page, context) {
    await context.grantPermissions(['camera'])
    await page.addInitScript(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 320
      canvas.height = 240
      const context2d = canvas.getContext('2d')
      context2d.fillStyle = '#123'
      context2d.fillRect(0, 0, 320, 240)
      const stream = canvas.captureStream(15)
      navigator.mediaDevices = navigator.mediaDevices || {}
      navigator.mediaDevices.getUserMedia = async () => stream
    })
    await gotoApp(page)
    await openDrawer(page)
    await page.getByRole('button', { name: /AR Mode/i }).dispatchEvent('click')
    await expect(page.getByTestId('loading-screen')).toHaveCount(0, { timeout: 25000 })
  }

  test('a drag turns the globe, and a pinch resizes it', async ({ page, context }) => {
    await enterAR(page, context)

    expect(await gesture(page)).toMatchObject({ scale: 1, spin: 0, touched: false })

    await touch(page, 'touchstart', [{ x: 120, y: 500 }])
    await touch(page, 'touchmove', [{ x: 300, y: 505 }])
    await touch(page, 'touchend', [])

    const turned = await gesture(page)
    expect(turned.spin, 'dragged right, turned right').toBeGreaterThan(0.5)
    expect(turned.scale, 'and did not resize').toBe(1)
    expect(turned.touched).toBe(true)

    await touch(page, 'touchstart', [{ x: 150, y: 500 }, { x: 250, y: 500 }])
    await touch(page, 'touchmove', [{ x: 100, y: 500 }, { x: 300, y: 500 }])
    await touch(page, 'touchend', [])

    const resized = await gesture(page)
    expect(resized.scale, 'fingers twice as far apart').toBeCloseTo(2, 1)
    expect(resized.spin, 'and the turn is where the drag left it').toBeCloseTo(turned.spin, 5)
  })

  test('a tap on a button is not a gesture', async ({ page, context }) => {
    await enterAR(page, context)

    // Where the controls are, which is where a thumb is.
    const exit = page.getByRole('button', { name: /Exit AR/i })
    await expect(exit).toBeVisible()

    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((node) =>
        /Exit AR/.test(node.textContent)
      )
      const point = new Touch({
        identifier: 0,
        target: button,
        clientX: 10,
        clientY: 10
      })
      button.dispatchEvent(
        new TouchEvent('touchstart', {
          touches: [point],
          targetTouches: [point],
          changedTouches: [point],
          bubbles: true,
          cancelable: true
        })
      )
      window.dispatchEvent(
        new TouchEvent('touchmove', {
          touches: [new Touch({ identifier: 0, target: button, clientX: 200, clientY: 10 })],
          bubbles: true,
          cancelable: true
        })
      )
    })

    const after = await gesture(page)
    expect(after.spin, 'the globe stayed put').toBe(0)
    expect(after.scale).toBe(1)
  })

  test('the hint goes once the gesture has been found', async ({ page, context }) => {
    await enterAR(page, context)

    await expect(page.getByTestId('ar-gesture-hint')).toBeVisible()

    await touch(page, 'touchstart', [{ x: 120, y: 500 }])
    await touch(page, 'touchmove', [{ x: 260, y: 500 }])
    await touch(page, 'touchend', [])

    await expect(page.getByTestId('ar-gesture-hint')).toHaveCount(0)
  })
})
