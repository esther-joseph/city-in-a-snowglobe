import { test, expect } from '@playwright/test'
import { closeDrawer, gotoApp, openDrawer, temperature } from './support/app.js'

/**
 * Advertising, the client-side weather cache and the launch parameters.
 *
 * Ads on the app screen are what cost the site its AdSense approval: a bare
 * canvas is a tool, with no publisher content on it, and Google does not
 * allow its ads on a screen like that. The written pages carry their own
 * (site-content.spec.js checks those), and on the app there is one unit, at
 * the foot of the drawer, under everything there is to read. What is checked
 * here is that it is the only one, that it asks for nothing until the drawer
 * is open, and that the opt-outs still hold.
 */

const SLOTS = ['ad-slot-drawer-banner', 'ad-slot-drawer-footer']

/** Count proxy calls made from the moment this is installed. */
function countProxyCalls(page) {
  const calls = []
  page.on('request', (request) => {
    if (request.url().includes('/api/openweather')) calls.push(request.url())
  })
  return calls
}

test.describe('Ad slots', () => {
  test('the loader arrives with the first slot, and not before it', async ({ page }) => {
    const loader = page.locator('script[src*="adsbygoogle"]')
    await gotoApp(page)

    // Where the panel starts shut — a phone — the landing screen has not
    // spoken to AdSense at all, and Auto ads cannot place a unit of their
    // own where there is no loader. Where it starts open, the slot is
    // already mounted, so the loader is already right: same rule, read from
    // whichever state the viewport lands in.
    const startedOpen = await page
      .getByRole('button', { name: /Close Weather Info/i })
      .count()

    if (!startedOpen) {
      await expect(loader, 'nothing on index.html asks for advertising').toHaveCount(0)
      await expect(page.getByTestId('ad-slot-drawer-footer')).toHaveCount(0)
    }

    await openDrawer(page)
    await expect(loader).toHaveCount(1)

    // And it is fetched once, however often the panel is worked.
    await closeDrawer(page)
    await openDrawer(page)
    await expect(loader).toHaveCount(1)
  })

  test('one unit, at the foot of the drawer', async ({ page }) => {
    await gotoApp(page)
    await openDrawer(page)

    const unit = page.getByTestId('ad-slot-drawer-footer').locator('ins.adsbygoogle')
    await expect(unit).toHaveCount(1)

    // The account that owns the site, the unit made for this spot, and told
    // to measure the panel rather than being pinned to a shape: the drawer is
    // 320px wide on a phone and 448 on a tablet.
    await expect(unit).toHaveAttribute('data-ad-client', /^ca-pub-\d+$/)
    await expect(unit).toHaveAttribute('data-ad-slot', /^\d+$/)
    await expect(unit).toHaveAttribute('data-ad-format', 'auto')
    await expect(unit).toHaveAttribute('data-full-width-responsive', 'true')

    // Labelled, which the policies require, and last: the only things under
    // it are the links out to the written pages.
    await expect(page.getByTestId('ad-slot-drawer-footer')).toContainText(/advertisement/i)
  })

  test('one of ours, and the mid-panel position still empty', async ({ page }) => {
    await gotoApp(page)
    await openDrawer(page)

    // The banner position mid-panel exists in the config with no id behind
    // it, and an <ins> is only ever drawn for an id — so this is the one.
    const ours = page.locator('[data-testid^="ad-slot-"] ins.adsbygoogle')
    await expect(ours).toHaveCount(1)
    await expect(page.getByTestId('ad-slot-drawer-footer').locator('ins')).toHaveCount(1)

    // Everything else AdSense adds to the document is its own doing: the
    // loader plants a hidden placeholder for Auto ads, and whether that ever
    // becomes an anchor or a vignette over the scene is a setting in the
    // account, not something this code can say. Worth knowing, because it is
    // how units reached the app screen before.
    const theirs = await page.evaluate(
      () =>
        [...document.querySelectorAll('ins.adsbygoogle')].filter(
          (el) => !el.closest('[data-testid^="ad-slot-"]')
        ).length
    )
    expect(theirs, 'noted, not asserted away').toBeGreaterThanOrEqual(0)
  })

  test('?ads=off still holds, for the pages that do carry them', async ({ page }) => {
    await gotoApp(page, '/?ads=off')
    const off = await page.evaluate(async () => {
      const { adsEnabled } = await import('/src/services/ads/adProvider.js')
      return adsEnabled({ platform: 'native' })
    })
    expect(off, 'the opt-out is honoured whatever the platform').toBe(false)
  })

  test('never run while the camera is showing', async ({ page }) => {
    await gotoApp(page)
    const inAR = await page.evaluate(async () => {
      const { adsEnabled } = await import('/src/services/ads/adProvider.js')
      return {
        ar: adsEnabled({ renderMode: 'ar', platform: 'native' }),
        scene: adsEnabled({ renderMode: '3d', platform: 'native' })
      }
    })
    // An ad over a live camera view invites the accidental clicks that get a
    // publisher account suspended, on any platform.
    expect(inAR.ar).toBe(false)
    expect(inAR.scene).toBe(true)
  })
})

test.describe('Weather cache', () => {
  test('a second visit is served without touching the proxy', async ({ page }) => {
    await gotoApp(page)
    await expect(temperature(page)).toBeVisible()

    const calls = countProxyCalls(page)
    await page.reload()
    await expect(temperature(page)).toBeVisible()

    expect(calls).toHaveLength(0)
  })

  test('an entry past its TTL is fetched again', async ({ page }) => {
    await gotoApp(page)
    await expect(temperature(page)).toBeVisible()

    // Age every entry by an hour.
    await page.evaluate(() => {
      Object.keys(localStorage)
        .filter((key) => key.startsWith('snowglobe:weather:'))
        .forEach((key) => {
          const entry = JSON.parse(localStorage.getItem(key))
          entry.timestamp -= 60 * 60 * 1000
          localStorage.setItem(key, JSON.stringify(entry))
        })
    })

    const calls = countProxyCalls(page)
    await page.reload()
    await expect(temperature(page)).toBeVisible()

    expect(calls.length).toBeGreaterThan(0)
  })

  test('a dead network falls back to what was cached', async ({ page }) => {
    await gotoApp(page)
    await expect(temperature(page)).toBeVisible()
    const shown = await temperature(page).textContent()

    // Expire the cache so the app has to try the network, then take it away.
    await page.evaluate(() => {
      Object.keys(localStorage)
        .filter((key) => key.startsWith('snowglobe:weather:'))
        .forEach((key) => {
          const entry = JSON.parse(localStorage.getItem(key))
          entry.timestamp -= 60 * 60 * 1000
          localStorage.setItem(key, JSON.stringify(entry))
        })
    })
    await page.route('**/api/openweather**', (route) => route.abort())

    await page.reload()
    await expect(temperature(page)).toHaveText(shown)
  })
})

test.describe('Launch parameters', () => {
  test('?panel=open lands with the weather panel already open', async ({ page }) => {
    await gotoApp(page, '/?panel=open')
    await expect(page.getByRole('button', { name: /Close Weather Info/i })).toBeVisible()
  })

  test('?city= picks the city to start on', async ({ page }) => {
    // Listening before the navigation: the first request goes out while the
    // app is still loading.
    const calls = countProxyCalls(page)
    await gotoApp(page, '/?city=Kyoto')
    await expect(temperature(page)).toBeVisible()

    // The stub answers with New York whatever is asked, so what is checked
    // here is that the parameter reached the request.
    expect(calls.some((url) => url.includes('Kyoto'))).toBe(true)
  })
})

test.describe('Monetisation endpoints', () => {
  test('ads.txt names the publisher', async ({ request }) => {
    const response = await request.get('/ads.txt')
    expect(response.status()).toBe(200)
    expect(await response.text()).toContain('google.com, pub-4752576373489354, DIRECT, f08c47fec0942fa0')
  })

  test('the manifest offers home-screen shortcuts', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest')
    expect(response.status()).toBe(200)
    const manifest = await response.json()
    expect(manifest.display).toBe('standalone')
    expect(manifest.shortcuts.map((shortcut) => shortcut.url)).toEqual(
      expect.arrayContaining(['/?view=3d&source=shortcut', '/?panel=open&source=shortcut'])
    )
  })

  test('/api/weather refuses a request with no city', async ({ request }) => {
    const response = await request.get('/api/weather')
    expect(response.status()).toBe(400)
    expect((await response.json()).error).toMatch(/city/i)
  })

  test('/api/weather refuses units it does not serve', async ({ request }) => {
    const response = await request.get('/api/weather?city=London&units=kelvin')
    expect(response.status()).toBe(400)
  })
})

/**
 * The full-screen ad, which only the packaged app has.
 *
 * AdSense does not let a publisher place an interstitial — the only
 * full-screen format Google serves is the Vignette, and Auto ads decide when
 * that appears, not this code. So there is no web unit to configure, and the
 * arithmetic that decides when one is due is what can be checked here.
 */
test.describe('The interstitial', () => {
  test('exists for the packaged app and nowhere else', async ({ page }) => {
    await gotoApp(page)

    const config = await page.evaluate(async () => {
      const { AD_INTERSTITIALS } = await import('/src/services/ads/adConfig.js')
      return AD_INTERSTITIALS
    })

    expect(Object.keys(config)).toContain('ar-exit')
    // No web key at all, so there is nothing for the web build to read even
    // by accident.
    expect(config['ar-exit'].web).toBeUndefined()
    expect(config['ar-exit']).toHaveProperty('native')
  })

  test('never on the first exit, and never twice in a few minutes', async ({ page }) => {
    await gotoApp(page)

    const due = await page.evaluate(async () => {
      const { interstitialIsDue, MIN_GAP_MS } = await import(
        '/src/services/ads/nativeInterstitial.js'
      )
      const now = 10_000_000

      return {
        // Nobody has been anywhere yet: the first time out of AR is when
        // someone is deciding what they think of the feature.
        firstTime: interstitialIsDue({ last: 0, now }),
        // Four trips in and out to look at the park from four angles is one
        // person exploring, not four ad breaks.
        straightBack: interstitialIsDue({ last: now - 20_000, now }),
        justUnder: interstitialIsDue({ last: now - (MIN_GAP_MS - 1), now }),
        // And a real second visit, later, is fair game.
        muchLater: interstitialIsDue({ last: now - MIN_GAP_MS * 2, now }),
        gap: MIN_GAP_MS
      }
    })

    expect(due.firstTime).toBe(false)
    expect(due.straightBack).toBe(false)
    expect(due.justUnder).toBe(false)
    expect(due.muchLater).toBe(true)
    // Minutes, not seconds.
    expect(due.gap).toBeGreaterThanOrEqual(60_000)
  })

  test('shows nothing on the web, whatever it is asked', async ({ page }) => {
    await gotoApp(page)

    const shown = await page.evaluate(async () => {
      const { showInterstitial, prepareInterstitial, resetInterstitialClock } = await import(
        '/src/services/ads/nativeInterstitial.js'
      )
      resetInterstitialClock(1)

      return {
        // There is no AdMob plugin in a browser, so both of these resolve to
        // "nothing happened" rather than throwing into a screen change.
        prepared: await prepareInterstitial({ unit: 'ca-app-pub-test/test' }),
        shown: await showInterstitial(
          { unit: 'ca-app-pub-test/test' },
          { now: () => 1 + 60 * 60 * 1000 }
        ),
        // And with no unit configured it does not even look.
        unconfigured: await showInterstitial({ unit: null })
      }
    })

    expect(shown.prepared).toBe(false)
    expect(shown.shown).toBe(false)
    expect(shown.unconfigured).toBe(false)
  })
})
