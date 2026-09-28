import { test, expect } from '@playwright/test'
import { gotoApp, openDrawer } from './support/app.js'

/**
 * The AR interface.
 *
 * Three things were wrong with it and are fixed together here, because they
 * are one thing: what the viewer has in front of them in a session.
 *
 * The controls were a row of loose pills at the bottom of the phone screen
 * and, unrelated to them, the app's ordinary drawer handle in a corner. They
 * are now one instrument — two rails of the same smoked glass, with the
 * drawer hung off the top one.
 *
 * On a headset, where the page cannot be drawn over the room at all, the
 * controls are in the scene instead, and those were nailed to the spot the
 * session started at: walk three steps and they are behind you in a corner.
 * They follow the viewer now, with enough slack to be looked away from.
 *
 * And the camera could not be leaned into anything: the default near plane
 * cut the front off the globe from ten centimetres away, which is precisely
 * the distance someone puts their face at to look inside one.
 */

test.describe('How close the viewer can get', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('the session is given a near plane a viewer can lean past', async ({ page }) => {
    const camera = await page.evaluate(async () => {
      const { AR_CAMERA } = await import('/src/utils/arCamera.js')
      return AR_CAMERA
    })

    // Three reads camera.near into the session's render state, so this number
    // is the one the device clips against. The old default of 0.1 cut the
    // front off the globe from arm's length.
    expect(camera.near).toBeLessThanOrEqual(0.01)
    // And the far plane is bounded, because depth precision is spent on the
    // ratio between the two.
    expect(camera.far).toBeGreaterThan(0)
    expect(camera.far / camera.near).toBeLessThanOrEqual(100000)
  })

  test('and the AR canvas is actually given it', async ({ page }) => {
    const source = await page.evaluate(async () => {
      const module = await import('/src/App.jsx?raw')
      return module.default
    })

    expect(source).toContain('camera={AR_CAMERA}')
  })

  test('a face against the glass sees through it, not into a cut', async ({ page }) => {
    const seen = await page.evaluate(async () => {
      const THREE = await import('/node_modules/.vite/deps/three.js')
      const { AR_CAMERA } = await import('/src/utils/arCamera.js')

      // A wall three centimetres away: a viewer with their nose against the
      // globe, which is what everybody does with one.
      const render = (near) => {
        const canvas = document.createElement('canvas')
        canvas.width = 16
        canvas.height = 16
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
        renderer.setSize(16, 16, false)

        const scene = new THREE.Scene()
        const wall = new THREE.Mesh(
          new THREE.PlaneGeometry(4, 4),
          new THREE.MeshBasicMaterial({ color: '#ffffff' })
        )
        wall.position.z = -0.03
        scene.add(wall)

        const camera = new THREE.PerspectiveCamera(AR_CAMERA.fov, 1, near, AR_CAMERA.far)
        renderer.render(scene, camera)

        const gl = renderer.getContext()
        const pixels = new Uint8Array(4)
        gl.readPixels(8, 8, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
        renderer.dispose()
        return pixels[0]
      }

      return { atDefault: render(0.1), atOurs: render(AR_CAMERA.near) }
    })

    // Clipped away entirely at the default: this is the bug, and it is what
    // the screenshots of a sliced-open city were showing.
    expect(seen.atDefault).toBeLessThan(10)
    // And there at ours.
    expect(seen.atOurs).toBeGreaterThan(240)
  })
})

test.describe('A panel that follows the viewer', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('stays put while they shift about, and comes when they go', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { followStep, FOLLOW_SLACK } = await import('/src/utils/viewerFollow.js')
      const frame = 1 / 72

      return {
        // A lean, a glance, weight on the other foot: the panel holds still.
        nudged: followStep({ gap: FOLLOW_SLACK * 0.5, chasing: false, delta: frame }),
        // Walking to the other side of the fountain: it comes.
        walked: followStep({ gap: FOLLOW_SLACK * 4, chasing: false, delta: frame }),
        // Already on its way and now well inside the slack — it keeps coming
        // rather than stopping short, which is what makes it judder.
        arriving: followStep({ gap: FOLLOW_SLACK * 0.3, chasing: true, delta: frame }),
        // And it stops when it is actually there.
        arrived: followStep({ gap: 0.005, chasing: true, delta: frame })
      }
    })

    expect(result.nudged.chasing).toBe(false)
    expect(result.nudged.fraction).toBe(0)
    expect(result.walked.chasing).toBe(true)
    expect(result.walked.fraction).toBeGreaterThan(0)
    // Never the whole gap in one frame: that is a snap, not a follow.
    expect(result.walked.fraction).toBeLessThan(0.2)
    expect(result.arriving.chasing).toBe(true)
    expect(result.arrived.chasing).toBe(false)
  })

  test('eases the same way whatever the frame rate', async ({ page }) => {
    const remaining = await page.evaluate(async () => {
      const { followStep } = await import('/src/utils/viewerFollow.js')

      const run = (fps) => {
        let gap = 1
        let chasing = false
        for (let frame = 0; frame < fps; frame += 1) {
          const step = followStep({ gap, chasing, delta: 1 / fps })
          chasing = step.chasing
          gap -= gap * step.fraction
        }
        return gap
      }

      return { slow: run(30), fast: run(120) }
    })

    // One second of chasing closes the same amount of the gap at 30fps as at
    // 120. A flat fraction per frame would have the fast one four times ahead.
    expect(remaining.slow).toBeCloseTo(remaining.fast, 3)
  })

  test('turns the short way round', async ({ page }) => {
    const turns = await page.evaluate(async () => {
      const { shortestTurn, headingFor } = await import('/src/utils/viewerFollow.js')
      return {
        // Across the seam behind the viewer: a hair one side of due south to
        // a hair the other.
        acrossTheSeam: shortestTurn(Math.PI - 0.1, -Math.PI + 0.1),
        quarter: shortestTurn(0, Math.PI / 2),
        // A group's front is -Z, so facing -Z is no turn at all, and facing
        // +X is a quarter turn the other way.
        forward: headingFor(0, -1),
        right: headingFor(1, 0)
      }
    })

    expect(Math.abs(turns.acrossTheSeam)).toBeLessThan(0.3)
    expect(turns.quarter).toBeCloseTo(Math.PI / 2, 6)
    expect(turns.forward).toBeCloseTo(0, 6)
    expect(turns.right).toBeCloseTo(-Math.PI / 2, 6)
  })
})

test.describe('The HUD', () => {
  test.skip(({ isMobile }) => !isMobile, 'the HUD is what a phone gets in AR')

  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['camera'])
    // No WebXR here, so the app takes its camera fallback — which is the same
    // HUD a real session on a phone composites over its own view.
    await page.addInitScript(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 480
      const stream = canvas.captureStream(10)
      navigator.mediaDevices.getUserMedia = () => Promise.resolve(stream)
    })
    await gotoApp(page)
  })

  const enterAR = async (page) => {
    await openDrawer(page)
    await page.getByRole('button', { name: /AR Mode/i }).click()
    await expect(page.getByTestId('ar-hud')).toBeVisible({ timeout: 20000 })
  }

  test('is one instrument, and the drawer is part of it', async ({ page }) => {
    await enterAR(page)

    // The drawer's handle is on the HUD's top rail now, and the app's own
    // corner button is gone: two handles for one drawer is one too many.
    const handle = page.getByTestId('ar-hud-drawer')
    await expect(handle).toBeVisible()
    await expect(page.getByTestId('ar-controls')).toBeVisible()
    await expect(page.getByRole('button', { name: /Open Weather Info/i })).toHaveCount(1)

    await expect(page.getByTestId('weather-drawer')).toHaveAttribute('data-open', 'false')
    await handle.click()
    await expect(page.getByTestId('weather-drawer')).toHaveAttribute('data-open', 'true')
    await expect(handle).toHaveAttribute('aria-expanded', 'true')

    // And it closes from the same handle, rather than needing a different one.
    await handle.click()
    await expect(page.getByTestId('weather-drawer')).toHaveAttribute('data-open', 'false')
  })

  test('says what the weather is doing, not only what the buttons do', async ({ page }) => {
    await enterAR(page)

    const readout = page.getByTestId('ar-hud-readout')
    await expect(readout).toBeVisible()
    // The city it is showing, and a temperature: a HUD that reports nothing
    // is a remote control.
    await expect(readout).toContainText(/\w/)
    await expect(readout).toContainText('°')
  })

  test('lets the room through everywhere it is not', async ({ page }) => {
    await enterAR(page)

    // The frame covers the screen so its rails can sit at top and bottom, and
    // would eat every tap and drag if it took the pointer. The gestures that
    // turn and resize the globe are on the window.
    const through = await page.evaluate(() => {
      const hud = document.querySelector('[data-testid="ar-hud"]')
      const rail = document.querySelector('[data-testid="ar-controls"]')
      return {
        frame: getComputedStyle(hud).pointerEvents,
        rail: getComputedStyle(rail).pointerEvents
      }
    })

    expect(through.frame).toBe('none')
    expect(through.rail).toBe('auto')
  })

  test('keeps its rails clear of the notch and the home bar', async ({ page }) => {
    await enterAR(page)

    const box = page.viewportSize()
    const top = await page.getByTestId('ar-hud-drawer').boundingBox()
    const bottom = await page.getByTestId('ar-controls').boundingBox()

    expect(top.y).toBeGreaterThanOrEqual(8)
    expect(bottom.y + bottom.height).toBeLessThanOrEqual(box.height - 8)
    // Both rails, and everything on them, inside the screen: the old in-scene
    // buttons ran off the edges of it.
    expect(bottom.x).toBeGreaterThanOrEqual(0)
    expect(bottom.x + bottom.width).toBeLessThanOrEqual(box.width)
  })

  test('the way out is still the way out', async ({ page }) => {
    await enterAR(page)

    await page.getByTestId('ar-exit').click()
    await expect(page.getByTestId('ar-hud')).toHaveCount(0, { timeout: 20000 })
    // Back to the ordinary app, with its own drawer handle again.
    await expect(page.getByRole('button', { name: /Open Weather Info/i })).toBeVisible({
      timeout: 20000
    })
  })
})

test.describe('Locking the globe to the room', () => {
  test('the globe is hung on an anchor, not on the session origin', async ({ page }) => {
    await gotoApp(page)

    const source = await page.evaluate(async () => {
      // As written, rather than as the dev server rewrites it: ?raw hands
      // back the file itself instead of the compiled module.
      const module = await import('/src/components/ar/AnchoredGlobe.jsx?raw')
      return module.default
    })

    // An anchor is the tracking system's own handle on a place, and it is
    // updated when the system relocalises. Content on a plain offset from the
    // reference space moves when that space is re-estimated, which is what
    // sent the globe across the room after someone leaned into it.
    expect(source).toContain('useRequestXRAnchor')
    expect(source).toContain('anchorSpace')
    expect(source).toContain('XRSpace')
    // Anchors are optional. Where they are refused, the old offset still has
    // to work rather than leaving an empty room.
    expect(source).toMatch(/<group position=\{position\}>/)
  })
})
