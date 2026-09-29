import { test, expect } from '@playwright/test'
import { gotoApp } from './support/app.js'

/**
 * What the app remembers about a session that stopped.
 *
 * Reported from a phone, twice over: the HUD appeared and then the session
 * ended and the app reloaded. The first report was the app's own doing and
 * is fixed. The second is the session ending on its own — and from a desk
 * there is no way to see why, because none of it exists outside a real
 * session on real hardware.
 *
 * So the app keeps an account of it: how long the session ran, whether the
 * app asked for it to end, whether anybody was looking at the screen, and
 * whatever was thrown while it was running. Written where a reload cannot
 * lose it, and readable from the page, so what comes back from a device is
 * what happened rather than what it looked like.
 *
 * The rules that account feeds are what can be checked here.
 */

test.describe('Telling an interruption from a failure', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('a session that dies on opening never triggers a reload', async ({ page }) => {
    const decisions = await page.evaluate(async () => {
      const { shouldStartOver, TOO_SHORT_MS } = await import('/src/utils/arDiagnostics.js')

      return {
        // The reported bug: a session that lasts a moment. Reloading into a
        // failure that happens every time is a loop, and a loop is worse
        // than the failure — that at least leaves a working 3D view.
        diedOpening: shouldStartOver({ ranMs: 900, hidden: true }),
        // A real interruption: minutes in, screen away, phone pocketed.
        pocketed: shouldStartOver({ ranMs: 90_000, hidden: true }),
        // Ended in front of the reader: they watched it happen and the 3D
        // view is right there. Nothing to start over from.
        watched: shouldStartOver({ ranMs: 90_000, hidden: false }),
        // The exit button. An ordinary return.
        ourDoing: shouldStartOver({ ranMs: 90_000, hidden: true, endedByApp: true }),
        threshold: TOO_SHORT_MS
      }
    })

    expect(decisions.diedOpening).toBe(false)
    expect(decisions.pocketed).toBe(true)
    expect(decisions.watched).toBe(false)
    expect(decisions.ourDoing).toBe(false)
    // Seconds, not milliseconds: long enough that a slow start is not a
    // failure, short enough that nobody had time to wander off.
    expect(decisions.threshold).toBeGreaterThanOrEqual(3000)
  })

  test('and says so, with whatever was thrown', async ({ page }) => {
    const lines = await page.evaluate(async () => {
      const { explainSessionEnd } = await import('/src/utils/arDiagnostics.js')

      return {
        withError: explainSessionEnd({
          ranMs: 1200,
          error: "Cannot read properties of null (reading 'anchorSpace')"
        }),
        quickAndQuiet: explainSessionEnd({ ranMs: 1200 }),
        // Somebody finishing a session they enjoyed is not an incident.
        ordinary: explainSessionEnd({ ranMs: 120_000 }),
        // Nor is pressing exit.
        ourDoing: explainSessionEnd({ ranMs: 400, endedByApp: true })
      }
    })

    expect(lines.withError).toContain('anchorSpace')
    expect(lines.withError).toContain('1.2s')
    expect(lines.quickAndQuiet).toContain('on its own')
    // And it says the app is still usable, because it is.
    expect(lines.quickAndQuiet).toMatch(/3D|safe/)
    expect(lines.ordinary).toBeNull()
    expect(lines.ourDoing).toBeNull()
  })
})

test.describe('The account itself', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page)
  })

  test('survives the reload it is meant to explain', async ({ page }) => {
    await page.evaluate(async () => {
      const { noteAR } = await import('/src/utils/arDiagnostics.js')
      noteAR('session-start', { compositing: true })
      noteAR('session-end', { ranMs: 800, hidden: true })
    })

    await page.reload()

    const kept = await page.evaluate(async () => {
      const { readARLog } = await import('/src/utils/arDiagnostics.js')
      return readARLog()
    })

    // A reload is exactly when the evidence would otherwise be lost, which
    // is the whole reason it is not held in memory.
    expect(kept.map((entry) => entry.what)).toEqual(['session-start', 'session-end'])
    expect(kept[1].ranMs).toBe(800)
    // Timed, so two of them can be told apart.
    expect(Date.parse(kept[0].at)).not.toBeNaN()
  })

  test('is readable from the page, and does not grow without end', async ({ page }) => {
    const log = await page.evaluate(async () => {
      const { noteAR } = await import('/src/utils/arDiagnostics.js')
      for (let i = 0; i < 40; i += 1) noteAR('session-end', { ranMs: i })
      return { length: window.__arLog.length, last: window.__arLog.at(-1).ranMs }
    })

    // Enough to see a pattern across several attempts, few enough to never
    // be a storage problem of its own.
    expect(log.length).toBeLessThanOrEqual(12)
    expect(log.last, 'the most recent is the one kept').toBe(39)
  })
})
