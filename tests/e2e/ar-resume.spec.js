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

  test('is heard from inside the canvas, not from outside it', async ({ page }) => {
    await gotoApp(page)

    const source = await page.evaluate(async () => {
      const module = await import('/src/App.jsx?raw')
      return module.default
    })

    // This is the whole of the fix for a page that reloaded itself on the way
    // into every AR session.
    //
    // Unmounting a canvas ends its context too — R3F calls forceContextLoss
    // when it tears a root down — and this app unmounts one every time
    // somebody presses AR, because the 3D view and the AR view are different
    // canvases. A listener attached when the canvas was created heard that
    // deliberate loss and reloaded the page, with the HUD on screen for the
    // second it took.
    //
    // R3F unmounts the React tree first and forces the loss afterwards, so a
    // listener owned by a component inside the tree is gone before it fires.
    expect(source).toContain('<ContextLossGuard onLost={onContextLost} />')
    expect(source).not.toContain('watchForContextLoss')

    // And both canvases are covered: a real loss in either is worth hearing.
    expect(source.match(/<ContextLossGuard /g)?.length).toBe(2)
  })

  test('the guard lets go of the listener when it goes', async ({ page }) => {
    await gotoApp(page)

    const guard = await page.evaluate(async () => {
      const module = await import('/src/components/ContextLossGuard.jsx?raw')
      return module.default
    })

    // The cleanup is the point of the component. Without it this is the same
    // bug with more steps.
    expect(guard).toContain("canvas.addEventListener('webglcontextlost', handle)")
    expect(guard).toContain("return () => canvas.removeEventListener('webglcontextlost', handle)")
  })
})

test.describe('The overlay a session composites', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('is the app’s own element, and it is on the page', async ({ page }) => {
    const root = await page.evaluate(() => {
      const element = document.getElementById('ar-dom-overlay')
      if (!element) return null
      const style = getComputedStyle(element)
      return {
        attached: element.isConnected,
        position: style.position,
        // Out of a session the library keeps it hidden, so nothing of it
        // leaks onto the ordinary app screen.
        display: style.display,
        // The room shows through everywhere the HUD is not.
        pointerEvents: style.pointerEvents,
        // Chrome fullscreens this element for the session, and the user-agent
        // stylesheet paints a fullscreened element black. Stated, or the
        // overlay is an opaque sheet with no camera behind it.
        background: style.backgroundColor
      }
    })

    expect(root, 'the app made an overlay root of its own').not.toBeNull()
    expect(root.attached).toBe(true)
    expect(root.position).toBe('fixed')
    expect(root.display).toBe('none')
    expect(root.pointerEvents).toBe('none')
    expect(root.background).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
  })

  test('is handed to the session rather than left to the library', async ({ page }) => {
    const source = await page.evaluate(async () => {
      const module = await import('/src/App.jsx?raw')
      return module.default
    })

    // Without this the library invents its own root and the HUD is not in it.
    expect(source).toContain('domOverlay: arOverlayRoot')
  })

  test('is where the HUD goes, but only while a session is compositing', async ({ page }) => {
    const targets = await page.evaluate(async () => {
      const { hudPortalTarget, createOverlayRoot } = await import('/src/utils/arOverlayRoot.js')
      const root = createOverlayRoot()

      return {
        // In a session that composites the DOM: into the overlay, or it is
        // not on screen at all.
        compositing: hudPortalTarget({ compositing: true, root })?.id ?? null,
        // The camera fallback is an ordinary page. Rendering its controls
        // into a display:none root would lose them completely.
        fallback: hudPortalTarget({ compositing: false, root }),
        // A headset with no overlay at all: render in place, and the in-scene
        // column is what it actually gets.
        noRoot: hudPortalTarget({ compositing: true, root: null })
      }
    })

    expect(targets.compositing).toBe('ar-dom-overlay')
    expect(targets.fallback).toBeNull()
    expect(targets.noRoot).toBeNull()
  })

  test('the drawer and the HUD go to the same place', async ({ page }) => {
    const source = await page.evaluate(async () => {
      const module = await import('/src/App.jsx?raw')
      return module.default
    })

    // Both, or the drawer is a panel nobody in a session can open.
    expect(source).toContain('renderHud(weatherDrawer)')
    expect(source).toContain('hudActive && renderHud(')
  })
})

/**
 * Starting a session hides the page, and that is not the reader leaving.
 *
 * Reported from a phone: the AR button was pressed, the HUD appeared for a
 * frame, and the app reloaded.
 *
 * An immersive session takes over the screen, so the browser marks the
 * document hidden — the page is not what anybody is looking at any more, the
 * session is. The handler that ends AR when somebody puts the phone down read
 * that as somebody putting the phone down, tore down the session that had
 * just started, and the reload on the way back finished the job.
 *
 * A live session is what tells the two apart, and it is checked in the
 * handler rather than assumed.
 */
test.describe('Entering a session', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('is not mistaken for the reader walking away', async ({ page }) => {
    const source = await page.evaluate(async () => {
      const module = await import('/src/App.jsx?raw')
      return module.default
    })

    const handler = source.slice(
      source.indexOf('const onHide = () => {'),
      source.indexOf('document.addEventListener(\'visibilitychange\', onHide)')
    )

    // The hidden page is only the reader's doing when no session is running.
    expect(handler).toContain("document.visibilityState !== 'hidden'")
    expect(handler).toContain('xrStore.getState?.().session')
    // And that check comes before anything is torn down.
    expect(handler.indexOf('session')).toBeLessThan(handler.indexOf('leaveAR()'))
  })

  test('a session that ends in front of the reader does not arm a reload', async ({ page }) => {
    const source = await page.evaluate(async () => {
      const module = await import('/src/App.jsx?raw')
      return module.default
    })

    const watcher = source.slice(
      source.indexOf('return watchARSession(xrStore, () => {'),
      source.indexOf('}, [renderMode, leaveAR])', source.indexOf('return watchARSession'))
    )

    // Both facts are gathered — who ended it, and whether anybody was
    // looking — and the decision is left to shouldStartOver, which is where
    // the rules are, and where ar-diagnostics.spec.js checks them. Asserting
    // the expression here instead would only be asserting its spelling.
    expect(watcher).toContain('endedByApp: arEndedByApp.current')
    expect(watcher).toContain("hidden: document.visibilityState === 'hidden'")
    expect(watcher).toContain('shouldStartOver(how)')
  })
})
