import { test, expect } from '@playwright/test'
import { gotoApp, openDrawer } from './support/app.js'

/**
 * Getting into AR at all.
 *
 * The app used to check capability twice: once in the handler behind the
 * button, and again in an effect that re-decided everything. The effect read
 * two fields getARCapability has never returned, `webXRAvailable` and
 * `isIOS`, so both were undefined, `!capability.webXRAvailable` was always
 * true, and every attempt to enter AR set the mode straight back to 3D. The
 * WebXR message is null, so it did that silently. AR looked like it never
 * loaded.
 *
 * A real immersive session cannot be driven from here, so what is covered is
 * the decision path: the capability contract, and the camera fallback, which
 * is the one route a phone profile can actually take in a test browser.
 */

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

test.describe('AR capability contract', () => {
  test('returns every field the app reads', async ({ page }) => {
    await gotoApp(page)

    const capability = await page.evaluate(async () => {
      const { getARCapability } = await import('/src/utils/arSupport.js')
      return getARCapability()
    })

    // The exact fields App.jsx branches on. A rename here is what broke AR.
    for (const key of [
      'mode',
      'supported',
      'message',
      'label',
      'webXRARSupported',
      'quickLookSupported',
      'cameraSupported',
      'isIOSFamily',
      'iosVersion'
    ]) {
      expect(capability, `getARCapability().${key}`).toHaveProperty(key)
    }

    expect(['webxr', 'quicklook', 'camera', 'none']).toContain(capability.mode)
  })

  test('the app only reads fields the capability actually has', async ({ request }) => {
    const source = await (await request.get('/src/App.jsx')).text()

    // Every field App.jsx reads off a capability, checked against the list
    // above. A typo or a rename here is the whole bug.
    const read = [...source.matchAll(/capability\.(\w+)/g)].map((match) => match[1])
    const returned = [
      'mode',
      'supported',
      'message',
      'label',
      'webXRARSupported',
      'quickLookSupported',
      'cameraSupported',
      'isIOSFamily',
      'iosVersion'
    ]

    expect(read.length, 'App.jsx reads at least one capability field').toBeGreaterThan(0)
    for (const field of new Set(read)) {
      expect(returned, `App.jsx reads capability.${field}`).toContain(field)
    }
  })
})

test.describe('AR entry', () => {
  test.skip(({ isMobile }) => !isMobile, 'the camera route needs a touch profile')

  test('a phone enters AR rather than bouncing back to 3D', async ({ page, context }) => {
    await context.grantPermissions(['camera'])
    await stubCamera(page)
    await gotoApp(page)
    await openDrawer(page)

    const arButton = page.getByRole('button', { name: /AR Mode/i })
    await expect(arButton).toBeEnabled()
    await arButton.click()

    // Entering AR closes the drawer and swaps the scene for the AR view. What
    // used to happen instead was an immediate, silent return to 3D.
    await expect(page.getByRole('button', { name: /Open Weather Info/i })).toBeVisible()
    await expect
      .poll(
        () => page.evaluate(() => Boolean(document.querySelector('video, canvas'))),
        { timeout: 15000 }
      )
      .toBe(true)

    // The mode toggle should now report AR as the active one.
    await openDrawer(page)
    await expect(page.getByRole('button', { name: /AR Mode/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })
})
