import { test, expect } from '@playwright/test'
import { gotoApp } from './support/app.js'

/**
 * Coming back after AR was interrupted.
 *
 * What happened on a real phone: someone in a session left the browser for a
 * moment and came back to a 3D view carrying the words "Your device would not
 * start an AR session. Check that the site has camera permission, then try
 * again."
 *
 * Their device was fine and so was the permission. Leaving the browser makes
 * the page hidden, the app ends the session on purpose when that happens —
 * a session nobody is looking at holds the camera and keeps drawing — and the
 * request that was still in flight then failed *because of that*. The app
 * blamed the phone for something it had chosen to do, on top of a 3D view
 * that was working.
 *
 * Two things are checked here: that the app knows the difference between a
 * session it ended and a device that refused one, and that coming back from
 * an interruption starts again cleanly rather than resuming a scene that was
 * rebuilt while nobody was watching.
 */

test.describe('A session the app ended itself', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('is not reported as a device that would not start one', async ({ page }) => {
    const warned = await page.evaluate(async () => {
      const { worthWarningAbout } = await import('/src/utils/arRecovery.js')
      return {
        // The device refused, or the reader declined the camera: worth saying.
        refused: worthWarningAbout({ endedByApp: false }),
        // The app tore the session down a moment ago and the request in
        // flight failed because of that. Not worth saying, and not true.
        ourDoing: worthWarningAbout({ endedByApp: true }),
        // Nothing known: say it, rather than swallow a real failure.
        unknown: worthWarningAbout()
      }
    })

    expect(warned.refused).toBe(true)
    expect(warned.ourDoing).toBe(false)
    expect(warned.unknown).toBe(true)
  })
})

test.describe('Where a reload lands', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('carries the city, so nobody comes back to New York', async ({ page }) => {
    const landings = await page.evaluate(async () => {
      const { reloadTarget } = await import('/src/utils/arRecovery.js')
      return {
        plain: reloadTarget({ city: 'Reykjavík', href: 'https://example.com/' }),
        // The city on screen wins over the one the app was launched with.
        replacing: reloadTarget({
          city: 'Oslo',
          href: 'https://example.com/?city=Cairo&panel=open'
        }),
        // Nothing to carry: still a valid place to land.
        cityless: reloadTarget({ href: 'https://example.com/?panel=open' })
      }
    })

    expect(new URL(landings.plain).searchParams.get('city')).toBe('Reykjavík')

    const replaced = new URL(landings.replacing)
    expect(replaced.searchParams.get('city')).toBe('Oslo')
    // Everything else the reader had is still theirs.
    expect(replaced.searchParams.get('panel')).toBe('open')

    expect(new URL(landings.cityless).searchParams.has('city')).toBe(false)
  })

  test('does not walk straight back into a session, or skip the cover', async ({ page }) => {
    const landing = await page.evaluate(async () => {
      const { reloadTarget } = await import('/src/utils/arRecovery.js')
      return reloadTarget({
        city: 'Lisbon',
        href: 'https://example.com/?view=ar&cover=off&city=Lisbon'
      })
    })

    const url = new URL(landing)
    // Coming back into AR unasked is a camera prompt nobody pressed anything
    // for.
    expect(url.searchParams.has('view')).toBe(false)
    // And the scene is being built from nothing, which is the wait the
    // loading cover exists for.
    expect(url.searchParams.has('cover')).toBe(false)
    expect(url.searchParams.get('city')).toBe('Lisbon')
  })
})

test.describe('A lost graphics context', () => {
  test('takes the app back to a working city rather than a black screen', async ({ page }) => {
    await gotoApp(page, '/?city=Boston')

    // Everything in the scene lives in that context: geometry, textures, every
    // compiled shader. Losing it leaves a canvas that is black for good.
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      const lose = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')
      lose?.loseContext()
    })

    // The reload lands somewhere real, with the city kept.
    await expect
      .poll(() => page.url(), { timeout: 20000 })
      .toContain('city=Boston')
    await expect(page.locator('canvas').first()).toBeAttached()
  })
})
