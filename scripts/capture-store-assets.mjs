/**
 * Captures Google Play store-listing screenshots straight from the running app.
 *
 * Usage:
 *   npm run dev                                   # in another shell (port 3000)
 *   node scripts/capture-store-assets.mjs [ids…]  # ids filter shots, e.g. "phone"
 *
 * Output sizes match Play's requirements (9:16 phone, 16:9 tablet):
 *   phone      1080x1920   tablet-7    1920x1080   tablet-10  2560x1440
 *   chromebook 2880x1620   xr          2560x1440
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const BASE_URL = process.env.CAPTURE_URL || 'http://localhost:3000'
const OUT_DIR = path.resolve('assets/play-store')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const DEVICES = {
  phone: { dir: 'phone', viewport: { width: 540, height: 960 }, scale: 2, zoomScale: 1 },
  // The camera's field of view is vertical, so the shorter landscape frame
  // needs extra dolly to fill it with the globe.
  'tablet-7': { dir: 'tablet-7', viewport: { width: 960, height: 540 }, scale: 2, zoomScale: 3.3 },
  'tablet-10': { dir: 'tablet-10', viewport: { width: 1280, height: 720 }, scale: 2, zoomScale: 3.3 },
  chromebook: { dir: 'chromebook', viewport: { width: 1440, height: 810 }, scale: 2, zoomScale: 3.3 },
  xr: { dir: 'xr', viewport: { width: 1280, height: 720 }, scale: 2, zoomScale: 3.3 }
}

// Each shot is a real app state: a city search, an optional time-of-day
// override (the app's own Sun & Moon slider) and the drawer open or closed.
const SHOTS = [
  { id: '01-clear-day', city: 'New York', drawer: false, zoom: -3 },
  { id: '02-night', city: 'New York', hour: 22, drawer: false, zoom: -3 },
  { id: '03-rain', city: 'Mumbai', drawer: false, zoom: -4 },
  { id: '04-snow', city: 'Reykjavik', simulate: 'snow', hour: 13, drawer: false, zoom: -9 },
  { id: '05-weather-panel', city: 'New York', drawer: true, landscapeScrollTo: '.weather-info' },
  { id: '06-forecast', city: 'New York', drawer: true, scrollTo: '.temperature-card' }
]

// Reykjavik is not snowing today; this rewrites only the condition code in the
// live API response so the shot shows the app's real snow rendering.
const SNOW_PATCH = { id: 601, main: 'Snow', description: 'snow', icon: '13d' }

async function simulateSnow(page) {
  await page.route('**/data/2.5/weather*', async (route) => {
    const res = await route.fetch()
    const json = await res.json()
    json.weather = [SNOW_PATCH]
    json.main = { ...json.main, temp: 28, feels_like: 21 }
    await route.fulfill({ response: res, json })
  })
  await page.route('**/data/2.5/forecast*', async (route) => {
    const res = await route.fetch()
    const json = await res.json()
    json.list = (json.list || []).map((entry) => ({
      ...entry,
      weather: [SNOW_PATCH],
      main: { ...entry.main, temp: Math.min(entry.main?.temp ?? 28, 30) }
    }))
    await route.fulfill({ response: res, json })
  })
}

const HIDE_DESKTOP_CHROME = `
  .controls-hint { display: none !important; }
  [data-vercel-speed-insights], iframe[src*="vercel"] { display: none !important; }
`

async function setSlider(page, hour) {
  await page.evaluate((value) => {
    const slider = document.querySelector('.time-slider')
    if (!slider) throw new Error('time slider not found')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(slider, String(value))
    slider.dispatchEvent(new Event('input', { bubbles: true }))
    slider.dispatchEvent(new Event('change', { bubbles: true }))
  }, hour)
}

async function capture(browser, device, shot) {
  const context = await browser.newContext({
    viewport: device.viewport,
    deviceScaleFactor: device.scale
  })
  const page = await context.newPage()
  if (shot.simulate === 'snow') await simulateSnow(page)

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('canvas')
  await page.addStyleTag({ content: HIDE_DESKTOP_CHROME })

  const openDrawer = () => page.click('button[aria-label="Open Weather Info"]')
  const closeDrawer = () => page.click('button[aria-label="Close Weather Info"]')

  await page.waitForSelector('.summary-temp, .temperature', { timeout: 30000 })
  await openDrawer()

  if (shot.city && shot.city !== 'New York') {
    await page.fill('.city-input', shot.city)
    await page.click('.search-button')
    await page.waitForFunction(
      (city) => document.body.innerText.includes(city),
      shot.city,
      { timeout: 30000 }
    )
  }

  if (shot.hour !== undefined) {
    await page.waitForSelector('.time-slider', { timeout: 15000 })
    await setSlider(page, shot.hour)
  }

  // Scroll a specific card into view so the framing holds on every viewport.
  // The short landscape frame shows less of the drawer, so landscape devices
  // can aim at a different card than the phone does.
  const scrollTarget = device.dir === 'phone'
    ? shot.scrollTo
    : shot.landscapeScrollTo ?? shot.scrollTo
  if (scrollTarget) {
    await page.evaluate((selector) => {
      document.querySelector(selector)?.scrollIntoView({ block: 'center' })
    }, scrollTarget)
    await page.waitForTimeout(500)
  }

  if (!shot.drawer) await closeDrawer()

  // OrbitControls zoom: negative steps dolly the camera towards the globe.
  const zoomSteps = Math.max(-12, Math.round((shot.zoom ?? 0) * (device.zoomScale ?? 1)))
  if (zoomSteps) {
    const box = await page.locator('canvas').boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    for (let i = 0; i < Math.abs(zoomSteps); i += 1) {
      await page.mouse.wheel(0, zoomSteps < 0 ? -240 : 240)
      await page.waitForTimeout(180)
    }
  }

  await page.waitForTimeout(shot.settle ?? 6000) // let the 3D scene settle

  const dir = path.join(OUT_DIR, device.dir)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${shot.id}.png`)
  await page.screenshot({ path: file })
  await context.close()

  const { size } = fs.statSync(file)
  console.log(`${file}  ${(size / 1024).toFixed(0)} KB`)
}

const filter = process.argv.slice(2)
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--hide-scrollbars', '--force-color-profile=srgb', '--enable-unsafe-swiftshader']
})

for (const [name, device] of Object.entries(DEVICES)) {
  if (filter.length && !filter.some((f) => name.includes(f))) continue
  for (const shot of SHOTS) {
    if (filter.length && filter.some((f) => f.startsWith('0')) && !filter.includes(shot.id)) continue
    await capture(browser, device, shot)
  }
}

await browser.close()
