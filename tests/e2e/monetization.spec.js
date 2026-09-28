import { test, expect } from '@playwright/test'
import { gotoApp, openDrawer, temperature } from './support/app.js'

/**
 * Advertising, the client-side weather cache and the launch parameters.
 *
 * The slots used to sit in the weather panel, and that is what cost the site
 * its AdSense approval: the app screen is a canvas and a panel of readings,
 * with no publisher content on it, and Google does not allow its ads on a
 * screen like that. The advertising moved to the written pages, which is
 * where site-content.spec.js checks it. What is left here is that the app
 * screen asks for none of it.
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
  test('none of them render on the globe screen', async ({ page }) => {
    await gotoApp(page)
    await openDrawer(page)

    for (const slot of SLOTS) {
      await expect(page.getByTestId(slot), `${slot} is not drawn`).toHaveCount(0)
    }

    // And nothing else has put an ad on the page either: the loader is not
    // in this document at all, so Auto ads cannot place one.
    await expect(page.locator('ins.adsbygoogle')).toHaveCount(0)
    await expect(page.locator('script[src*="adsbygoogle"]')).toHaveCount(0)

    // The scene is still there and still on top of nothing.
    await expect(page.locator('canvas').first()).toBeAttached()
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
