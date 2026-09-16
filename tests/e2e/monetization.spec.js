import { test, expect } from '@playwright/test'
import { gotoApp, openDrawer, temperature } from './support/app.js'

/**
 * The ad slots, the client-side weather cache and the launch parameters.
 *
 * The slots carry no ad unit ids in this checkout, so what is asserted here is
 * placement and policy — that a slot appears where it should, disappears where
 * it must, and never sits between the reader and the globe.
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
  test('sit inside the weather panel, not over the globe', async ({ page }) => {
    await gotoApp(page)
    await openDrawer(page)

    for (const slot of SLOTS) {
      await expect(page.getByTestId(slot)).toBeVisible()
    }

    // Each is labelled, which the AdSense policies require.
    await expect(page.getByText('Advertisement', { exact: true })).toHaveCount(SLOTS.length)

    // The scene is still there and still on top of nothing.
    await expect(page.locator('canvas').first()).toBeAttached()
  })

  test('are parked off-screen until the panel is opened', async ({ page }) => {
    await gotoApp(page)
    // The panel is translated out of the viewport rather than unmounted, so
    // the question is where the slot is, not whether it exists.
    for (const slot of SLOTS) {
      const box = await page.getByTestId(slot).boundingBox()
      expect(box.x + box.width).toBeLessThanOrEqual(0)
    }
  })

  test('can be switched off with ?ads=off', async ({ page }) => {
    await gotoApp(page, '/?ads=off')
    await openDrawer(page)
    for (const slot of SLOTS) {
      await expect(page.getByTestId(slot)).toHaveCount(0)
    }
  })

  test('never run while the camera is showing', async ({ page }) => {
    await gotoApp(page)
    const inAR = await page.evaluate(async () => {
      const { adsEnabled } = await import('/src/services/ads/adProvider.js')
      return { ar: adsEnabled({ renderMode: 'ar' }), scene: adsEnabled({ renderMode: '3d' }) }
    })
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
